# Core Beliefs

Foundational operating principles for the Avocado platform. These constrain architectural
decisions and break ties. When in conflict, higher-numbered items defer to lower-numbered ones.

---

## 1. The connection is the foundation

Every feature — monitoring, remote control, file transfer, background jobs — depends on a
reliable, secure connection between agent and backend. We invest disproportionately in
connection robustness before building features on top. A dropped connection is a system
failure, not an edge case.

**Implications:**

- Agents maintain a **persistent WebSocket** to the backend at all times.
- WebRTC with **TURN fallback** ensures data channels work behind any NAT/firewall.
- Heartbeat and reconnection logic live in `packages/core`, not per-feature code.

## 2. Security is structural, not additive

Security controls are designed into the architecture (multi-tenant isolation, capability
sandboxes, signed bundles) rather than layered on afterward.

**Implications:**

- JWT tokens are org-scoped; a token cannot access another org's resources by construction.
- OTA plugin bundles are **signature-verified** before loading.
- WASM plugins run in a **capability-based sandbox** — each plugin declares the syscalls
  it needs and the agent enforces the allowlist. No plugin has ambient access.
- No secrets in agent binaries. Credentials are provisioned at registration time.

## 3. Extensibility through plugins, not forks

New capabilities (new monitoring sensors, new remote actions, new protocols) are delivered
as **OTA plugin bundles** — no agent binary update, no restart. The agent's core surface
area stays small and stable.

**Implications:**

- The agent exposes a stable plugin API. Breaking that API is treated like a breaking
  public API change.
- The Plugin Registry in the backend is the single source of truth for what runs on agents.
- Feature flags and plugin policies are configured per-org, not per-agent.

## 4. Observability is a first-class feature

The whole point of Avocado is visibility into computer assets (o11y). We eat our own
cooking: the platform itself emits structured metrics, traces, and logs.

**Implications:**

- Agent telemetry (heartbeat latency, session quality, job outcomes) flows into ClickHouse.
- No `console.log`. Use the structured project logger everywhere.
- Dashboard o11y views are not nice-to-haves — they are core product surface.

## 5. Minimal blast radius per change

Changes to one org's plugin policy, job schedule, or agent version must not affect other
orgs. Changes to one agent must not affect other agents.

**Implications:**

- Multi-tenant database isolation at the row level (org-scoped queries).
- Plugin rollouts are staged per org, not global.
- Background jobs are scoped to a specific agent, not broadcast.

## 6. Parse at the boundary

External data (agent telemetry, plugin messages, API payloads) is validated with **Zod**
schemas at ingress. Internal code operates on typed, validated values. Never pass
`unknown` or `any` through a layer boundary.
