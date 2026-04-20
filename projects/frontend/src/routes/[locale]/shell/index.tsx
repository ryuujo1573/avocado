/**
 * Remote shell page.
 * Uses a WS relay through the backend to open a PTY on the agent
 * and render it via xterm.js.
 *
 * Flow: browser ──WS──▶ backend ──WS──▶ agent
 *       browser ◀──WS── backend ◀──WS── agent
 */
import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  noSerialize,
  useStore,
  type NoSerialize,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useLocation, useNavigate } from "@builder.io/qwik-city";
import { logger } from "@avocado/core/qos";
import { localize } from "compiled-i18n";
import { wsBaseUrl } from "~/lib/api";

type State = {
  status: "connecting" | "open" | "closed" | "error";
  errorMsg: string;
  // biome-ignore lint/suspicious/noExplicitAny: xterm Terminal type
  terminal: NoSerialize<any> | null;
  ws: NoSerialize<WebSocket> | null;
};

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const termRef = useSignal<HTMLDivElement>();
  const channelId = `ch-${Math.random().toString(36).slice(2, 10)}`;

  const state = useStore<State>({
    status: "connecting",
    errorMsg: "",
    terminal: null,
    ws: null,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time setup
  useVisibleTask$(async () => {
    const params = loc.url.searchParams;
    const sessionId = params.get("sessionId");
    const agentId = params.get("agentId");
    const traceId = params.get("traceId");
    const accessToken = localStorage.getItem("accessToken");

    if (!sessionId || !agentId || !accessToken) {
      state.status = "error";
      state.errorMsg = "Missing session parameters";
      return;
    }

    // ── Load xterm.js dynamically ─────────────────────────────────────────
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      fontSize: 14,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    state.terminal = noSerialize(term);

    if (termRef.value) {
      term.open(termRef.value);
      fitAddon.fit();
    }

    // ── Open dashboard WebSocket ──────────────────────────────────────────
    const wsBase = wsBaseUrl();
    const wsUrl = new URL("/ws/dashboard", wsBase);
    wsUrl.searchParams.set("token", accessToken);
    const ws = new WebSocket(wsUrl.toString());
    state.ws = noSerialize(ws);

    ws.onopen = () => {
      logger.i("[%o] Dashboard WS open — sending open-channel", traceId);
      ws.send(
        JSON.stringify({
          kind: "open-channel",
          channelId,
          sessionId,
          capability: {
            kind: "shell",
            cols: term.cols,
            rows: term.rows,
          },
        }),
      );
      state.status = "open";
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data);
        switch (msg.kind) {
          case "shell-output":
            term.write(Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0)));
            break;
          case "shell-exit":
            term.writeln(`\r\n\x1b[33m[process exited: ${msg.code}]\x1b[0m`);
            state.status = "closed";
            break;
          case "channel-close":
            term.writeln("\r\n\x1b[33m[channel closed]\x1b[0m");
            state.status = "closed";
            break;
          case "error":
            logger.w("[%o] Server error: %o", traceId, msg.message);
            state.status = "error";
            state.errorMsg = msg.message ?? "server error";
            break;
          default:
            break;
        }
      } catch {
        // ignore parse errors from unrelated dashboard messages
      }
    };

    ws.onclose = (e) => {
      if (state.status === "open" || state.status === "connecting") {
        state.status = "error";
        state.errorMsg = `WebSocket closed: ${e.reason || e.code}`;
      }
      logger.i("[%o] Dashboard WS closed", traceId);
    };

    ws.onerror = () => {
      state.status = "error";
      state.errorMsg = "WebSocket error";
    };

    // ── Forward xterm keystrokes → WS ────────────────────────────────────
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            kind: "shell-input",
            channelId,
            data: btoa(
              Array.from(new TextEncoder().encode(data), (b) =>
                String.fromCharCode(b),
              ).join(""),
            ),
          }),
        );
      }
    });

    // ── Handle terminal resize ────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            kind: "shell-resize",
            channelId,
            cols: term.cols,
            rows: term.rows,
          }),
        );
      }
    });
    if (termRef.value) resizeObserver.observe(termRef.value);
  });

  const close$ = $(async () => {
    state.ws?.close();
    const locale =
      loc.url.pathname.split("/").find((s) => s.length === 2) ?? "en";
    await nav(`/${locale}/`);
  });

  return (
    <div class="flex h-screen flex-col bg-black">
      <div class="flex items-center justify-between bg-base-300 px-4 py-2">
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm text-base-content/60">
            {loc.url.searchParams.get("agentId") ?? "agent"}
          </span>
          <span
            class={`badge badge-sm ${
              state.status === "open"
                ? "badge-success"
                : state.status === "connecting"
                  ? "badge-warning"
                  : "badge-error"
            }`}
          >
            {state.status}
          </span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onClick$={close$}>
          {localize`Close`}
        </button>
      </div>

      {state.status === "error" && (
        <div class="alert alert-error m-4">
          <span>{state.errorMsg}</span>
        </div>
      )}

      <div ref={termRef} class="flex-1 overflow-hidden p-1" />
    </div>
  );
});

export const head: DocumentHead = {
  title: "Shell — Avocado",
};
