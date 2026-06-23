# Spec — visual-content-brief (SYN-1050 foundation uplift)

## Finish line
Every visual brief, AI image prompt, and colour-application artefact this skill produces is checked against the locked CEO foundation and passes the brand-voice-enforce gate before it lands in the CEO batched-review queue.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — visual brand consistency, voice tag (Q2.5.5), universal + brand-specific taboos
- `.claude/memory/verification-gates.md` — gate state for any referenced claim
- `.claude/skills/business-dna/` — primary/secondary hex, visual style, tone (source of the brand palette injected into every prompt)
- `.claude/skills/synthex-standards/references/aesthetic-standards.md` — aesthetic reference standard

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every generated image prompt includes a brand primary hex code pulled from Business DNA (a prompt without a hex is rejected).
- [ ] Every prompt ships with the negative prompt banning competitor colours and stock-photo feel.
- [ ] Client-facing briefs route through `brand-voice-enforce` before the CEO batched-review queue.
- [ ] Every quantitative/factual claim carries exactly one evidence tag (`[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`).

## Referenced paths (only ones VERIFIED to exist on disk)
- `lib/ai/`
- `.claude/skills/business-dna/`
- `.claude/skills/synthex-standards/references/aesthetic-standards.md`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)
- `app/api/ai/images/` (referenced as the `POST /api/ai/images` endpoint and the "Synthex image routes" path) — does not exist; `app/api/ai/` contains only `chat`, `generate-content`, `pm`. SKILL.md already hedges this with "(check availability)".
- `.claude/skills/imagen-designer/` — referenced as the Imagen designer skill; directory not present.

## Verification
- `grep -q "ceo-foundation" .claude/skills/visual-content-brief/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
