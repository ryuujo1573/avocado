/**
 * Remote shell page.
 * Uses WebRTC DataChannel (via the signaling established over the dashboard WS)
 * to open a PTY on the agent and render it via xterm.js.
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

const BACKEND_URL =
  typeof import.meta.env !== "undefined"
    ? import.meta.env.PUBLIC_BACKEND_URL ?? ""
    : "";

type State = {
  status: "connecting" | "open" | "closed" | "error";
  errorMsg: string;
  // non-serializable handles stored via noSerialize
  // biome-ignore lint/suspicious/noExplicitAny: xterm Terminal type
  terminal: NoSerialize<any> | null;
  ws: NoSerialize<WebSocket> | null;
  // biome-ignore lint/suspicious/noExplicitAny: RTCPeerConnection
  pc: NoSerialize<any> | null;
  // biome-ignore lint/suspicious/noExplicitAny: RTCDataChannel
  dc: NoSerialize<any> | null;
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
    pc: null,
    dc: null,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time setup
  useVisibleTask$(async () => {
    const params = loc.url.searchParams;
    const sessionId = params.get("sessionId");
    const agentId = params.get("agentId");
    const traceId = params.get("traceId");
    const turnUsername = params.get("turnUsername");
    const turnCredential = params.get("turnCredential");
    const turnUrls: string[] = JSON.parse(params.get("turnUrls") ?? "[]");
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

    // ── Open dashboard WebSocket (for signaling) ──────────────────────────
    const wsBase = BACKEND_URL
      ? BACKEND_URL.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
    const wsUrl = new URL("/ws/dashboard", wsBase);
    wsUrl.searchParams.set("token", accessToken);
    const ws = new WebSocket(wsUrl.toString());
    state.ws = noSerialize(ws);

    // ── Set up RTCPeerConnection (offerer side = browser) ─────────────────
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
    ];
    if (turnUsername && turnCredential && turnUrls.length > 0) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    const pc = new RTCPeerConnection({ iceServers });
    state.pc = noSerialize(pc);

    // Create the shell DataChannel before offer
    const dc = pc.createDataChannel("shell", { ordered: true });
    state.dc = noSerialize(dc);

    dc.onopen = () => {
      state.status = "open";
      logger.i("[%o] DataChannel open", traceId);

      const { cols, rows } = term;

      // Open shell channel on agent
      dc.send(
        JSON.stringify({
          kind: "open-channel",
          channelId,
          sessionId,
          capability: { kind: "shell", cols, rows },
        }),
      );
    };

    dc.onclose = () => {
      state.status = "closed";
      term.writeln("\r\n\x1b[33m[connection closed]\x1b[0m");
    };

    dc.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data);
        switch (msg.kind) {
          case "shell-output":
            term.write(Buffer.from(msg.data, "base64"));
            break;
          case "shell-exit":
            term.writeln(`\r\n\x1b[33m[process exited: ${msg.code}]\x1b[0m`);
            state.status = "closed";
            break;
          case "channel-close":
            term.writeln("\r\n\x1b[33m[channel closed]\x1b[0m");
            state.status = "closed";
            break;
          default:
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    // Forward xterm keystrokes → DataChannel
    term.onData((data) => {
      if (dc.readyState === "open") {
        dc.send(
          JSON.stringify({
            kind: "shell-input",
            channelId,
            data: Buffer.from(data).toString("base64"),
          }),
        );
      }
    });

    // Handle terminal resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (dc.readyState === "open") {
        dc.send(
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

    // ICE candidate relay
    pc.onicecandidate = (e) => {
      if (e.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            kind: "ice-candidate",
            sessionId,
            candidate: JSON.stringify(e.candidate),
            sdpMid: e.candidate.sdpMid ?? null,
            sdpMLineIndex: e.candidate.sdpMLineIndex ?? null,
          }),
        );
      }
    };

    pc.onconnectionstatechange = () => {
      logger.i("[%o] RTCPeerConnection state: %o", traceId, pc.connectionState);
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        state.status = "error";
        state.errorMsg = `WebRTC ${pc.connectionState}`;
      }
    };

    // WS open → create and send offer
    ws.onopen = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(
          JSON.stringify({
            kind: "signal-offer",
            sessionId,
            sdp: offer.sdp!,
          }),
        );
      } catch (err) {
        state.status = "error";
        state.errorMsg = String(err);
      }
    };

    ws.onmessage = async (e) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data);
        switch (msg.kind) {
          case "signal-answer": {
            await pc.setRemoteDescription({
              type: "answer",
              sdp: msg.sdp,
            });
            break;
          }
          case "ice-candidate": {
            const candidate = JSON.parse(msg.candidate);
            await pc.addIceCandidate(candidate);
            break;
          }
          default:
            break;
        }
      } catch (err) {
        logger.w("Shell WS message error: %o", err);
      }
    };

    ws.onerror = () => {
      state.status = "error";
      state.errorMsg = "WebSocket error";
    };
  });

  const close$ = $(async () => {
    state.ws?.close();
    state.dc?.close();
    state.pc?.close();
    const locale = loc.params.locale ?? "en";
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
