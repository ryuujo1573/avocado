# Plan: MVP Phase 3 — Remote Shell

**Created:** 2026-04-19
**Status:** active
**Owner:** core team
**Related:**

- Umbrella: [MVP overview](./2026-04-19-mvp-overview.md)
- Depends on: [Phase 2 — Signaling & Transport](./2026-04-19-mvp-phase-2-signaling-transport.md)

## Goal

An operator opens a fully interactive shell into an online agent through
the WebRTC DataChannel established in Phase 2. Input flows from the
browser to the agent's PTY; output streams back. Sessions resize correctly,
exit cleanly, and never leak PTY processes on the agent.

## Non-Goals

- No remote desktop (deferred post-MVP)
- No file transfer (Phase 4)
- No multi-user joint shell sessions
- No session recording or replay

## Approach

Introduce the **capability channel** abstraction on top of the raw
DataChannel from Phase 2. A single `RTCPeerConnection` can multiplex many
capability channels; this phase implements `kind: "shell"`.

Both sides drive a `channelMachine` (XState v5 from Phase 0) per channel.
All frames are validated by Zod
([docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore))
before being dispatched.

### Wire protocol additions (`packages/core/src/protocol/`)

- Extend `OpenChannel` discriminated union with
  `{ kind: "shell", cols, rows, cwd? }`.
- New frames: `ShellInput { data }`, `ShellOutput { data }`,
  `ShellResize { cols, rows }`, `ShellExit { code, signal? }`.
- Bump `PROTOCOL_VERSION` if the wire shape changes incompatibly with
  Phase 2.

### Agent (`projects/agent`)

- On `OpenChannel{kind:"shell"}`: spawn a PTY via `node-pty` (or Bun
  equivalent — pick during this phase, document).
- Wire PTY stdout → `ShellOutput` frames; `ShellInput` frames → PTY stdin.
- On DataChannel close, channel error, or operator disconnect: kill the
  PTY; verify with a process audit that no orphans remain.

### Frontend (`projects/frontend`)

- "Shell" button on the agent row opens a new tab/panel.
- xterm.js wired to the channel: keystrokes → `ShellInput`, `ShellOutput`
  → terminal write.
- `ResizeObserver` on the terminal element → `ShellResize` (debounced).
- UI surfaces clean error states (channel closed, agent disconnected).

### Backpressure

- Both sides respect `RTCDataChannel.bufferedAmount` and
  `bufferedAmountLowThreshold`. Above the threshold, output is paused.
- Logic lives in `packages/core` so agent and frontend share the same
  algorithm.

## Steps

- [ ] Extend protocol schemas with shell frames; bump version constant if
      needed
- [ ] Implement `channelMachine` open/close transitions (already
      skeletoned in Phase 0)
- [ ] Agent: PTY spawn + wire to channel + cleanup on close
- [ ] Frontend: xterm.js panel + input/output wiring + resize
- [ ] Backpressure helper in `packages/core` used by both sides
- [ ] Process audit test on the agent: 100 sessions opened + closed leave
      zero orphan PTYs
- [ ] E2E test: 5-minute interactive session driven by a script
      (Playwright + scripted PTY interaction); verifies output, resize,
      and clean exit
- [ ] Model-based tests for `channelMachine` covering normal close,
      operator disconnect, agent crash, and protocol error
- [ ] Update [docs/design-docs/connectivity.md](../../design-docs/connectivity.md)
      with the channel multiplexing model

## Acceptance Criteria

- [ ] A 5-minute interactive shell session completes without dropped
      input/output
- [ ] Terminal resize updates the PTY (`stty size` reflects the change)
- [ ] Closing the browser tab kills the PTY on the agent within 2 s
- [ ] Agent crash mid-session surfaces a clean error in the UI within 5 s
      (driven by `connectionMachine` + `channelMachine`)
- [ ] No orphan PTY processes after the 100-session stress test
- [ ] Demo: open shell to seeded agent, run `top`, resize the window,
      verify column count updates, close the tab, confirm `ps` on the
      agent shows no leftover PTY

## Risks & Open Questions

- **`node-pty` vs. Bun.** `node-pty` requires native build steps; verify
  it works under the agent's runtime. If it doesn't, pick an alternative
  in this phase and document.
- **High-throughput output (e.g., `cat huge.log`)** can saturate the
  DataChannel. Mitigation: backpressure helper above; load-test as part of
  the stress test.
- **Shell injection / privilege.** The PTY runs as the agent's user. MVP
  ships with a documented warning; per-session restricted shells deferred
  to a post-MVP security plan.

## Decisions Log

- 2026-04-19: One PTY per channel, one channel per shell tab. Multiplexing
  multiple shells over one channel adds complexity without benefit at MVP
  scale.
- 2026-04-19: Backpressure logic lives in `packages/core`. The algorithm
  must match on both sides; duplicated implementations would silently
  diverge.
