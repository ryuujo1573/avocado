/**
 * @fileoverview Main entry point for the Avocado agent.
 *
 * Usage:
 *   avocado-agent --enroll <token> [--server <url>]
 *   avocado-agent [--server <url>]
 */
import "./hoc";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname, platform, arch } from "node:os";
import { logger } from "@avocado/core/qos";
import { AgentWsClient } from "./ws-client";
import { ShellCapabilityHandler } from "./capabilities/shell";
import { FileCapabilityHandler } from "./capabilities/file";
import type { WireMessage } from "@avocado/core/protocol";

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG_DIR = resolve(homedir(), ".avocado");
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

type AgentConfig = {
  agentId: string;
  credential: string;
  serverUrl: string;
};

function loadConfig(): AgentConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as AgentConfig;
  } catch {
    return null;
  }
}

function saveConfig(config: AgentConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  enroll: string | null;
  serverUrl: string;
  allowPaths: string[];
} {
  const args = argv.slice(2);
  let enroll: string | null = null;
  let serverUrl = process.env.AVOCADO_SERVER ?? "http://localhost:3000";
  const allowPaths: string[] = [homedir()];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--enroll" && args[i + 1]) {
      enroll = args[++i];
    } else if (args[i] === "--server" && args[i + 1]) {
      serverUrl = args[++i];
    } else if (args[i] === "--allow-path" && args[i + 1]) {
      allowPaths.push(args[++i]);
    }
  }

  return { enroll, serverUrl, allowPaths };
}

// ─── Enrollment ───────────────────────────────────────────────────────────────

async function enroll(token: string, serverUrl: string): Promise<AgentConfig> {
  logger.i("Enrolling with server: %o", serverUrl);

  const res = await fetch(`${serverUrl}/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      hostname: hostname(),
      os: platform(),
      arch: arch(),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Enrollment failed (${res.status}): ${body?.error ?? res.statusText}`);
  }

  const { agentId, credential } = (await res.json()) as {
    agentId: string;
    credential: string;
  };

  const config: AgentConfig = { agentId, credential, serverUrl };
  saveConfig(config);
  logger.i("Enrolled successfully. Agent ID: %o", agentId);
  logger.i("Config saved to: %o", CONFIG_PATH);
  return config;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<number> {
  const {
    enroll: enrollToken,
    serverUrl,
    allowPaths,
  } = parseArgs(process.argv);

  // Enrollment mode
  if (enrollToken) {
    await enroll(enrollToken, serverUrl);
    return 0;
  }

  // Normal run mode
  const config = loadConfig();
  if (!config) {
    logger.e("No agent config found. Run with --enroll <token> first.");
    return 1;
  }

  logger.i("Starting agent: %o", config.agentId);
  logger.i("Server: %o", config.serverUrl ?? serverUrl);

  const shellHandler = new ShellCapabilityHandler(allowPaths);
  const fileHandler = new FileCapabilityHandler(allowPaths);

  const client = new AgentWsClient({
    serverUrl: config.serverUrl ?? serverUrl,
    credential: config.credential,
    agentId: config.agentId,
    hostname: hostname(),
    os: platform(),
    arch: arch(),
    onOnline: () => logger.i("Agent is online"),
    onOffline: () => logger.i("Agent is offline — will reconnect"),
    onMessage: (msg: WireMessage) => {
      switch (msg.kind) {
        case "open-channel": {
          switch (msg.capability.kind) {
            case "shell":
              shellHandler.open(msg.channelId, msg.capability, (outMsg) =>
                client.send(outMsg),
              );
              break;
            case "file":
              fileHandler.open(msg.channelId, msg.capability, (outMsg) =>
                client.send(outMsg),
              );
              break;
          }
          break;
        }

        case "shell-input":
          shellHandler.handleInput(msg.channelId, msg.data);
          break;

        case "shell-resize":
          shellHandler.handleResize(msg.channelId, msg.cols, msg.rows);
          break;

        case "channel-close":
          shellHandler.close(msg.channelId);
          fileHandler.close(msg.channelId);
          break;

        case "file-chunk":
          fileHandler.handleChunk(msg.channelId, msg.seq, msg.data);
          break;

        default:
          break;
      }
    },
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.i("Shutting down agent...");
    client.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.i("Shutting down agent (SIGTERM)...");
    client.destroy();
    process.exit(0);
  });

  // Keep process alive
  await new Promise<void>(() => {});
  return 0;
}

const isExecuted = import.meta.url
  .let(fileURLToPath)
  .let(resolve)
  .includes(process.argv[1]);

if (isExecuted) {
  main().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
