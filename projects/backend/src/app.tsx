import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import { upgradeWebSocket } from "./adapter";
import { PrismaClient } from "@avocado/core/orm";
import { logger } from "@avocado/core/qos";
import { parseWireMessage, type WireMessage } from "@avocado/core/protocol";
import {
  agents,
  broadcastToDashboards,
  channelSessions,
  dashboards,
  sessions,
  type AgentEntry,
} from "./state";
import {
  extractBearer,
  issueTurnCredentials,
  signJwt,
  signRefreshJwt,
  verifyJwt,
} from "./auth";
import { randomUUID } from "node:crypto";
import os from "node:os";

// ─── Init ─────────────────────────────────────────────────────────────────────

const db = new PrismaClient();

const HEARTBEAT_TIMEOUT_MS = 15_000;

function newTraceId(): string {
  return `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Rate limiting (simple in-memory token bucket) ───────────────────────────

function simpleRateLimiter(maxPerMinute: number): MiddlewareHandler {
  const counts = new Map<string, { n: number; resetAt: number }>();
  return async (c, next) => {
    const key =
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
    const now = Date.now();
    let rec = counts.get(key);
    if (!rec || rec.resetAt < now) {
      rec = { n: 0, resetAt: now + 60_000 };
      counts.set(key, rec);
    }
    rec.n++;
    if (rec.n > maxPerMinute) {
      return c.json({ error: "rate_limited" }, 429);
    }
    await next();
  };
}

const authLimiter = simpleRateLimiter(20);
const enrollLimiter = simpleRateLimiter(10);

// ─── App ──────────────────────────────────────────────────────────────────────

const app = new Hono()
  .use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }))

  // ─── Health ────────────────────────────────────────────────────────────

  .get("/healthz", async (c) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return c.json({
        status: "ok",
        db: "ok",
        agents: agents.size,
        sessions: sessions.size,
        hostname: os.hostname(),
      });
    } catch (e) {
      logger.e("healthz db check failed");
      return c.json({ status: "degraded", db: "error" }, 503);
    }
  })

  // ─── Auth ──────────────────────────────────────────────────────────────

  .post("/auth/login", authLimiter, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.email || !body?.password) {
      return c.json({ error: "email and password required" }, 400);
    }

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return c.json({ error: "invalid credentials" }, 401);
    }

    const valid = await Bun.password.verify(body.password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "invalid credentials" }, 401);
    }

    const basePayload = {
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
    } as const;
    const [accessToken, refreshToken] = await Promise.all([
      signJwt({ ...basePayload, type: "access" }),
      signRefreshJwt(basePayload),
    ]);

    return c.json({
      accessToken,
      refreshToken,
      userId: user.id,
      name: user.name,
    });
  })

  .post("/auth/refresh", async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, string>);
    const { refreshToken } = body;
    if (!refreshToken) return c.json({ error: "refreshToken required" }, 400);

    try {
      const payload = await verifyJwt(refreshToken);
      if (payload.type !== "refresh") throw new Error("not a refresh token");

      const newAccess = await signJwt({
        sub: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
        type: "access",
      });
      return c.json({ accessToken: newAccess });
    } catch {
      return c.json({ error: "invalid or expired refresh token" }, 401);
    }
  })

  // ─── Enrollment ────────────────────────────────────────────────────────

  .post("/enroll", enrollLimiter, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.token || !body?.hostname) {
      return c.json({ error: "token and hostname required" }, 400);
    }

    const tokenRow = await db.enrollmentToken.findUnique({
      where: { token: body.token },
    });

    if (!tokenRow) return c.json({ error: "invalid token" }, 401);
    if (tokenRow.usedAt) return c.json({ error: "token already used" }, 401);
    if (tokenRow.expiresAt < new Date())
      return c.json({ error: "token expired" }, 401);

    const credential = `agcred-${randomUUID()}`;

    const agent = await db.agent.create({
      data: {
        orgId: tokenRow.orgId,
        hostname: body.hostname ?? "unknown",
        os: body.os ?? "unknown",
        arch: body.arch ?? "unknown",
        credential,
      },
    });

    await db.enrollmentToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date() },
    });

    logger.i("Agent enrolled: %o (%o)", agent.id, agent.hostname);
    return c.json({ agentId: agent.id, credential });
  })

  // ─── Sessions ──────────────────────────────────────────────────────────

  .post("/sessions", async (c) => {
    const token = extractBearer(c.req.header("authorization") ?? null);
    if (!token) return c.json({ error: "unauthorized" }, 401);

    let payload: Awaited<ReturnType<typeof verifyJwt>>;
    try {
      payload = await verifyJwt(token);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}) as Record<string, string>);
    const { agentId } = body;
    if (!agentId) return c.json({ error: "agentId required" }, 400);

    const agent = await db.agent.findFirst({
      where: { id: agentId, orgId: payload.orgId },
    });
    if (!agent) return c.json({ error: "agent not found" }, 404);
    if (!agents.has(agentId)) return c.json({ error: "agent not online" }, 409);

    const sessionId = randomUUID();
    const traceId = newTraceId();
    const turn = await issueTurnCredentials(sessionId);

    await db.session.create({
      data: {
        id: sessionId,
        orgId: payload.orgId,
        agentId,
        userId: payload.sub,
        traceId,
      },
    });

    sessions.set(sessionId, {
      sessionId,
      orgId: payload.orgId,
      agentId,
      userId: payload.sub,
      traceId,
      dashWs: null,
      agentWs: agents.get(agentId)?.ws ?? null,
    });

    logger.i("[%o] Session created: agent=%o", traceId, agentId);

    return c.json({
      sessionId,
      traceId,
      turnUsername: turn.username,
      turnCredential: turn.credential,
      turnUrls: turn.urls,
    });
  })

  // ─── Agents REST ───────────────────────────────────────────────────────

  .get("/agents", async (c) => {
    const token = extractBearer(c.req.header("authorization") ?? null);
    if (!token) return c.json({ error: "unauthorized" }, 401);

    let payload: Awaited<ReturnType<typeof verifyJwt>>;
    try {
      payload = await verifyJwt(token);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }

    const agentList = await db.agent.findMany({
      where: { orgId: payload.orgId },
      select: {
        id: true,
        hostname: true,
        os: true,
        arch: true,
        status: true,
        lastSeenAt: true,
      },
    });

    return c.json({ agents: agentList });
  })

  // ─── Agent WebSocket ───────────────────────────────────────────────────

  .get(
    "/ws/agent",
    upgradeWebSocket(async (c) => {
      const credential = c.req.query("credential");
      if (!credential) {
        return {
          onOpen: (_e: unknown, ws: import("hono/ws").WSContext) =>
            ws.close(4001, "credential required"),
        };
      }

      const agentRow = await db.agent.findUnique({ where: { credential } });
      if (!agentRow) {
        return {
          onOpen: (_e: unknown, ws: import("hono/ws").WSContext) =>
            ws.close(4001, "invalid credential"),
        };
      }

      const agentId = agentRow.id;
      const orgId = agentRow.orgId;
      let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

      function resetHeartbeatTimeout(ws: import("hono/ws").WSContext) {
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        heartbeatTimeout = setTimeout(() => {
          logger.w("Heartbeat timeout — marking agent offline: %o", agentId);
          markOffline(ws);
        }, HEARTBEAT_TIMEOUT_MS);
      }

      async function markOffline(ws: import("hono/ws").WSContext) {
        agents.delete(agentId);
        await db.agent
          .update({ where: { id: agentId }, data: { status: "offline" } })
          .catch(() => {});
        broadcastToDashboards(
          orgId,
          JSON.stringify({
            kind: "agent-offline",
            agentId,
            timestamp: Date.now(),
          }),
        );
        ws.close(1001, "going away");
      }

      return {
        async onOpen(_e: unknown, ws: import("hono/ws").WSContext) {
          logger.i("Agent WS connected: %o", agentId);
          const entry: AgentEntry = {
            ws,
            agentId,
            orgId,
            hostname: agentRow.hostname,
            os: agentRow.os,
            arch: agentRow.arch,
            connectedAt: Date.now(),
            heartbeatTimer: null,
          };
          agents.set(agentId, entry);
          resetHeartbeatTimeout(ws);
        },

        async onMessage(e: MessageEvent, ws: import("hono/ws").WSContext) {
          const raw = typeof e.data === "string" ? e.data : null;
          if (!raw) return;

          let msg: WireMessage;
          try {
            msg = parseWireMessage(raw);
          } catch (err) {
            ws.send(
              JSON.stringify({
                kind: "error",
                code: "PARSE_ERROR",
                message: String(err),
              }),
            );
            return;
          }

          switch (msg.kind) {
            case "hello": {
              await db.agent.update({
                where: { id: agentId },
                data: {
                  hostname: msg.hostname,
                  os: msg.os,
                  arch: msg.arch,
                  status: "online",
                  lastSeenAt: new Date(),
                },
              });
              const entry = agents.get(agentId);
              if (entry) {
                entry.hostname = msg.hostname;
                entry.os = msg.os;
                entry.arch = msg.arch;
              }
              ws.send(
                JSON.stringify({
                  kind: "hello-ack",
                  agentId,
                  timestamp: Date.now(),
                }),
              );
              broadcastToDashboards(
                orgId,
                JSON.stringify({
                  kind: "agent-online",
                  agentId,
                  hostname: msg.hostname,
                  os: msg.os,
                  arch: msg.arch,
                  timestamp: Date.now(),
                }),
              );
              break;
            }

            case "heartbeat": {
              await db.agent.update({
                where: { id: agentId },
                data: { lastSeenAt: new Date() },
              });
              resetHeartbeatTimeout(ws);
              ws.send(
                JSON.stringify({
                  kind: "heartbeat-ack",
                  timestamp: Date.now(),
                }),
              );
              break;
            }

            // Signaling relay: agent → operator (kept for future WebRTC use)
            case "signal-answer":
            case "ice-candidate": {
              const session = sessions.get(msg.sessionId);
              if (session?.dashWs) session.dashWs.send(raw);
              break;
            }

            // Channel relay: agent → dashboard
            case "shell-output":
            case "shell-exit":
            case "channel-close":
            case "file-chunk":
            case "file-checksum":
            case "file-error": {
              const sessionId = channelSessions.get(msg.channelId);
              const session = sessionId ? sessions.get(sessionId) : null;
              if (session?.dashWs) session.dashWs.send(raw);
              break;
            }

            default:
              break;
          }
        },

        async onClose() {
          logger.i("Agent WS closed: %o", agentId);
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          agents.delete(agentId);
          await db.agent
            .update({ where: { id: agentId }, data: { status: "offline" } })
            .catch(() => {});
          broadcastToDashboards(
            orgId,
            JSON.stringify({
              kind: "agent-offline",
              agentId,
              timestamp: Date.now(),
            }),
          );
        },

        onError(e: Event) {
          logger.e("Agent WS error");
        },
      };
    }),
  )

  // ─── Dashboard WebSocket ───────────────────────────────────────────────

  .get(
    "/ws/dashboard",
    upgradeWebSocket(async (c) => {
      const token = c.req.query("token");
      if (!token) {
        return {
          onOpen: (_e: unknown, ws: import("hono/ws").WSContext) =>
            ws.close(4001, "token required"),
        };
      }

      let payload: Awaited<ReturnType<typeof verifyJwt>>;
      try {
        payload = await verifyJwt(token);
      } catch {
        return {
          onOpen: (_e: unknown, ws: import("hono/ws").WSContext) =>
            ws.close(4001, "invalid token"),
        };
      }

      const userId = payload.sub;
      const orgId = payload.orgId;

      return {
        async onOpen(_e: unknown, ws: import("hono/ws").WSContext) {
          logger.i("Dashboard WS connected: user=%o", userId);
          dashboards.set(userId, { ws, userId, orgId });

          const agentList = await db.agent.findMany({
            where: { orgId },
            select: {
              id: true,
              hostname: true,
              os: true,
              arch: true,
              status: true,
              lastSeenAt: true,
            },
          });

          ws.send(
            JSON.stringify({
              kind: "agent-list",
              agents: agentList.map((a) => ({
                id: a.id,
                hostname: a.hostname,
                os: a.os,
                arch: a.arch,
                status: a.status,
                lastSeenAt: a.lastSeenAt?.getTime() ?? null,
              })),
            }),
          );
        },

        onMessage(e: MessageEvent, ws: import("hono/ws").WSContext) {
          const raw = typeof e.data === "string" ? e.data : null;
          if (!raw) return;

          let msg: WireMessage;
          try {
            msg = parseWireMessage(raw);
          } catch (err) {
            ws.send(
              JSON.stringify({
                kind: "error",
                code: "PARSE_ERROR",
                message: String(err),
              }),
            );
            return;
          }

          switch (msg.kind) {
            // Signaling relay: operator → agent (kept for future WebRTC use)
            case "signal-offer": {
              const session = sessions.get(msg.sessionId);
              if (session) session.dashWs = ws;
              const agentWs = sessions.get(msg.sessionId)?.agentWs;
              if (agentWs) agentWs.send(raw);
              break;
            }
            case "ice-candidate": {
              const agentWs = sessions.get(msg.sessionId)?.agentWs;
              if (agentWs) agentWs.send(raw);
              break;
            }

            // Channel relay: dashboard → agent
            case "open-channel": {
              const session = sessions.get(msg.sessionId);
              if (!session) {
                ws.send(
                  JSON.stringify({
                    kind: "error",
                    code: "SESSION_NOT_FOUND",
                    message: `Session ${msg.sessionId} not found`,
                  }),
                );
                break;
              }
              session.dashWs = ws;
              channelSessions.set(msg.channelId, msg.sessionId);
              if (session.agentWs) session.agentWs.send(raw);
              break;
            }
            case "shell-input":
            case "shell-resize":
            case "channel-close": {
              const sessionId = channelSessions.get(msg.channelId);
              const agentWs = sessionId ? sessions.get(sessionId)?.agentWs : null;
              if (agentWs) agentWs.send(raw);
              break;
            }
            default:
              break;
          }
        },

        onClose() {
          logger.i("Dashboard WS closed: user=%o", userId);
          dashboards.delete(userId);
          for (const [, session] of sessions) {
            if (session.userId === userId) session.dashWs = null;
          }
          // Clean up channel→session mappings for this user's sessions
          for (const [channelId, sessionId] of channelSessions) {
            const session = sessions.get(sessionId);
            if (session?.userId === userId) channelSessions.delete(channelId);
          }
        },

        onError() {
          logger.e("Dashboard WS error");
        },
      };
    }),
  );

export default app;
export type App = typeof app;
