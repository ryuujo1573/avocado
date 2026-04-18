# Plan: MVP Phase 1 — Connectivity

**Created:** 2026-04-19
**Status:** active
**Owner:** core team
**Related:**

- Umbrella: [MVP overview](./2026-04-19-mvp-overview.md)
- Depends on: [Phase 0 — Foundations](./2026-04-19-mvp-phase-0-foundations.md)
- Design: [docs/design-docs/connectivity.md](../../design-docs/connectivity.md)

## Goal

An agent enrolls with the backend, opens a persistent WebSocket, sends
heartbeats, and appears as **online** in the operator's dashboard within
five seconds of starting. When the agent disconnects, the dashboard reflects
**offline** within ten seconds. Reconnection is automatic with backoff.

## Non-Goals

- No WebRTC (Phase 2)
- No capabilities (shell, file transfer)
- No tags, filters, search, or fleet > 100 agents

## Approach

Implement the agent↔backend control channel only. All lifecycle logic is
driven by the `agentLinkMachine` defined in `packages/core/src/machines/`
during Phase 0 — both the agent and the backend tracker use the same
machine definition, instantiated locally. All messages cross the boundary
through `parseWireMessage` (Zod) per
[docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore).

### Backend (`projects/backend`)

- `POST /enroll` — exchanges a one-time enrollment token for an agent record
  - a long-lived agent credential. Token TTL is short.
- `GET /ws/agent` — persistent WebSocket. Authenticates via the agent
  credential. Server-side `agentLinkMachine` actor per connection.
- `GET /ws/dashboard` — operator dashboard subscription. Pushes agent
  online/offline events.
- Heartbeat: agent sends every 5 s; backend marks offline after 15 s of
  silence.
- Persists `Agent.last_seen_at` on every heartbeat.

### Agent (`projects/agent`)

- CLI flags: `--enroll <token>` (one-shot) and default run mode (uses stored
  credential).
- WebSocket client driven by `agentLinkMachine`; handles reconnect with
  exponential backoff + jitter (logic in `packages/core`, no per-runtime
  copy).
- Outbound messages validated against the protocol schemas before send.

### Frontend (`projects/frontend`)

- Login page (email + password, single seeded operator).
- Fleet page: a single table (id, hostname, status, last_seen). Subscribes
  to `/ws/dashboard` for live status; falls back to polling if WS dies.

## Steps

- [ ] Backend: `POST /enroll` with Zod request/response
- [ ] Backend: agent WS endpoint with `agentLinkMachine` actor per socket
- [ ] Backend: dashboard WS push (online/offline events)
- [ ] Backend: heartbeat timeout marks `Agent.last_seen_at` stale
- [ ] Agent: `--enroll` flag stores credential locally
- [ ] Agent: persistent WS client driven by `agentLinkMachine`
- [ ] Agent: backoff/jitter reconnection (logic in `packages/core`)
- [ ] Frontend: login page wired to backend session
- [ ] Frontend: fleet table with live status via WS subscription
- [ ] E2E test: spin up backend + one agent in CI; assert online → kill →
      offline → restart → online cycle
- [ ] Update [docs/design-docs/connectivity.md](../../design-docs/connectivity.md)
      with the finalized message sequence and timing constants

## Acceptance Criteria

- [ ] Agent transitions to online in dashboard within 5 s of start
- [ ] Killing the agent process flips it to offline within 10 s
- [ ] Restarting the agent reconnects without manual intervention
- [ ] All WebSocket inbound messages on both sides are parsed by Zod;
      malformed messages are rejected with a logged `Error` frame
- [ ] `agentLinkMachine` model-based tests cover all transitions exercised
      by the E2E test
- [ ] Demo: run `docker compose up`, run `agent --enroll <seeded token>` on
      a second machine, see it appear in the dashboard, pull the cable, see
      it disappear, restore, see it reappear

## Risks & Open Questions

- **WebSocket through corporate proxies.** Mitigation: use TLS only, fall
  back to long-poll only if it becomes an issue (out of scope for MVP).
- **Clock skew between agent and backend** affects heartbeat timing.
  Mitigation: backend uses its own clock for `last_seen_at`.
- **Thundering herd on backend restart.** Mitigation: jittered reconnect
  backoff in `packages/core`; test with 50 simulated agents.

## Decisions Log

- 2026-04-19: Heartbeat interval 5 s, offline threshold 15 s. Conservative
  defaults; tunable later under a metrics SLO.
- 2026-04-19: Dashboard fleet view uses WS push, not polling. Polling for a
  10 k-agent fleet would dominate backend load; WS scales better and we
  already maintain the connection.
