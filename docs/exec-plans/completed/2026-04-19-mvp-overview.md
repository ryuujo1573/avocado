# Plan: MVP — Remote Access Center (Umbrella)

**Created:** 2026-04-19
**Status:** completed
**Owner:** core team
**Related:**
- Spec: [docs/product-specs/remote-access-center.md](../../product-specs/remote-access-center.md)
- Architecture: [ARCHITECTURE.md](../../../ARCHITECTURE.md)
- Design: [docs/design-docs/connectivity.md](../../design-docs/connectivity.md)
- Phase plans:
  - [Phase 0 — Foundations](../completed/2026-04-19-mvp-phase-0-foundations.md)
  - [Phase 1 — Connectivity](../completed/2026-04-19-mvp-phase-1-connectivity.md)
  - [Phase 2 — Signaling & WebRTC Transport](../completed/2026-04-19-mvp-phase-2-signaling-transport.md)
  - [Phase 3 — Remote Shell](../completed/2026-04-19-mvp-phase-3-remote-shell.md)
  - [Phase 4 — File Transfer](../completed/2026-04-19-mvp-phase-4-file-transfer.md)
  - [Phase 5 — Hardening & Ship](../completed/2026-04-19-mvp-phase-5-hardening.md)

## Goal

Ship the thinnest credible vertical slice of the Remote Access Center: a single
operator, on a single org, can reliably register an agent across NAT, see it
online in the dashboard, open a remote shell, and transfer a file — all
through the cloud control plane. This proves the entire architecture
end-to-end before any breadth work (fleets, metrics, plugins, RBAC) begins.

## Non-Goals

The following capabilities from
[remote-access-center.md](../../product-specs/remote-access-center.md) are
explicitly **out of scope** for the MVP. Each is to be re-opened as a
post-MVP plan.

- Remote desktop (screen capture / input injection)
- Metrics ingestion, ClickHouse, alerting
- Background jobs (ad-hoc, scheduled, event-driven)
- OTA plugin system and WASM sandbox
- Multi-tenancy beyond a single seeded org row
- RBAC (Viewer / Operator / Admin / Owner) — everyone is Operator
- Windows agent (MVP targets macOS + Linux)
- Mobile clients, plugin marketplace, billing
- File transfer resume; directory browsing
- Tags, filters, custom views in fleet UI

Schemas keep `org_id` columns from day one so multi-tenancy can be added
without a data migration.

## Approach

Five sequential, independently-demoable phases preceded by a foundations
phase. Each phase is a **vertical slice** — it touches every layer needed to
prove the slice end-to-end. Layers are not built in isolation.

Touched packages/projects across the MVP:

- `packages/core` — protocol schemas (Zod), state machines (XState v5), shared
  invariants. See [docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore).
- `projects/backend` — Hono REST + WS signaling, Postgres via Prisma.
- `projects/agent` — persistent WS client, WebRTC peer, capability handlers.
- `projects/frontend` — Qwik dashboard, login, shell, file transfer UI.
- Ops — `docker-compose.yml` shipping backend + Postgres + coturn.

## Steps

- [x] Phase 0 complete (foundations)
- [x] Phase 1 complete (connectivity)
- [x] Phase 2 complete (signaling + WebRTC)
- [x] Phase 3 complete (remote shell)
- [x] Phase 4 complete (file transfer)
- [x] Phase 5 complete (hardening + ship)

## Acceptance Criteria

The MVP is done when this scripted demo, run on a fresh checkout, succeeds
ten times in a row with two real machines behind separate NATs:

```
git clone … && docker compose up -d        # control plane up
./agent --enroll <token>                    # second machine, behind NAT
# Dashboard:
#   - log in as the seeded operator
#   - see the agent flip to online within 5 s
#   - click "Shell" → type commands → see live output
#   - click "Upload" → drop a 500 MB file → checksum matches on agent
#   - pull the agent's network cable → UI shows offline within 10 s
#   - restore network → agent reconnects, a new session works
```

If that script is reproducible, the MVP ships.

## Risks & Open Questions

- **TURN reliability across hostile networks.** Mitigation: Phase 2 forces a
  relay-only test in CI.
- **WebRTC reconnection edge cases** (renegotiation, ICE restart). Mitigation:
  encode the connection lifecycle in an XState machine in `packages/core`;
  exhaustively test with `@xstate/test`.
- **PTY portability** between macOS and Linux agents. Mitigation: pick one
  PTY library known to support both; defer Windows.
- **Backpressure on DataChannels** for the 500 MB file demo. Mitigation:
  Phase 4 implements `bufferedAmountLowThreshold` flow control and load-tests
  it.
- **Single-org assumption leaking into code.** Mitigation: every query takes
  `org_id`; lint rule rejects queries without it (filed during Phase 0).

## Decisions Log

- 2026-04-19: Picked **remote shell** before remote desktop as the first
  capability. Shell exercises the same end-to-end pipeline at a fraction of
  the implementation cost; desktop becomes "another capability" once the
  pipeline is proven.
- 2026-04-19: **XState v5** chosen for session/connection lifecycle;
  **Zod** for wire-protocol schemas. Both live in `packages/core` so the
  agent, backend, and frontend run identical algorithms. See
  [docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore)
  for the standing rules.
- 2026-04-19: Deferred OTA plugins entirely; capabilities ship in-tree in the
  agent. The WASM sandbox is the highest-risk subsystem and would dominate
  the MVP timeline.
- 2026-04-19: Deferred Windows agent. macOS + Linux only for MVP. Re-open
  once the protocol is stable.
