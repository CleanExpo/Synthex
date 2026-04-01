---
name: code-review
description: >-
  Synthex code quality enforcer. NEVER flag Synthex conventions as bugs
  (Australian English, Supabase-only auth, SWR with credentials:'include',
  selective error boundaries). NEVER suggest Redux, Zustand, tRPC, or any
  pattern absent from this codebase. ALWAYS enforce: useRouter from
  next/navigation, no window.location.href, SWR for client data fetching,
  { error: string } response shape. Activate on ANY request to review code,
  audit a PR, check a component, or validate an implementation.
metadata:
  author: synthex
  version: '2.0'
  engine: synthex-ai-agency
  type: capability-uplift-code
  triggers:
    - code review
    - pr review
    - quality check
    - security scan
    - standards check
    - review code
    - code audit
    - pr review
    - check implementation
    - validate code
context: fork
---

# Code Review Agent

## Purpose

Enforces SYNTHEX coding standards, catches regressions, and validates adherence
to architectural patterns, security requirements, and CLAUDE.md guidelines.
Performs TypeScript strict mode checks, security reviews, performance analysis,
and standards enforcement.

## When to Use

Activate this skill when:

- Reviewing pull requests or code changes
- Analyzing code quality across files or directories
- Checking for security vulnerabilities in code
- Validating against CLAUDE.md standards
- Auditing component architecture patterns

## When NOT to Use This Skill

- When reviewing visual design or UI aesthetics (use design)
- When validating database schema or migration safety (use database-prisma)
- When testing API endpoint behavior (use api-testing)
- When auditing UX flows or accessibility (use ui-ux)
- When reviewing non-code assets (images, configs, docs)
- Instead use: `design` for visual reviews, `database-prisma` for schema work

## Tech Stack

- **Framework**: Next.js 14+ App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Glassmorphic UI
- **State**: React hooks, SWR for data fetching
- **Testing**: Jest, React Testing Library

## Instructions

1. **Identify review scope** — Determine files, directories, or PR to review
2. **Run static analysis** — Execute `pnpm turbo run type-check lint`
3. **Check TypeScript compliance** — Verify strict mode, no `any` types, proper generics
4. **Validate component patterns** — Confirm Server/Client component separation
5. **Scan for security issues** — Check for hardcoded secrets, exposed env vars, XSS vectors
6. **Validate environment variables** — Confirm env-validator usage, no client-side secrets
7. **Analyse performance** — Identify unnecessary re-renders, missing lazy loading, large bundles
8. **Check error handling** — Verify try-catch on async ops, error boundaries present
9. **Enforce naming conventions** — PascalCase components, camelCase hooks, kebab-case utils
10. **Generate review report** — Output findings grouped by severity (critical/warning/info)

## Input Specification

| Parameter | Type   | Required | Description                                                      |
| --------- | ------ | -------- | ---------------------------------------------------------------- |
| target    | string | yes      | File path, directory, or PR number                               |
| scope     | string | no       | `security`, `performance`, `standards`, `full` (default: `full`) |

## Output Specification

| Field       | Type                  | Description                            |
| ----------- | --------------------- | -------------------------------------- |
| file        | string                | File path reviewed                     |
| severity    | critical/warning/info | Issue severity                         |
| category    | string                | security/performance/standards/pattern |
| description | string                | Issue description                      |
| suggestion  | string                | Recommended fix                        |
| line        | number                | Line number (if applicable)            |

## Error Handling

| Error                        | Action                                      |
| ---------------------------- | ------------------------------------------- |
| Binary file encountered      | Skip with info message                      |
| File too large (>5000 lines) | Warn and review in chunks                   |
| Corrupted/unreadable file    | Log error, skip file                        |
| Lint/typecheck crash         | Report tool failure, continue manual review |
| PR not found                 | Report clear error with correct PR format   |

## Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] Proper error boundaries
- [ ] Security validation on API routes
- [ ] Environment variables not exposed
- [ ] No hardcoded secrets
- [ ] Consistent component patterns
- [ ] Adequate test coverage
- [ ] Performance considerations
- [ ] Australian English in user-facing strings

## Key Files

- `CLAUDE.md` — Project configuration and standards
- `.claude/rules/` — Development workflow rules
- `tsconfig.json` — TypeScript configuration
- `.eslintrc.json` — Linting rules

## Commands

```bash
pnpm turbo run lint              # Run linting
pnpm turbo run type-check        # Type checking
pnpm turbo run type-check lint test  # Run all checks
```

## Integration Points

- Works with **api-testing** for endpoint coverage
- Coordinates with **database-prisma** for query optimisation
- Reports to **ui-ux** for component standards

---

## Capability Uplift — Override Defaults

**NEVER** apply generic clean code principles that contradict Synthex conventions.
Australian English spellings are correct. Supabase-only auth is correct.
SWR with `credentials: 'include'` is correct. Don't flag these as issues.

**INSTEAD** reviews enforce Synthex-specific patterns:

- `useRouter` from `next/navigation` (never `next/router`, never `window.location.href`)
- SWR for all client-side data fetching with `credentials: 'include'` fetcher
- `{ error: string, details?: unknown }` for all 4xx responses
- `{ organizationId }` filter on every Prisma query
- Zod `safeParse` (not `parse`) on all mutation inputs
- `getUserIdFromRequestOrCookies` (not any other auth helper)

Blockers: security issues (missing auth/org-scope), runtime errors.
Warnings: code quality (any types, silent catches, missing error shape).
Suggestions: improvements that don't change behaviour.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`


---

## Review Board Output

When invoked as part of the Synthex Review Board pipeline, produce output matching the schema in `.claude/skills/review-board/_shared/output-schema.md`.

Map this skill's findings to the shared format:
- `specialist`: Use this skill's `name` from frontmatter
- `severity`: Map findings to CRITICAL/HIGH/MEDIUM/LOW per `.claude/skills/review-board/_shared/severity-levels.md`
- `confidence`: Assign 0-100 based on certainty. Only findings >= 80 are shown to the developer.
- `verdict`: BLOCK if any CRITICAL finding exists, otherwise PASS
- Include `file`, `line`, `issue`, `fix`, and optional `reference` for each finding
- If no findings, return empty findings array with verdict PASS
