# AGENTS.md — Avocado Repository Guide

This file is the **entry point** for all agents working in this repository.
Keep it short (~100 lines). Deep details live in `docs/` — follow the pointers below.

---

## What This Project Is

**Avocado** is a WebRTC-based SDK and application suite for:

- Video & audio calls
- Remote desktop control
- Remote file transfer

Architecture overview: see [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Repository Layout

```
packages/
  core/          — Core SDK (TypeScript, Vite, Prisma)
  netstat/       — Network stats native addon (Rust / NAPI)
projects/
  agent/         — Agent process (registers to server, exposes capabilities)
  backend/       — Signaling server + REST API (Hono / Vite SSR)
  frontend/      — Web UI (Qwik, Tailwind)
docs/            — System of record for all design & product knowledge
```

Monorepo managed with **Bun workspaces**. Toolchain: TypeScript 6, Vite 8, Vitest 4, Biome 2.

---

## Key Entry Points in `docs/`

| Topic                                  | Location                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Architecture & package layering        | [ARCHITECTURE.md](./ARCHITECTURE.md)                                           |
| Design principles & core beliefs       | [docs/design-docs/core-beliefs.md](./docs/design-docs/core-beliefs.md)         |
| Design doc index                       | [docs/design-docs/index.md](./docs/design-docs/index.md)                       |
| Product specs index                    | [docs/product-specs/index.md](./docs/product-specs/index.md)                   |
| Active execution plans                 | [docs/exec-plans/active/](./docs/exec-plans/active/)                           |
| Completed execution plans              | [docs/exec-plans/completed/](./docs/exec-plans/completed/)                     |
| Known tech debt                        | [docs/exec-plans/tech-debt-tracker.md](./docs/exec-plans/tech-debt-tracker.md) |
| Frontend conventions                   | [docs/FRONTEND.md](./docs/FRONTEND.md)                                         |
| Security requirements                  | [docs/SECURITY.md](./docs/SECURITY.md)                                         |
| Reliability requirements               | [docs/RELIABILITY.md](./docs/RELIABILITY.md)                                   |
| Quality grades                         | [docs/QUALITY_SCORE.md](./docs/QUALITY_SCORE.md)                               |
| Product sense & UX principles          | [docs/PRODUCT_SENSE.md](./docs/PRODUCT_SENSE.md)                               |
| External reference docs (LLM-friendly) | [docs/references/](./docs/references/)                                         |
| Generated artifacts (DB schema, types) | [docs/generated/](./docs/generated/)                                           |

---

## Operating Principles

1. **Repository is the system of record.** Knowledge in Slack, Google Docs, or
   conversation threads is illegible to agents. Encode decisions here.

2. **Follow the layering rules.** Dependency direction within each domain is
   enforced by linters. See [ARCHITECTURE.md](./ARCHITECTURE.md).

3. **Parse at the boundary.** Validate external data shapes on ingress (prefer Zod).
   Never build logic on guessed shapes.

4. **Plan before large changes.** Non-trivial work gets an execution plan in
   `docs/exec-plans/active/`. See [docs/PLANS.md](./docs/PLANS.md) for format.

5. **Update docs alongside code.** CI validates cross-links and freshness.
   Stale docs are a bug.

6. **Structured logging only.** No `console.log`. Use the project logger.

7. **No hand-rolled utilities that belong in `packages/core`.** Central
   invariants live in shared packages.

---

## Development Commands

```bash
bun run core   # work in packages/core
bun run agent  # work in projects/agent
bun run api    # work in projects/backend
bun run app    # work in projects/frontend
```

Linting & formatting: `bunx biome check --write .`

---

## When You Are Stuck

- Missing architectural context → read [ARCHITECTURE.md](./ARCHITECTURE.md)
- Missing product context → read [docs/product-specs/index.md](./docs/product-specs/index.md)
- Failing lint that you don't understand → read the lint error message carefully;
  remediation hints are embedded
- Unclear quality bar → read [docs/QUALITY_SCORE.md](./docs/QUALITY_SCORE.md)
- Uncertain about a design decision → check [docs/design-docs/index.md](./docs/design-docs/index.md)
  before inventing a new pattern
