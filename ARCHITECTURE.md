# Architecture

Avocado is a **remote access center** — a platform for monitoring, controlling, and
managing computer assets across an organization. This document describes the high-level
system architecture. For deeper design rationale, see [docs/design-docs/](./docs/design-docs/).

---

## System Overview

```mermaid
graph TB
    subgraph Control Plane ["Control Plane (Backend)"]
        GW[API Gateway / Auth]
        SIG[Signaling Server\nWebSocket]
        API[REST / Management API]
        TURN[TURN Server\nrelay fallback]
        DB[(Postgres\nmulti-tenant)]
        TSDB[(ClickHouse\nmetrics & events)]
        Q[Job Queue]
        PKG[Plugin Registry\nWASM / JS bundles]
    end

    subgraph Dashboard ["Dashboard (Frontend)"]
        UI[Web UI]
        O11Y[O11y / Monitoring Views]
    end

    subgraph Edge ["Edge — Remote Agents"]
        A1[Agent A]
        A2[Agent B]
        AN[Agent N...]
    end

    UI -->|JWT org-scoped| GW
    O11Y -->|JWT org-scoped| GW
    GW --> API
    GW --> SIG

    A1 -->|persistent WS + heartbeat| SIG
    A2 -->|persistent WS + heartbeat| SIG
    AN -->|persistent WS + heartbeat| SIG

    SIG --> DB
    API --> DB
    API --> TSDB
    API --> Q
    Q -.->|push job dispatch| SIG
    SIG -.->|forward to agent| A1

    UI <-->|WebRTC P2P| A1
    A1 <-->|TURN fallback| TURN
    A1 -->|OTA pull| PKG
```

---

## Package Structure

```mermaid
graph LR
    subgraph packages
        CORE[core\nSDK · types · Prisma]
        NS[netstat\nRust/NAPI]
    end
    subgraph projects
        BE[backend\nHono · signaling · API]
        FE[frontend\nQwik · dashboard]
        AG[agent\ncapabilities · OTA runtime]
    end

    AG --> CORE
    BE --> CORE
    FE --> CORE
    AG --> NS
    BE --> NS
```

**Dependency rule:** `projects/` depend on `packages/`; packages never depend on projects.
`packages/core` is the only place for shared types, schemas, and invariants.

---

## Session Connection Flow

```mermaid
sequenceDiagram
    participant Op as Operator (Browser)
    participant BE as Backend / Signaling
    participant Ag as Agent

    Ag->>BE: register + heartbeat (persistent WebSocket)
    Op->>BE: initiate session (REST)
    BE->>Ag: signal offer (via WS)
    Ag-->>BE: signal answer + ICE candidates
    BE-->>Op: relay SDP / ICE
    Op<-->Ag: WebRTC DataChannel / Media (P2P)
    Note over Op,Ag: Automatically falls back to TURN relay if P2P blocked
```

All capability traffic (screen share, file transfer, remote shell, background jobs)
multiplexes over a single WebRTC transport per session.

---

## OTA Plugin Lifecycle

```mermaid
sequenceDiagram
    participant BE as Backend
    participant Ag as Agent Runtime
    participant PL as Plugin (WASM/JS)

    BE->>Ag: push manifest {pluginId, version, hash}
    Ag->>BE: GET /plugins/{id}/bundle
    BE-->>Ag: signed bundle
    Ag->>Ag: verify signature
    Ag->>PL: hot-load into WASM sandbox
    PL-->>Ag: register capabilities
    Ag-->>BE: ack {loaded capabilities[]}
```

Plugins run inside a WASM sandbox with a **capability-based permission model** —
each plugin declares the syscalls it needs; the agent enforces the allowlist.
No restart required for a plugin update.

---

## Multi-Tenant Data Model

```mermaid
erDiagram
    ORG ||--o{ USER : has
    ORG ||--o{ AGENT : owns
    ORG ||--o{ PLUGIN_POLICY : configures
    AGENT ||--o{ SESSION : starts
    AGENT ||--o{ METRIC : emits
    SESSION ||--o{ JOB : runs
    PLUGIN_POLICY }o--|| PLUGIN_BUNDLE : references
```

---

## Key Technology Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Agent ↔ Backend | Persistent WebSocket | Low-latency heartbeat, instant job dispatch |
| Operator ↔ Agent data | WebRTC P2P + TURN fallback | Low latency; works behind NAT |
| Metrics storage | ClickHouse | Column-store; fast range aggregations |
| OTA mechanism | WASM/JS plugin bundles | Hot-load without restart; sandboxable |
| Plugin isolation | WASM capability-based sandbox | Per-plugin syscall allowlist |
| Job triggers | Ad-hoc + scheduled + event-driven | Full operator flexibility |
| Auth model | Multi-tenant, org-scoped JWT roles | SaaS and self-hosted compatible |
| Self-hosted distribution | Docker Compose | Low ops burden for single-org deployments |

---

## Deployment Models

**SaaS** — Avocado operates the control plane. Agents point to `cloud.avocado.dev`.
Orgs are isolated at the DB row level (org-scoped JWT, row-level security).

**Self-hosted** — A Docker Compose stack ships backend + Postgres + ClickHouse + TURN.
Agents point to the operator's own host. No data leaves the org's network.

Both models share identical agent binaries and plugin bundles.

