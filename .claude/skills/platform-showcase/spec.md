# Spec — platform-showcase (SYN-1050 foundation uplift)

## Finish line

Every platform-showcase artefact (per-platform adaptation or campaign package) is foundation-checked and brand-voice-gated before it lands.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — voice tag (Q2.5.5), client-outcome framing, universal taboos
- `.claude/memory/verification-gates.md`
- `platform_master_config.json` — platform specs, algorithm weights, winning formulas, posting schedules, analytics KPIs
- `.claude/skills/synthex-standards/references/content-standards.md` — capability-uplift content standards

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every feature showcase leads with a specific client outcome (not generic SaaS language) and uses concrete numbers.
- [ ] All copy is in Australian English.
- [ ] Every client-facing artefact routes through `brand-voice-enforce` before the CEO batched-review queue.
- [ ] Quantitative/factual claims each carry exactly one evidence tag (`[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`).

## Referenced paths (only ones VERIFIED to exist on disk)

- `platform_master_config.json`
- `.claude/skills/synthex-standards/references/content-standards.md`
- `.claude/skills/video-engine`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`
- `.claude/skills/brand-voice-enforce`

## Known drift (referenced but missing on disk)

- `Synthex/platform_master_config.json` — referenced in SKILL.md References section; actual file is at repo-root `platform_master_config.json` (no `Synthex/` prefix).
- `imagen-designer` skill — referenced in SKILL.md References section; no `.claude/skills/imagen-designer/` directory exists.

## Verification

- `grep -q "ceo-foundation" .claude/skills/platform-showcase/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
