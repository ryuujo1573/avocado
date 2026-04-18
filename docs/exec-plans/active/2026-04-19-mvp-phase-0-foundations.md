# Plan: MVP Phase 0 — Foundations

**Created:** 2026-04-19
**Status:** active
**Owner:** core team
**Related:**

- Umbrella: [MVP overview](./2026-04-19-mvp-overview.md)
- Architecture: [ARCHITECTURE.md](../../../ARCHITECTURE.md)
- Standing guidance: [docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore)

## Goal

Lock the cross-runtime contracts before any feature work begins. After this
phase, the agent, backend, and frontend can all import a single source of
truth for wire-protocol shapes, lifecycle state machines, and the data model.
No feature code is written; the deliverable is a typed, validated, testable
skeleton that subsequent phases plug into without arguing about message
formats or state semantics.

## Non-Goals

- No business logic (no signaling, no capabilities, no UI flows)
- No production hardening (auth flows, rate limits — Phase 5)
- No deployment artifacts beyond what CI needs

## Approach

Establish three load-bearing primitives in `packages/core`, each with the
discipline that
[docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore)
mandates.

### 1. Wire-protocol schemas (Zod)

- New subpath: `packages/core/src/protocol/`
- One Zod schema per message kind (`Hello`, `Heartbeat`, `SignalOffer`,
  `SignalAnswer`, `IceCandidate`, `OpenChannel`, `ChannelData`,
  `ChannelClose`, `Error`).
- A top-level `WireMessage` discriminated union keyed on `kind`.
- All TS types are derived: `export type Hello = z.infer<typeof Hello>`. No
  parallel hand-written interfaces.
- A `parseWireMessage(raw: unknown): WireMessage` helper is the only sanctioned
  ingress point.
- Schema version constant exported (`PROTOCOL_VERSION = 1`). Any future
  breaking change bumps it.
- Add subpath export `"./protocol"` in `packages/core/package.json`.

### 2. State machines (XState v5)

- New subpath: `packages/core/src/machines/`
- Add `xstate@^5` to `packages/core` dependencies. Remove `redux` and
  `@reduxjs/toolkit` from `packages/core/package.json` — they are unused and
  conflict with the chosen methodology.
- Define skeleton machines (states + transitions only; actions stubbed):
  - `agentLinkMachine` — agent's persistent WS lifecycle
    (`disconnected → connecting → handshaking → online → reconnecting`).
  - `sessionMachine` — operator↔agent session lifecycle.
  - `connectionMachine` — WebRTC `RTCPeerConnection` lifecycle (parallel
    regions for signaling, ICE, DTLS).
  - `channelMachine` — generic capability channel
    (`opening → open → closing → closed | error`).
- All `send()` inputs are typed against the Zod-derived event union. A
  `parseAndSend(actor, raw)` helper enforces validation at the boundary.
- One `@xstate/test` model-based test per machine, even if trivial. They will
  be filled out as later phases add transitions.
- Add subpath export `"./machines"`.

### 3. Data model (Prisma)

- Extend `packages/core/src/prisma/schema.prisma` with: `Org`, `User`,
  `Agent`, `EnrollmentToken`, `Session`. Every table that is not `Org`
  carries `org_id` from day one.
- A seed script creates one org + one operator user for local dev.

### 4. Cross-cutting

- Add a dependency-direction lint rule: files under `packages/**` may not
  import from `projects/**`. Use `dependency-cruiser` or a Biome rule —
  whichever lands cleanest.
- Define a minimal `Logger` interface in `packages/core/src/ports.ts`. Each
  project supplies its own implementation; no logger impl in core.
- Wire `vitest` so `packages/core` tests run in CI alongside biome and
  typecheck.

## Steps

- [ ] Add `xstate@^5` to `packages/core`; remove `redux` + `@reduxjs/toolkit`
- [ ] Add `zod` to `packages/core` (peer-safe version)
- [ ] Create `packages/core/src/protocol/` with all message schemas + version
      constant + `parseWireMessage`
- [ ] Create `packages/core/src/machines/` with the four skeleton machines
- [ ] Add `@xstate/test` and one model-based test per machine
- [ ] Define `Logger` and `Transport` ports in `packages/core/src/ports.ts`
- [ ] Update Prisma schema with `Org / User / Agent / EnrollmentToken / Session`
- [ ] Add seed script for local org + operator
- [ ] Add subpath exports `"./protocol"`, `"./machines"`, `"./ports"` to
      `packages/core/package.json`
- [ ] Add dependency-direction lint rule + CI step
- [ ] Update [docs/design-docs/index.md](../../design-docs/index.md) with a
      `state-management.md` design doc covering the XState + Zod choice
- [ ] Update [docs/generated/](../../generated/) with the regenerated Prisma
      client types reference

## Acceptance Criteria

- [ ] `bunx biome check --write .` is clean
- [ ] `bun test` passes for `packages/core` (model-based tests included)
- [ ] Importing `@avocado/core/protocol` from `projects/agent`,
      `projects/backend`, and `projects/frontend` typechecks in all three
- [ ] Dependency-direction lint fails (in a test fixture) when a `packages/`
      file imports from `projects/`
- [ ] Demo: a tiny script `bun run packages/core/scripts/echo.ts` parses a
      sample `Hello` message and dispatches it to a running
      `agentLinkMachine` actor, logging the resulting state transition

## Risks & Open Questions

- **XState v5 learning curve.** Mitigation: skeleton machines only in this
  phase; complexity is added incrementally with later phases' tests.
- **Zod bundle size in the frontend.** Mitigation: subpath imports + Vite
  tree-shaking; revisit if frontend bundle grows materially.
- **Lint rule false positives.** Mitigation: pin to `dependency-cruiser` if
  Biome's boundary support is insufficient.

## Decisions Log

- 2026-04-19: Removed `redux` / `@reduxjs/toolkit` from `packages/core` in
  favor of XState v5. The two methodologies should not coexist in shared
  code; Redux is a UI-state pattern and shared code is protocol state.
- 2026-04-19: Schemas live in `protocol/`, machines in `machines/`. Kept as
  separate subpath exports so consumers can import narrowly.
