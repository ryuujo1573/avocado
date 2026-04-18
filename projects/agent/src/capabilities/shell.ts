/**
 * Shell capability handler for the agent.
 * Spawns a PTY via node-pty and wires it to the DataChannel.
 */
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { homedir, platform } from "node:os";
import { logger } from "@avocado/core/qos";
import type { ShellCapability, WireMessage } from "@avocado/core/protocol";

type SendFn = (msg: WireMessage) => void;

type PtySession = {
  // node-pty IPty instance
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import
  pty: any;
  send: SendFn;
};

export class ShellCapabilityHandler {
  readonly #allowPaths: string[];
  readonly #sessions = new Map<string, PtySession>();

  constructor(allowPaths: string[]) {
    this.#allowPaths = allowPaths;
  }

  async open(
    channelId: string,
    cap: ShellCapability,
    send: SendFn,
  ): Promise<void> {
    try {
      // Dynamic import so missing node-pty doesn't crash startup
      const nodePty = await import("node-pty").catch(() => null);
      if (!nodePty) {
        logger.e("node-pty not available — cannot open shell channel");
        send({
          kind: "channel-close",
          channelId,
          reason: "node-pty not available",
        });
        return;
      }

      const shell =
        platform() === "win32"
          ? "powershell.exe"
          : process.env.SHELL ?? "/bin/bash";
      const cwd = cap.cwd && this.#isAllowedPath(cap.cwd) ? cap.cwd : homedir();

      const pty = nodePty.spawn(shell, [], {
        name: "xterm-256color",
        cols: cap.cols,
        rows: cap.rows,
        cwd,
        env: { ...process.env } as Record<string, string>,
      });

      pty.onData((data: string) => {
        send({
          kind: "shell-output",
          channelId,
          data: Buffer.from(data).toString("base64"),
        });
      });

      pty.onExit(
        ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
          logger.i("PTY exited: channelId=%o code=%o", channelId, exitCode);
          this.#sessions.delete(channelId);
          send({
            kind: "shell-exit",
            channelId,
            code: exitCode,
            signal: signal ? String(signal) : undefined,
          });
        },
      );

      this.#sessions.set(channelId, { pty, send });
      logger.i("Shell channel opened: %o cwd=%o", channelId, cwd);
    } catch (err) {
      logger.e("Failed to open shell: %o", err);
      send({ kind: "channel-close", channelId, reason: String(err) });
    }
  }

  handleInput(channelId: string, data: string): void {
    const session = this.#sessions.get(channelId);
    if (!session) return;
    try {
      const decoded = Buffer.from(data, "base64").toString("utf-8");
      session.pty.write(decoded);
    } catch (err) {
      logger.w("Failed to write to PTY: %o", err);
    }
  }

  handleResize(channelId: string, cols: number, rows: number): void {
    const session = this.#sessions.get(channelId);
    if (!session) return;
    try {
      session.pty.resize(cols, rows);
    } catch (err) {
      logger.w("Failed to resize PTY: %o", err);
    }
  }

  close(channelId: string): void {
    const session = this.#sessions.get(channelId);
    if (!session) return;
    try {
      session.pty.kill();
    } catch {
      // PTY may already be dead
    }
    this.#sessions.delete(channelId);
    logger.i("Shell channel closed: %o", channelId);
  }

  #isAllowedPath(p: string): boolean {
    const normalized = resolve(p);
    return this.#allowPaths.some((allowed) =>
      normalized.startsWith(resolve(allowed)),
    );
  }

  /** Audit: returns the number of live PTY sessions (for testing). */
  get activeCount(): number {
    return this.#sessions.size;
  }
}
