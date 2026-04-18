import { assign, createMachine } from "xstate";

// ─── agentLinkMachine ────────────────────────────────────────────────────────
// Drives the agent's persistent WebSocket lifecycle.
// Used identically by the agent process and by the backend tracker actor.

export type AgentLinkContext = {
  agentId: string | null;
  retryCount: number;
  retryDelayMs: number;
  lastError: string | null;
};

export type AgentLinkEvent =
  | { type: "CONNECT" }
  | { type: "CONNECTED" }
  | { type: "HELLO_ACK"; agentId: string }
  | { type: "HEARTBEAT" }
  | { type: "DISCONNECT"; reason?: string }
  | { type: "ERROR"; error: string }
  | { type: "RETRY" }
  | { type: "RESET" };

export const agentLinkMachine = createMachine({
  id: "agentLink",
  types: {} as {
    context: AgentLinkContext;
    events: AgentLinkEvent;
  },
  initial: "disconnected",
  context: {
    agentId: null,
    retryCount: 0,
    retryDelayMs: 1000,
    lastError: null,
  },
  states: {
    disconnected: {
      on: {
        CONNECT: "connecting",
      },
    },
    connecting: {
      on: {
        CONNECTED: "handshaking",
        ERROR: {
          target: "reconnecting",
          actions: assign({
            lastError: ({ event }) => event.error,
          }),
        },
        RESET: "disconnected",
      },
    },
    handshaking: {
      on: {
        HELLO_ACK: {
          target: "online",
          actions: assign({
            agentId: ({ event }) => event.agentId,
            retryCount: 0,
            retryDelayMs: 1000,
            lastError: null,
          }),
        },
        ERROR: {
          target: "reconnecting",
          actions: assign({
            lastError: ({ event }) => event.error,
          }),
        },
        DISCONNECT: "reconnecting",
      },
    },
    online: {
      on: {
        HEARTBEAT: "online",
        DISCONNECT: {
          target: "reconnecting",
          actions: assign({
            lastError: ({ event }) => event.reason ?? "disconnected",
          }),
        },
        ERROR: {
          target: "reconnecting",
          actions: assign({
            lastError: ({ event }) => event.error,
          }),
        },
        RESET: {
          target: "disconnected",
          actions: assign({
            agentId: null,
            retryCount: 0,
            retryDelayMs: 1000,
            lastError: null,
          }),
        },
      },
    },
    reconnecting: {
      on: {
        RETRY: {
          target: "connecting",
          actions: assign({
            retryCount: ({ context }) => context.retryCount + 1,
            retryDelayMs: ({ context }) =>
              Math.min(context.retryDelayMs * 2, 30_000),
          }),
        },
        RESET: {
          target: "disconnected",
          actions: assign({
            agentId: null,
            retryCount: 0,
            retryDelayMs: 1000,
            lastError: null,
          }),
        },
      },
    },
  },
});

// ─── sessionMachine ──────────────────────────────────────────────────────────
// Operator↔agent session lifecycle.

export type SessionContext = {
  sessionId: string | null;
  agentId: string | null;
  userId: string | null;
  traceId: string | null;
  error: string | null;
};

export type SessionEvent =
  | { type: "CREATE"; agentId: string; userId: string }
  | { type: "CREATED"; sessionId: string; traceId: string }
  | { type: "OPEN" }
  | { type: "CLOSE"; reason?: string }
  | { type: "ERROR"; error: string }
  | { type: "TIMEOUT" };

export const sessionMachine = createMachine({
  id: "session",
  types: {} as {
    context: SessionContext;
    events: SessionEvent;
  },
  initial: "idle",
  context: {
    sessionId: null,
    agentId: null,
    userId: null,
    traceId: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        CREATE: {
          target: "creating",
          actions: assign({
            agentId: ({ event }) => event.agentId,
            userId: ({ event }) => event.userId,
          }),
        },
      },
    },
    creating: {
      on: {
        CREATED: {
          target: "active",
          actions: assign({
            sessionId: ({ event }) => event.sessionId,
            traceId: ({ event }) => event.traceId,
          }),
        },
        ERROR: {
          target: "closed",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        TIMEOUT: "closed",
      },
    },
    active: {
      on: {
        CLOSE: "closing",
        ERROR: {
          target: "closed",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    closing: {
      on: {
        CLOSE: "closed",
        ERROR: "closed",
      },
    },
    closed: {
      type: "final",
    },
  },
});

// ─── connectionMachine ───────────────────────────────────────────────────────
// WebRTC RTCPeerConnection lifecycle.

export type ConnectionContext = {
  sessionId: string | null;
  iceState: string | null;
  dtlsState: string | null;
  error: string | null;
  restartCount: number;
};

export type ConnectionEvent =
  | { type: "START"; sessionId: string }
  | { type: "OFFER_CREATED" }
  | { type: "ANSWER_RECEIVED" }
  | { type: "ICE_GATHERING_COMPLETE" }
  | { type: "ICE_CONNECTED" }
  | { type: "ICE_FAILED" }
  | { type: "ICE_RESTART" }
  | { type: "DTLS_CONNECTED" }
  | { type: "CHANNEL_OPEN" }
  | { type: "DISCONNECT" }
  | { type: "ERROR"; error: string }
  | { type: "CLOSE" };

export const connectionMachine = createMachine({
  id: "connection",
  types: {} as {
    context: ConnectionContext;
    events: ConnectionEvent;
  },
  initial: "idle",
  context: {
    sessionId: null,
    iceState: null,
    dtlsState: null,
    error: null,
    restartCount: 0,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "signaling",
          actions: assign({
            sessionId: ({ event }) => event.sessionId,
          }),
        },
      },
    },
    signaling: {
      initial: "gathering",
      states: {
        gathering: {
          on: {
            ICE_GATHERING_COMPLETE: "negotiating",
            ERROR: {
              target: "#connection.failed",
              actions: assign({
                error: ({ event }) => event.error,
              }),
            },
          },
        },
        negotiating: {
          on: {
            ICE_CONNECTED: "#connection.connecting",
            ICE_FAILED: "#connection.failed",
            ERROR: {
              target: "#connection.failed",
              actions: assign({
                error: ({ event }) => event.error,
              }),
            },
          },
        },
      },
    },
    connecting: {
      on: {
        CHANNEL_OPEN: "connected",
        DISCONNECT: "failed",
        ERROR: {
          target: "failed",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    connected: {
      on: {
        DISCONNECT: "failed",
        ICE_FAILED: {
          target: "restarting",
          guard: ({ context }) => context.restartCount < 3,
        },
        ERROR: {
          target: "failed",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        CLOSE: "closed",
      },
    },
    restarting: {
      entry: assign({
        restartCount: ({ context }) => context.restartCount + 1,
      }),
      on: {
        ICE_CONNECTED: "connected",
        ICE_FAILED: "failed",
        ERROR: "failed",
      },
    },
    failed: {
      on: {
        CLOSE: "closed",
      },
    },
    closed: {
      type: "final",
    },
  },
});

// ─── channelMachine ──────────────────────────────────────────────────────────
// Generic capability channel (shell, file, etc.) over RTCDataChannel.

export type ChannelContext = {
  channelId: string | null;
  kind: string | null;
  error: string | null;
  bytesSent: number;
  bytesReceived: number;
};

export type ChannelEvent =
  | { type: "OPEN"; channelId: string; kind: string }
  | { type: "DATA"; bytes: number }
  | { type: "SEND"; bytes: number }
  | { type: "CLOSE"; reason?: string }
  | { type: "ERROR"; error: string };

export const channelMachine = createMachine({
  id: "channel",
  types: {} as {
    context: ChannelContext;
    events: ChannelEvent;
  },
  initial: "opening",
  context: {
    channelId: null,
    kind: null,
    error: null,
    bytesSent: 0,
    bytesReceived: 0,
  },
  states: {
    opening: {
      on: {
        OPEN: {
          target: "open",
          actions: assign({
            channelId: ({ event }) => event.channelId,
            kind: ({ event }) => event.kind,
          }),
        },
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
        CLOSE: "closed",
      },
    },
    open: {
      on: {
        DATA: {
          target: "open",
          actions: assign({
            bytesReceived: ({ context, event }) =>
              context.bytesReceived + event.bytes,
          }),
        },
        SEND: {
          target: "open",
          actions: assign({
            bytesSent: ({ context, event }) => context.bytesSent + event.bytes,
          }),
        },
        CLOSE: "closing",
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    closing: {
      on: {
        CLOSE: "closed",
        ERROR: "closed",
      },
    },
    error: {
      on: {
        CLOSE: "closed",
      },
    },
    closed: {
      type: "final",
    },
  },
});

// ─── Backpressure helper ─────────────────────────────────────────────────────
// Shared algorithm used by both agent and frontend.

export const BACKPRESSURE_HIGH_WATERMARK = 256 * 1024; // 256 KiB
export const BACKPRESSURE_LOW_WATERMARK = 64 * 1024; // 64 KiB
export const CHUNK_SIZE = 64 * 1024; // 64 KiB

export function shouldPause(bufferedAmount: number): boolean {
  return bufferedAmount > BACKPRESSURE_HIGH_WATERMARK;
}

export function shouldResume(bufferedAmount: number): boolean {
  return bufferedAmount <= BACKPRESSURE_LOW_WATERMARK;
}

// ─── Reconnect backoff ───────────────────────────────────────────────────────
// Shared algorithm: exponential backoff with full jitter.

export function nextRetryDelay(retryCount: number): number {
  const base = Math.min(1000 * 2 ** retryCount, 30_000);
  return Math.floor(Math.random() * base);
}
