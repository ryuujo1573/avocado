# Plan: MVP Phase 2 — Signaling & WebRTC Transport

**Created:** 2026-04-19
**Status:** active
**Owner:** core team
**Related:**

- Umbrella: [MVP overview](./2026-04-19-mvp-overview.md)
- Depends on: [Phase 1 — Connectivity](./2026-04-19-mvp-phase-1-connectivity.md)
- Design: [docs/design-docs/connectivity.md](../../design-docs/connectivity.md)

## Goal

An operator clicks "connect" in the dashboard, the backend relays SDP and
ICE candidates between the operator's browser and the target agent, and a
WebRTC `RTCDataChannel` opens end-to-end. The connection works on the same
LAN, across two NATs, and in TURN-relay-only mode. Liveness is proven by a
single ping/pong DataChannel.

## Non-Goals

- No capabilities riding the channel yet (Phase 3+)
- No multi-stream or media tracks (audio/video deferred)
- No mid-call renegotiation (added when a capability needs it)

## Approach

The backend is a **dumb signaling pipe** — it does not parse SDP. It
authorizes a `(operator, agent)` pair, allocates a `sessionId`, and
forwards typed `SignalOffer` / `SignalAnswer` / `IceCandidate` frames in
both directions. Both endpoints drive a `connectionMachine` (XState v5)
that owns the `RTCPeerConnection` lifecycle, including ICE restart.

All signaling messages flow through the existing agent / dashboard WS
sockets from Phase 1. Every frame is parsed via Zod
([docs/PLANS.md](../../PLANS.md#standing-guidance-for-plans-touching-packagescore))
before being dispatched to the machine.

### Backend (`projects/backend`)

- `POST /sessions` — creates a `Session` row, returns `sessionId`.
- Signaling forwarder: routes `SignalOffer` / `SignalAnswer` /
  `IceCandidate` frames between the operator WS and the agent WS by
  `sessionId`.
- TURN credentials: per-session ephemeral credentials issued at session
  start (HMAC over a coturn shared secret).

### Agent (`projects/agent`)

- On `OpenSession` event, instantiates `connectionMachine` and an
  `RTCPeerConnection` (use `wrtc` or `@roamhq/wrtc` — choose during this
  phase, document in the design doc).
- Acts as the answerer.

### Frontend (`projects/frontend`)

- "Connect" button on the agent row. Acts as the offerer.
- Opens a single ping/pong DataChannel; reports RTT in the UI.
- Inspector hook: in dev builds, attach `@statelyai/inspect` to the
  `connectionMachine` actor.

### Ops

- coturn added to `docker-compose.yml`. Static long-term auth secret in env.

## Steps

- [ ] Backend: `POST /sessions` with Zod request/response
- [ ] Backend: signaling forwarder by `sessionId`; rejects unauthorized
      operator/agent pairs
- [ ] Backend: ephemeral TURN credential issuance per session
- [ ] Agent: `connectionMachine` + `RTCPeerConnection` answerer
- [ ] Frontend: `connectionMachine` + `RTCPeerConnection` offerer +
      ping/pong DataChannel
- [ ] coturn service in `docker-compose.yml`
- [ ] Test fixture: a "force-relay" mode (block UDP between peers) that
      exercises TURN path
- [ ] E2E tests: same-LAN, NAT↔NAT (simulated), and forced-relay
- [ ] Design doc updates in
      [docs/design-docs/connectivity.md](../../design-docs/connectivity.md):
      finalized signaling sequence, ICE restart rules, TURN credential TTL
- [ ] Model-based tests for `connectionMachine` covering connect, ICE
      restart, and remote-disconnect transitions

## Acceptance Criteria

- [ ] DataChannel opens within 5 s on a low-latency network (no relay)
- [ ] DataChannel opens within 10 s in forced-relay mode
- [ ] Killing the agent mid-session is detected by the operator's
      `connectionMachine` within 5 s and the UI surfaces a clean error
- [ ] Backend never parses SDP; integration test asserts SDP bytes are
      passed through unchanged
- [ ] No leaked `RTCPeerConnection`s after 100 connect/disconnect cycles
      (verified via memory snapshot in CI)
- [ ] Demo: open the dashboard, click connect on the seeded agent, see
      RTT < 200 ms; toggle "force relay" and reconnect successfully

## Risks & Open Questions

- **`wrtc` build pain on Bun / Node.** Mitigation: pick the library in this
  phase and pin it; if blocked, fall back to spawning a small native
  helper. Document the choice.
- **NAT simulation in CI.** Mitigation: use a Docker network with `iptables`
  rules to drop UDP between the two peer containers, forcing relay.
- **ICE restart correctness.** Mitigation: encode in `connectionMachine`
  with explicit transitions; cover with model-based tests.

## Decisions Log

- 2026-04-19: Backend remains a dumb signaling pipe. Parsing SDP server-side
  buys nothing for the MVP and would couple us to specific browser quirks.
- 2026-04-19: Per-session ephemeral TURN credentials, not static. Static
  credentials are an exfiltration risk and prevent per-session revocation.
