# Synthex Review Checklist

> Before any PR or "done" claim, run through this list.
> Full evidence standard: `.claude/rules/fabel-evidence-standard.md`

## Gate — must pass before shipping

- [ ] `npm run type-check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 — paste the `Tests: X passed` line as evidence
- [ ] Change matches the current ticket scope (no scope creep)

## Design compliance

- [ ] Australian English (colour, organise, licence)
- [ ] Lucide icons only — check count stays at or below 61 with `npm run lint`
- [ ] No emoji in UI components or copy
- [ ] No `console.log` in production paths

## Security / data

- [ ] No secrets, tokens, or keys in committed files
- [ ] New API routes have 401 (unauthed) and 403 (wrong org) test cases
- [ ] No `prisma db push` — use `prisma db execute` with `migrate diff` output
- [ ] New DB columns have defaults or are nullable (backward-compatible)

## Image generation

- [ ] Any new image call routes through `lib/services/ai/image-generation.ts`
- [ ] No direct calls to OpenAI/Gemini/Stability/fal outside the service layer

## Routes

- [ ] New routes added to `.planning/ROUTE_REFERENCE.md`
- [ ] No broken internal links (route-auditor CI gate passes)

## Separation — must fix before merge

| Category     | Finding                                       |
| ------------ | --------------------------------------------- |
| Must fix     | Breaks a user flow, security risk, type error |
| Should fix   | Code quality, missing test                    |
| Okay to ship | Minor style, future improvement               |

## Self-check prompt for Claude

```
Use review.md as the standard.
Review the current diff for: production issues, broken edge cases, confusing user flows,
files changed outside the ticket scope, and anything that violates roadmap.md.
Separate findings into: must fix / should fix / okay to ship.
```
