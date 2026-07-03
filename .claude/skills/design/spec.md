# Spec — design (SYN-1050 foundation uplift)

## Finish line

Every visual artefact this skill produces is foundation-checked against the locked design-token system and routed through the brand-voice gate before it lands.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — visual brand consistency, the design-token system, brand-specific visual taboos (Phase 3.X), universal taboos
- `.claude/memory/verification-gates.md` — gate state for any claim referenced
- `.claude/skills/synthex-standards/references/aesthetic-standards.md` — Synthex aesthetic reference (heading font, brand orange, slate base, glass token set)

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Headings use Space Grotesk (weight 300–600), never Inter.
- [ ] Primary accent is #f97316 brand orange; base background is #0f172a deep slate.
- [ ] No purple (#8B5CF6 / #7C3AED) gradients on white and no generic glassmorphism without the Synthex glass token set.
- [ ] Colour pairings meet WCAG 2.1 AA (4.5:1 minimum contrast).

## Referenced paths (only ones VERIFIED to exist on disk)

- `components/ui/` — base UI components
- `styles/` — global stylesheets
- `public/` — static assets
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`
- `.claude/skills/synthex-standards/references/aesthetic-standards.md`

## Known drift (referenced but missing on disk)

- `lib/theme/` — listed under Key Directories as theme configuration; not present on disk.

## Verification

- `grep -q "ceo-foundation" .claude/skills/design/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
