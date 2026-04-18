# Active Execution Plans

Place execution plan files here while they are in progress.

Naming convention: `YYYY-MM-DD-<slug>.md`

Move to `../completed/` when the plan is fully merged.

## Template

```markdown
# Plan: <Title>

**Created:** YYYY-MM-DD
**Status:** active | blocked | review | completed
**Owner:** (agent task or human)
**Related:**

- Design: [docs/design-docs/<slug>.md](../../design-docs/<slug>.md)
- Spec: [docs/product-specs/<slug>.md](../../product-specs/<slug>.md)
- Depends on: <plan slug>
- Unblocks: <plan slug>

## Goal

One paragraph. What changes when this plan ships? Who notices?

## Non-Goals

Bullets. What this plan deliberately does not address (deferrals, follow-ups).

## Approach

How, at the level of "the shape of the solution." Not line-by-line.
Call out which packages/projects are touched and why.

## Steps

- [ ] Step 1 — concrete, verifiable
- [ ] Step 2

## Acceptance Criteria

- [ ] Behavior X is observable
- [ ] Test Y passes in CI
- [ ] Demo: <reproducible scenario>

## Risks & Open Questions

Bullets. Known unknowns. Items that could derail the plan.

## Decisions Log

- YYYY-MM-DD: <decision and one-line rationale>
```
