import { logger } from "@avocado/core/qos";
import type { JSXOutput } from "@builder.io/qwik";
import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
import { useNavigate, useLocation } from "@builder.io/qwik-city";
import {
  BsApple,
  BsCircleFill,
  BsUbuntu,
  BsWindows,
} from "@qwikest/icons/bootstrap";
import {
  HiComputerDesktopSolid,
  HiCommandLineSolid,
  HiArrowUpTraySolid,
} from "@qwikest/icons/heroicons";
import { localize } from "compiled-i18n";
import { apiClient, wsBaseUrl } from "~/lib/api";

export const pageMeta: PageMeta = {
  get name() {
    return localize`Devices`;
  },
  id: "devices",
  icon: <HiComputerDesktopSolid />,
};

type AgentInfo = {
  id: string;
  hostname: string;
  os: string;
  arch: string;
  status: "online" | "offline";
  lastSeenAt: number | null;
};

const osIconMap: Record<string, JSXOutput> = {
  windows: <BsWindows />,
  darwin: <BsApple />,
  linux: <BsUbuntu />,
};

/** Extract locale from /en/... or /zh/... pathname */
function localeFromPath(pathname: string): string {
  return pathname.split("/").find((s) => s.length === 2) ?? "en";
}

export default component$(() => {
  const nav = useNavigate();
  const loc = useLocation();
  const agents = useStore<{ list: AgentInfo[] }>({ list: [] });
  const wsStatus = useSignal<"connecting" | "connected" | "disconnected">(
    "connecting",
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time setup
  useVisibleTask$(async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      const locale = localeFromPath(loc.url.pathname);
      await nav(`/${locale}/login`);
      return;
    }

    const wsBase = wsBaseUrl();
    const wsUrl = new URL("/ws/dashboard", wsBase);
    wsUrl.searchParams.set("token", accessToken);

    function connect() {
      const ws = new WebSocket(wsUrl.toString());

      ws.onopen = () => {
        wsStatus.value = "connected";
        logger.i("Dashboard WS connected");
      };

      ws.onmessage = (e) => {
        if (typeof e.data !== "string") return;
        try {
          const msg = JSON.parse(e.data);
          switch (msg.kind) {
            case "agent-list":
              agents.list = msg.agents as AgentInfo[];
              break;
            case "agent-online": {
              const idx = agents.list.findIndex((a) => a.id === msg.agentId);
              if (idx >= 0) {
                agents.list[idx] = {
                  ...agents.list[idx],
                  status: "online",
                  hostname: msg.hostname,
                  os: msg.os,
                  arch: msg.arch,
                  lastSeenAt: msg.timestamp,
                };
              } else {
                agents.list.push({
                  id: msg.agentId,
                  hostname: msg.hostname,
                  os: msg.os,
                  arch: msg.arch,
                  status: "online",
                  lastSeenAt: msg.timestamp,
                });
              }
              break;
            }
            case "agent-offline": {
              const idx = agents.list.findIndex((a) => a.id === msg.agentId);
              if (idx >= 0) {
                agents.list[idx] = {
                  ...agents.list[idx],
                  status: "offline",
                  lastSeenAt: msg.timestamp,
                };
              }
              break;
            }
            default:
              break;
          }
        } catch (err) {
          logger.w("Dashboard WS parse error: %o", err);
        }
      };

      ws.onclose = () => {
        wsStatus.value = "disconnected";
        logger.i("Dashboard WS closed — reconnecting in 5s");
        setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        logger.w("Dashboard WS error");
      };
    }

    connect();
  });

  const openShell$ = $(async (agentId: string) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return;

    const res = await apiClient.sessions.$post(
      { json: { agentId } },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "unknown" }));
      logger.e(
        "Failed to create session: %o",
        (body as { error?: string }).error,
      );
      return;
    }

    const { sessionId, traceId, turnUsername, turnCredential, turnUrls } =
      await res.json();
    const locale = localeFromPath(loc.url.pathname);

    const params = new URLSearchParams({
      sessionId,
      agentId,
      traceId,
      turnUsername,
      turnCredential,
      turnUrls: JSON.stringify(turnUrls),
    });

    await nav(`/${locale}/shell?${params.toString()}`);
  });

  return (
    <div class="flex max-w-full flex-col gap-4 p-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold">{localize`Agents`}</h1>
        <span
          class={`badge ${
            wsStatus.value === "connected"
              ? "badge-success"
              : wsStatus.value === "connecting"
                ? "badge-warning"
                : "badge-error"
          }`}
        >
          {wsStatus.value}
        </span>
      </div>

      {agents.list.length === 0 && (
        <div class="alert">
          <span>{localize`No agents enrolled. Run the agent with --enroll <token> to get started.`}</span>
        </div>
      )}

      <div class="flex flex-wrap gap-3">
        {agents.list.map((agent) => (
          <div
            key={agent.id}
            class={[
              "card card-compact w-72 border shadow-inner",
              agent.status === "online"
                ? "border-success bg-base-100"
                : "border-base-content bg-base-100 opacity-60",
            ]}
          >
            <div class="card-body">
              <h4 class="card-title text-sm leading-tight">
                {osIconMap[agent.os] ?? <HiComputerDesktopSolid />}
                <span class="truncate">{agent.hostname}</span>
                <BsCircleFill
                  class={
                    agent.status === "online" ? "text-success" : "text-neutral"
                  }
                />
              </h4>
              <p class="font-mono text-xs text-base-content/60">{agent.id}</p>
              <p class="text-xs">
                {agent.os} / {agent.arch}
              </p>
              {agent.lastSeenAt && (
                <p class="text-xs text-base-content/50">
                  {localize`Last seen:`}{" "}
                  {new Date(agent.lastSeenAt).toLocaleTimeString()}
                </p>
              )}

              {agent.status === "online" && (
                <div class="card-actions mt-2 justify-end gap-1">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm gap-1"
                    onClick$={() => openShell$(agent.id)}
                  >
                    <HiCommandLineSolid class="h-4 w-4" />
                    {localize`Shell`}
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline btn-sm gap-1"
                    onClick$={() => {
                      /* File transfer — opens the shell page in file mode */
                      logger.i("TODO: file transfer for %o", agent.id);
                    }}
                  >
                    <HiArrowUpTraySolid class="h-4 w-4" />
                    {localize`Upload`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
