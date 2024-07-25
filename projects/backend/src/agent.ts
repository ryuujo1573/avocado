import { Hono } from "hono";
import { upgradeWebSocket } from "./adapter";
import type { UnknownAction } from "@reduxjs/toolkit";
import type { WSContext, WSEvents, WSMessageReceive } from "hono/ws";

enum WSCloseCode {
  timeout = 30000,
}

class Session implements Required<WSEvents> {
  constructor(readonly timeout: number) {}

  timeoutId?: Timer;
  onOpen(_evt: Event, ws: WSContext) {
    this.timeoutId = setTimeout(() => {
      ws.close(WSCloseCode.timeout, "Auth timeout");
    }, this.timeout);
  }
  onMessage(evt: MessageEvent<WSMessageReceive>, ws: WSContext) {
    const data = evt.data;
    try {
      if (typeof data == "string") {
        const payload = JSON.parse(data) as unknown as UnknownAction;
      }
    } finally {
    }
  }
  onClose(evt: CloseEvent, ws: WSContext) {}
  onError(evt: Event, ws: WSContext) {}
}

export const agent = new Hono()
  .post("/register", (c) => {
    return c.json({});
  })
  .get(
    "/signaling.sock",
    upgradeWebSocket((_ctx) => {
      return new Session(2000);
    }),
  );
