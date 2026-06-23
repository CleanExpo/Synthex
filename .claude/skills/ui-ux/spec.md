# Spec — ui-ux (SYN-1050 foundation uplift)

## Finish line
Every UX audit/artefact this skill produces is checked against the locked foundation and passes the brand-voice-enforce gate before it lands in the CEO batched-review queue.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — visual brand consistency, layout/accessibility standards, universal taboos
- `.claude/memory/verification-gates.md` — gate state for any referenced claim
- `.claude/skills/synthex-standards/references/aesthetic-standards.md` — aesthetic reference grounding audits

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every contrast check is grounded against the #0f172a dark slate background, not white.
- [ ] ARIA audits respect that Radix UI primitives already handle most semantics (flag only when bypassed).
- [ ] Commands reference `npm run e2e` — never `pnpm test:e2e`.
- [ ] Every quantitative/factual claim in output carries exactly one `[VERIFIED]`/`[INFERENCE]`/`[UNCONFIRMED]` tag.

## Referenced paths (only ones VERIFIED to exist on disk)
- `components/`
- `hooks/`
- `app/`
- `tests/playwright/`
- `.claude/skills/synthex-standards/references/aesthetic-standards.md`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)
- none

## Verification
- `grep -q "ceo-foundation" .claude/skills/ui-ux/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
