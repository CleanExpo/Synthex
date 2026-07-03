# Spec — client-manager (SYN-1049 foundation uplift)

## Finish line

Every artefact this connector produces (CRUD result, analytics rollup, mutation confirmation) is foundation-checked and gate-passed before it lands.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — cross-client boundary (Phase 3.4), org-scoping
- `.claude/memory/verification-gates.md`
- User intent (CRUD action + target Prisma model: Campaign, Post, Project, User, ApiUsage, Session)

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every CRUD/list/analytics query is org-scoped (userId / campaignId filter present per the Query Patterns section) — no cross-client data exposure.
- [ ] Mutations validate required fields and enum values before executing (per the Validation Rules section) — name/platform/status/content constraints enforced.
- [ ] Every reported result tags facts with `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`; analytics figures are never stated as fact without their source.

## Referenced paths (only ones VERIFIED to exist on disk)

- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/verification-gate.md`
- `.claude/rules/fabel-evidence-standard.md`

(SKILL.md references no `lib/...` or `app/api/...` source paths — it documents Prisma model/method names and table names only.)

## Known drift (referenced but missing on disk)

- none

## Verification

- `grep -q "ceo-foundation" .claude/skills/client-manager/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
