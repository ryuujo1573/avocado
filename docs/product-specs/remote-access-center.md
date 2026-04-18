# Product Spec: Remote Access Center

Status: **In Design**
Last updated: 2026-04-11

The core product offering. A web-based control center for managing, monitoring, and
remotely operating computer assets across one or more organizations.

---

## Goal

Give IT operators and SREs a single pane of glass over their entire fleet of machines:
see what's running, act on individual machines, respond to incidents, and push changes —
all without physical access or per-machine tooling.

---

## User Stories

### Fleet Overview

- As an operator, I can see all agents registered to my org, their online/offline status,
  and their last heartbeat time — at a glance.
- As an operator, I can filter agents by tag, platform (Windows/macOS/Linux), or status.
- As an operator, I can see a live metrics summary (CPU, memory, disk, network) per agent.

### Remote Control

- As an operator, I can initiate a remote desktop session to any online agent.
- As an operator, I can open a remote shell (terminal) on any online agent.
- Both session types work across NAT/firewalls (TURN fallback).

### File Transfer

- As an operator, I can browse the remote file system of an online agent.
- As an operator, I can upload files to and download files from a remote agent.

### Monitoring & Alerting

- As an operator, I can view historical metrics graphs for any agent (CPU, memory,
  disk, network, custom plugin metrics).
- As an operator, I can configure alert rules (e.g., CPU > 90% for 5 min → notify).
- Metrics are stored in ClickHouse; retention is configurable per org.

### Background Jobs

- As an operator, I can run an ad-hoc job on one or more agents (e.g., run a script,
  collect a log bundle, restart a service).
- As an org admin, I can configure scheduled jobs (cron-style) that run automatically.
- Jobs can be triggered by metric threshold alerts (event-driven).
- All job runs are logged with status, output, and duration.

### OTA Capability Management

- As an org admin, I can browse available plugins in the Plugin Registry.
- As an org admin, I can enable or disable plugins per agent group.
- Plugin updates roll out automatically when a new version satisfies the org's policy.

### Multi-Tenant Access Control

| Role         | Can do                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| **Viewer**   | See fleet, view metrics, view job history                                               |
| **Operator** | All Viewer + start sessions, transfer files, run ad-hoc jobs                            |
| **Admin**    | All Operator + manage users, configure plugins, configure alerts, manage scheduled jobs |
| **Owner**    | All Admin + billing, org settings, delete org                                           |

Roles are scoped to an org. A user can be an Operator in Org A and a Viewer in Org B.

---

## Acceptance Criteria

- [ ] Dashboard loads fleet list in < 2s for up to 10,000 agents
- [ ] Remote desktop session establishes in < 5s on a low-latency network
- [ ] Heartbeat status updates reflected in dashboard within 10s of agent going offline
- [ ] File transfer saturates available bandwidth (no artificial throttle)
- [ ] Job dispatch latency < 500ms from operator action to agent receipt
- [ ] All API endpoints require valid org-scoped JWT; cross-org access returns 403

---

## Out of Scope (v1)

- Mobile app (iOS / Android agent or dashboard)
- Voice / video calling between operators (sessions are screen + shell only)
- Plugin marketplace with third-party developer accounts
- On-agent local UI or tray icon
