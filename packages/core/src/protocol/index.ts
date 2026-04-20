import { z } from "zod";

// ─── Version ────────────────────────────────────────────────────────────────

export const PROTOCOL_VERSION = 1;

// ─── Base messages ──────────────────────────────────────────────────────────

export const Hello = z.object({
  kind: z.literal("hello"),
  version: z.number(),
  agentId: z.string(),
  hostname: z.string(),
  os: z.string(),
  arch: z.string(),
});

export const HelloAck = z.object({
  kind: z.literal("hello-ack"),
  agentId: z.string(),
  timestamp: z.number(),
});

export const Heartbeat = z.object({
  kind: z.literal("heartbeat"),
  timestamp: z.number(),
});

export const HeartbeatAck = z.object({
  kind: z.literal("heartbeat-ack"),
  timestamp: z.number(),
});

export const WireError = z.object({
  kind: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

// ─── Signaling messages ─────────────────────────────────────────────────────

export const SignalOffer = z.object({
  kind: z.literal("signal-offer"),
  sessionId: z.string(),
  sdp: z.string(),
});

export const SignalAnswer = z.object({
  kind: z.literal("signal-answer"),
  sessionId: z.string(),
  sdp: z.string(),
});

export const IceCandidate = z.object({
  kind: z.literal("ice-candidate"),
  sessionId: z.string(),
  candidate: z.string(),
  sdpMid: z.string().nullable(),
  sdpMLineIndex: z.number().nullable(),
});

// ─── Channel messages ────────────────────────────────────────────────────────

export const ShellCapability = z.object({
  kind: z.literal("shell"),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  cwd: z.string().optional(),
});

export const FileUploadCapability = z.object({
  kind: z.literal("file-upload"),
  path: z.string(),
  size: z.number(),
  sha256: z.string(),
});

export const FileDownloadCapability = z.object({
  kind: z.literal("file-download"),
  path: z.string(),
});

export type FileUploadCapability = z.infer<typeof FileUploadCapability>;
export type FileDownloadCapability = z.infer<typeof FileDownloadCapability>;

// Note: the protocol doesn't currently support capabilities other than shell/file,
// but we use a discriminated union here to allow for future extensibility.

export const OpenChannel = z.object({
  kind: z.literal("open-channel"),
  channelId: z.string(),
  sessionId: z.string(),
  capability: z.discriminatedUnion("kind", [
    ShellCapability,
    FileUploadCapability,
    FileDownloadCapability,
  ]),
});

export const ChannelData = z.object({
  kind: z.literal("channel-data"),
  channelId: z.string(),
  data: z.string(), // base64
});

export const ChannelClose = z.object({
  kind: z.literal("channel-close"),
  channelId: z.string(),
  reason: z.string().optional(),
});

// ─── Shell frames ────────────────────────────────────────────────────────────

export const ShellInput = z.object({
  kind: z.literal("shell-input"),
  channelId: z.string(),
  data: z.string(), // base64
});

export const ShellOutput = z.object({
  kind: z.literal("shell-output"),
  channelId: z.string(),
  data: z.string(), // base64
});

export const ShellResize = z.object({
  kind: z.literal("shell-resize"),
  channelId: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const ShellExit = z.object({
  kind: z.literal("shell-exit"),
  channelId: z.string(),
  code: z.number(),
  signal: z.string().optional(),
});

// ─── File frames ─────────────────────────────────────────────────────────────

export const FileChunk = z.object({
  kind: z.literal("file-chunk"),
  channelId: z.string(),
  seq: z.number().int().nonnegative(),
  data: z.string(), // base64
});

export const FileChecksum = z.object({
  kind: z.literal("file-checksum"),
  channelId: z.string(),
  sha256: z.string(),
});

export const FileError = z.object({
  kind: z.literal("file-error"),
  channelId: z.string(),
  code: z.string(),
  message: z.string(),
});

// ─── Dashboard events (backend → dashboard WS) ───────────────────────────────

export const AgentOnline = z.object({
  kind: z.literal("agent-online"),
  agentId: z.string(),
  hostname: z.string(),
  os: z.string(),
  arch: z.string(),
  timestamp: z.number(),
});

export const AgentOffline = z.object({
  kind: z.literal("agent-offline"),
  agentId: z.string(),
  timestamp: z.number(),
});

export const AgentList = z.object({
  kind: z.literal("agent-list"),
  agents: z.array(
    z.object({
      id: z.string(),
      hostname: z.string(),
      os: z.string(),
      arch: z.string(),
      status: z.enum(["online", "offline"]),
      lastSeenAt: z.number().nullable(),
    }),
  ),
});

// ─── Session control ─────────────────────────────────────────────────────────

export const OpenSession = z.object({
  kind: z.literal("open-session"),
  sessionId: z.string(),
  agentId: z.string(),
  turnUsername: z.string(),
  turnCredential: z.string(),
  turnUrls: z.array(z.string()),
});

// ─── Top-level discriminated union ───────────────────────────────────────────

export const WireMessage = z.discriminatedUnion("kind", [
  Hello,
  HelloAck,
  Heartbeat,
  HeartbeatAck,
  WireError,
  SignalOffer,
  SignalAnswer,
  IceCandidate,
  OpenChannel,
  ChannelData,
  ChannelClose,
  ShellInput,
  ShellOutput,
  ShellResize,
  ShellExit,
  FileChunk,
  FileChecksum,
  FileError,
  AgentOnline,
  AgentOffline,
  AgentList,
  OpenSession,
]);

export type WireMessage = z.infer<typeof WireMessage>;
export type Hello = z.infer<typeof Hello>;
export type HelloAck = z.infer<typeof HelloAck>;
export type Heartbeat = z.infer<typeof Heartbeat>;
export type HeartbeatAck = z.infer<typeof HeartbeatAck>;
export type WireError = z.infer<typeof WireError>;
export type SignalOffer = z.infer<typeof SignalOffer>;
export type SignalAnswer = z.infer<typeof SignalAnswer>;
export type IceCandidate = z.infer<typeof IceCandidate>;
export type OpenChannel = z.infer<typeof OpenChannel>;
export type ChannelData = z.infer<typeof ChannelData>;
export type ChannelClose = z.infer<typeof ChannelClose>;
export type ShellInput = z.infer<typeof ShellInput>;
export type ShellOutput = z.infer<typeof ShellOutput>;
export type ShellResize = z.infer<typeof ShellResize>;
export type ShellExit = z.infer<typeof ShellExit>;
export type FileChunk = z.infer<typeof FileChunk>;
export type FileChecksum = z.infer<typeof FileChecksum>;
export type FileError = z.infer<typeof FileError>;
export type AgentOnline = z.infer<typeof AgentOnline>;
export type AgentOffline = z.infer<typeof AgentOffline>;
export type AgentList = z.infer<typeof AgentList>;
export type OpenSession = z.infer<typeof OpenSession>;

// ─── Parse helper ────────────────────────────────────────────────────────────

/**
 * The only sanctioned ingress point for wire messages.
 * Throws a Zod error if the message is malformed.
 */
export function parseWireMessage(raw: unknown): WireMessage {
  if (typeof raw === "string") {
    return WireMessage.parse(JSON.parse(raw));
  }
  return WireMessage.parse(raw);
}

/**
 * Safe parse — returns null instead of throwing on invalid input.
 */
export function safeParseWireMessage(raw: unknown): WireMessage | null {
  try {
    return parseWireMessage(raw);
  } catch {
    return null;
  }
}
