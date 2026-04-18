# Plans

How Avocado plans non-trivial work. The repository is the system of record
([AGENTS.md](../AGENTS.md), operating principle #1); plans live here in-tree
so agents and humans share one source of truth.

---

## When You Must Write a Plan

Open an execution plan in [docs/exec-plans/active/](./exec-plans/active/) before
starting work that meets **any** of the following:

- Changes the wire protocol, public SDK surface, or data model
- Introduces a new package, project, or major dependency
- Spans more than one project (`projects/*`) or touches `packages/core`
- Has externally observable behavior changes (UX, API contracts, deploy shape)
- Will take more than a single focused session to complete
- Carries non-trivial risk (security, performance, data integrity)

Trivial bug fixes, doc tweaks, lint fixes, and pure refactors with no behavior
change do **not** require a plan.

---

## Plan File Conventions

**Location.** While in progress: `docs/exec-plans/active/`. When fully merged
and verified: move to `docs/exec-plans/completed/`. Never delete.

**Naming.** `YYYY-MM-DD-<kebab-slug>.md`. The date is when the plan was
**created**, not finished.

**Status field.** One of: `active`, `blocked`, `review`, `completed`. Update it
whenever the state changes — stale status is a bug.

**Linking.** If the plan implements or supersedes a design doc or product spec,
link it at the top. If it depends on or unblocks another plan, link those too.

**Decisions log.** Every meaningful decision made during execution gets a dated
bullet. The log is append-only — never rewrite history. If a decision is
reversed, add a new entry explaining the reversal.

**Closure.** A plan is `completed` only when:

1. All steps are checked off
2. Acceptance criteria are demonstrably met
3. Code is merged on `main`
4. Docs (design, product, generated) are updated
5. Any new tech debt is filed in [tech-debt-tracker.md](./exec-plans/tech-debt-tracker.md)

---

## Plan Template

See the canonical template in
[docs/exec-plans/active/README.md](./exec-plans/active/README.md). Copy it
verbatim when starting a new plan.

---

## Multi-Phase Initiatives

Large initiatives (e.g., the MVP) are split into an **umbrella plan** plus one
plan per phase. Conventions:

- Umbrella plan lists scope, the cut list (what's deferred), and links to each
  phase plan.
- Each phase plan is independently shippable and demoable.
- A phase is "done" only when its acceptance demo runs end-to-end. No starting
  the next phase until the current one is green.
- Phases must be **vertical slices** (touch every layer needed to demo), not
  horizontal layers (avoid "build all of layer X first").

---

## Demo Gate

Every phase or feature plan must define a **demo** in its acceptance criteria —
a script or scenario that proves the change works end-to-end. "Tests pass" is
not a demo. The demo must be reproducible by another engineer or agent from a
clean checkout.

---

## Deferral Discipline

Whenever you cut scope or defer work mid-plan, record it in **two** places:

1. The plan's `Non-Goals` or `Decisions Log` (so the rationale survives)
2. A row in [tech-debt-tracker.md](./exec-plans/tech-debt-tracker.md) **only if**
   the deferral creates real debt (a shortcut, a missing safety net, a known
   weakness). Speculative future features do not belong in the debt tracker.

---

## Standing Guidance for Plans Touching `packages/core`

`packages/core` is the shared SDK consumed by every runtime. Plans that add or
modify code there must follow these rules — repeat them in the plan's
`Approach` so reviewers can audit.

### Wire-protocol changes — use Zod

- All cross-process message shapes live in `packages/core/src/protocol/` as
  **Zod schemas**. Types are derived via `z.infer<typeof Schema>`; never
  hand-write the TypeScript type alongside the schema.
- Validate at every ingress boundary (WebSocket message, HTTP request body,
  DataChannel frame). Internal code consumes only typed, parsed values.
- Schemas are versioned. A breaking change requires a new schema version and a
  migration story for older clients/agents.
- One schema per message kind, composed under a discriminated union keyed on
  `kind`. Avoid catch-all "envelope with `any` payload" patterns.
- Schemas are pure data. No environment-specific imports. They must run in
  Node, Bun, browser, and worker contexts.

### Application / protocol state — use XState v5

- Long-lived stateful flows (sessions, connections, transfers, capability
  channels) are modeled as **XState v5 machines** in
  `packages/core/src/machines/`.
- Machine **definitions** live in core; runtimes call `createActor()` locally.
  The same machine definition runs on agent, backend, and frontend so the
  algorithm cannot drift.
- Inputs to a machine are validated by a Zod schema before `send()`. Machines
  never see un-parsed external data.
- Hierarchical and parallel states are preferred over flat enum-and-flag
  patterns. If a flow has illegal transitions, encode them as guards or absent
  transitions, not runtime checks.
- Every machine has a corresponding model-based test using `@xstate/test`.
  Coverage of transitions is part of the acceptance criteria.
- A snapshot of the machine diagram (SVG or Stately link) is referenced from
  the related design doc. The code is the source of truth; the diagram is a
  view.
- Local UI-only state (form inputs, hover, ephemeral toggles) does **not**
  belong in shared machines. Keep it in the consumer (Qwik signals, etc.).

### Layering reminders

- `packages/*` may not import from `projects/*`. The dependency-direction lint
  rule enforces this; do not disable it.
- Anything Node-only, browser-only, or framework-specific does not belong in
  core. If you need a runtime adapter, define a port (interface) in core and
  let each project supply the implementation.
- New subpath exports go in `packages/core/package.json` so consumers can
  import narrowly and tree-shake.

---

## When in Doubt

- Read [AGENTS.md](../AGENTS.md) and [ARCHITECTURE.md](../ARCHITECTURE.md)
- Skim [docs/design-docs/index.md](./design-docs/index.md) — the decision may
  already be made
- If the plan invents a new pattern, link to the design doc that justifies it
  (or write the design doc first)
