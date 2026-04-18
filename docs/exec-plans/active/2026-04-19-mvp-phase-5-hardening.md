# Plan: MVP Phase 5 — Hardening & Ship

**Created:** 2026-04-19
**Status:** active
**Owner:** core team
**Related:**

- Umbrella: [MVP overview](./2026-04-19-mvp-overview.md)
- Depends on: [Phase 4 — File Transfer](./2026-04-19-mvp-phase-4-file-transfer.md)
- Reference: [docs/SECURITY.md](../../SECURITY.md), [docs/RELIABILITY.md](../../RELIABILITY.md)

## Goal

Take the working vertical slice from Phases 1–4 and turn it into something
that can be deployed and demoed by an outside engineer from a clean
checkout. Auth is hardened, observability is real, the deploy story is one
command, and the MVP demo passes ten times in a row across two real NATs.

## Non-Goals

- No new capabilities or product features
- No multi-tenancy, RBAC, metrics, plugins, or jobs (still post-MVP)

## Approach

Three workstreams, executed in parallel where possible.

### Security pass

Audit the existing surface against
[docs/SECURITY.md](../../SECURITY.md):

- TLS termination on backend (configurable cert path; documented in
  README).
- JWT rotation: short access tokens + refresh; refresh on the dashboard
  WS reconnect path.
- Enrollment-token TTL enforced (already in Phase 1; verify under load).
- Per-route rate limiting on `POST /enroll`, `POST /sessions`, login.
- CSRF token on dashboard mutations.
- Capability authorization checked on `OpenChannel` server-side, not just
  client-side.
- Path-traversal regression test for file capability.
- Dependency audit (`bun audit`) gated in CI.

### Observability

- Structured logger implementations finalized for each project (interface
  defined in `packages/core` during Phase 0).
- Per-session **trace ID** generated at session creation, propagated
  through every backend log line, every signaling frame, and every agent
  log line related to that session. Demo: one `grep` on a trace ID
  reconstructs the full session story.
- Health endpoint `/healthz` on backend reports DB + WS subsystem status.
- Backend logs structured request access lines (method, path, status,
  duration, trace ID).

### Tests & demo

- Playwright E2E suite covers the umbrella demo script: enroll →
  dashboard online → shell session → file transfer → disconnect →
  reconnect.
- Soak test: 1-hour continuous shell session keeps RTT stable and
  produces zero errors.
- The umbrella **demo script** runs in CI nightly against the full
  Compose stack and asserts the ten-of-ten pass rate.

### Deploy & docs

- One `docker-compose.yml` brings up backend + Postgres + coturn with
  sane defaults (self-signed certs in dev, externally-issued in prod via
  env vars).
- `make demo` (or `bun run demo`) seeds an org + operator + enrollment
  token and prints the agent CLI command.
- README quickstart updated with the demo script.
- Update [docs/QUALITY_SCORE.md](../../QUALITY_SCORE.md) entry for the
  MVP slice.
- Move the umbrella plan and all six phase plans to
  [docs/exec-plans/completed/](../completed/) once acceptance criteria
  are met. Re-link from [docs/design-docs/index.md](../../design-docs/index.md)
  if any new design docs were added (e.g., `state-management.md`).

## Steps

- [ ] Security: TLS, JWT rotation, rate limits, CSRF, capability authz,
      path-traversal regression
- [ ] CI: `bun audit` gate
- [ ] Logger implementations finalized in each project
- [ ] Trace-ID propagation across backend, agent, and frontend logs
- [ ] `/healthz` endpoint
- [ ] Playwright E2E suite for the umbrella demo
- [ ] 1-hour soak test in CI
- [ ] `docker-compose.yml` polished; README quickstart updated
- [ ] `make demo` script seeds and prints agent CLI command
- [ ] Move plans to `completed/`; update indexes
- [ ] Tech-debt items from MVP cuts filed in
      [tech-debt-tracker.md](../tech-debt-tracker.md)

## Acceptance Criteria

- [ ] Umbrella demo script runs successfully ten times in a row on a
      fresh checkout
- [ ] No `console.log` calls anywhere in the codebase (lint rule)
- [ ] All `POST` routes that change state are rate-limited
- [ ] Capability authorization is checked server-side; fuzz test
      confirms an unauthorized operator cannot open a channel to an
      agent in a different (future-multi-tenant) org row
- [ ] One trace ID `grep` reconstructs an entire session lifecycle
      across all three runtimes
- [ ] Soak: 60-minute shell session reports < 1% RTT variance and zero
      protocol errors
- [ ] Demo: a teammate (or AI agent) clones the repo, runs
      `docker compose up`, runs `make demo`, runs the agent CLI on a
      second machine, and completes the umbrella demo without consulting
      the implementer

## Risks & Open Questions

- **Self-signed cert UX in dev.** Mitigation: document the trust step;
  use mkcert in the README quickstart.
- **Coturn cert renewal in prod.** Mitigation: out of scope for MVP
  (manual rotation), but file as tech debt with an explicit pointer to a
  follow-up plan.
- **Soak test flakiness in CI.** Mitigation: run nightly, not per PR;
  failures open an automated issue.

## Decisions Log

- 2026-04-19: One trace ID per session, propagated everywhere. Anything
  less and on-call debugging across three runtimes becomes archaeology.
- 2026-04-19: The umbrella demo script is the authoritative definition of
  "MVP shipped." If it's flaky, the MVP isn't shipped — period.
