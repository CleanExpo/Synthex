# Spec — code-review (SYN-1049 foundation uplift)

## Finish line

Every code-review finding this connector produces is checked against the locked foundation and passes the verification gate before it is reported as complete.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — verification discipline, evidence standard
- `.claude/memory/verification-gates.md`
- `CLAUDE.md` — project configuration and standards
- `.claude/rules/` — development workflow rules
- `tsconfig.json` — TypeScript configuration
- `.claude/skills/synthex-standards/references/code-standards.md` — Synthex-specific code standards reference
- `.claude/skills/review-board/_shared/output-schema.md` + `severity-levels.md` — Review Board output mapping

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Reviews never flag Synthex conventions (Australian English, Supabase-only auth, SWR with `credentials:'include'`, selective error boundaries) as bugs.
- [ ] Reviews enforce the Synthex patterns: `useRouter` from `next/navigation` (no `window.location.href`), SWR for client data fetching, `{ error: string, details? }` 4xx shape, `{ organizationId }` on every Prisma query, Zod `safeParse` on mutations, `getUserIdFromRequestOrCookies` auth.
- [ ] Findings map to the Review Board schema with `severity`, `confidence` (only >= 80 shown), and `verdict` (BLOCK on any CRITICAL, else PASS).

## Referenced paths (only ones VERIFIED to exist on disk)

- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/verification-gate.md`
- `.claude/rules/fabel-evidence-standard.md`
- `.claude/rules/`
- `CLAUDE.md`
- `tsconfig.json`
- `.claude/skills/synthex-standards/references/code-standards.md`
- `.claude/skills/review-board/_shared/output-schema.md`
- `.claude/skills/review-board/_shared/severity-levels.md`

## Known drift (referenced but missing on disk)

- `.eslintrc.json` — referenced under "Key Files" but not present at repo root (ESLint config likely lives in another form, e.g. flat config).

## Verification

- `grep -q "ceo-foundation" .claude/skills/code-review/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
