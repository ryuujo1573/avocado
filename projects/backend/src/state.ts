/**
 * In-memory connection registry.
 * Holds live WebSocket handles for agents and dashboard subscribers.
 */

import type { WSContext } from "hono/ws";

export type AgentEntry = {
  ws: WSContext;
  agentId: string;
  orgId: string;
  hostname: string;
  os: string;
  arch: string;
  connectedAt: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
};

export type DashboardEntry = {
  ws: WSContext;
  userId: string;
  orgId: string;
};

export type SessionEntry = {
  sessionId: string;
  orgId: string;
  agentId: string;
  userId: string;
  traceId: string;
  /** ws belonging to the dashboard operator */
  dashWs: WSContext | null;
  /** ws belonging to the agent */
  agentWs: WSContext | null;
};

// keyed by agentId
export const agents = new Map<string, AgentEntry>();

// keyed by userId
export const dashboards = new Map<string, DashboardEntry>();

// keyed by sessionId
export const sessions = new Map<string, SessionEntry>();

// keyed by channelId → sessionId (for routing agent→dashboard messages)
export const channelSessions = new Map<string, string>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function broadcastToDashboards(orgId: string, data: string): void {
  for (const entry of dashboards.values()) {
    if (entry.orgId === orgId) {
      entry.ws.send(data);
    }
  }
}

export function findAgentWs(agentId: string): WSContext | null {
  return agents.get(agentId)?.ws ?? null;
}
