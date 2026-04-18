/**
 * Persistent WebSocket client for the agent.
 * Driven by agentLinkMachine from packages/core.
 * Reconnects with exponential backoff + full jitter.
 */

import { createActor } from "xstate";
import { agentLinkMachine, nextRetryDelay } from "@avocado/core/machines";
import { parseWireMessage, type WireMessage } from "@avocado/core/protocol";
import { logger } from "@avocado/core/qos";

const HEARTBEAT_INTERVAL_MS = 5_000;

export type WsClientOptions = {
  serverUrl: string;
  credential: string;
  agentId: string;
  hostname: string;
  os: string;
  arch: string;
  onMessage?: (msg: WireMessage) => void;
  onOnline?: () => void;
  onOffline?: () => void;
};

export class AgentWsClient {
  readonly #opts: WsClientOptions;
  readonly #actor = createActor(agentLinkMachine);
  #ws: WebSocket | null = null;
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  #destroyed = false;

  constructor(opts: WsClientOptions) {
    this.#opts = opts;

    this.#actor.subscribe((snap) => {
      logger.d("agentLink state: %o", snap.value);
    });

    this.#actor.start();
    this.#connect();
  }

  #connect() {
    if (this.#destroyed) return;

    this.#actor.send({ type: "CONNECT" });

    const url = new URL("/ws/agent", this.#opts.serverUrl);
    url.protocol = url.protocol.replace("http", "ws");
    url.searchParams.set("credential", this.#opts.credential);

    const ws = new WebSocket(url.toString());
    this.#ws = ws;

    ws.onopen = () => {
      if (this.#destroyed || ws !== this.#ws) {
        ws.close();
        return;
      }
      this.#actor.send({ type: "CONNECTED" });

      // Send Hello
      this.#send({
        kind: "hello",
        version: 1,
        agentId: this.#opts.agentId,
        hostname: this.#opts.hostname,
        os: this.#opts.os,
        arch: this.#opts.arch,
      });

      // Start heartbeat loop
      this.#heartbeatTimer = setInterval(() => {
        this.#send({ kind: "heartbeat", timestamp: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      let msg: WireMessage;
      try {
        msg = parseWireMessage(e.data);
      } catch (err) {
        logger.w("Received unparseable message: %o", err);
        return;
      }

      switch (msg.kind) {
        case "hello-ack":
          this.#actor.send({ type: "HELLO_ACK", agentId: msg.agentId });
          this.#opts.onOnline?.();
          break;

        case "heartbeat-ack":
          this.#actor.send({ type: "HEARTBEAT" });
          break;

        case "error":
          logger.w("Server error: [%o] %o", msg.code, msg.message);
          break;

        default:
          this.#opts.onMessage?.(msg);
          break;
      }
    };

    ws.onclose = (e) => {
      if (this.#destroyed) return;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      this.#heartbeatTimer = null;
      const heartbeatTimer = this.#heartbeatTimer;

      this.#actor.send({ type: "DISCONNECT", reason: e.reason || "closed" });
      this.#opts.onOffline?.();
      this.#scheduleReconnect();
    };

    ws.onerror = () => {
      logger.w("WebSocket error — will reconnect");
      this.#actor.send({ type: "ERROR", error: "ws error" });
    };
  }

  #scheduleReconnect() {
    if (this.#destroyed) return;
    const snap = this.#actor.getSnapshot();
    const retryCount = snap.context.retryCount;
    const delay = nextRetryDelay(retryCount);
    logger.i("Reconnecting in %oms (attempt %o)", delay, retryCount + 1);

    setTimeout(() => {
      if (this.#destroyed) return;
      this.#actor.send({ type: "RETRY" });
      this.#connect();
    }, delay);
  }

  #send(msg: WireMessage): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg));
    }
  }

  send(msg: WireMessage): void {
    this.#send(msg);
  }

  destroy() {
    this.#destroyed = true;
    if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer);
    this.#actor.send({ type: "RESET" });
    this.#actor.stop();
    this.#ws?.close(1000, "agent shutting down");
  }
}
