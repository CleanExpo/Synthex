# Synthex Review Board Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-layer automated code review system (SYN-591) that triggers on every PR to `main`, runs 16 specialist reviews, produces a unified verdict, and tracks metrics.

**Architecture:** GitHub Actions workflow triggers triage script, which classifies PR risk and dispatches Claude Code with the Chief Reviewer agent. The agent runs specialist skills in parallel batches, synthesises findings, and posts a structured PR review. A metrics JSONL log tracks all reviews for pattern detection.

**Tech Stack:** Bash (triage), Claude Code CLI (review execution), GitHub Actions (CI), Markdown (skills/agents), JSONL (metrics)

**Spec:** `docs/superpowers/specs/2026-03-31-review-board-design.md`

---

## Chunk 1: Foundation — Shared Schemas & Scaffolding

### Task 1: Create shared output schema

**Files:**
- Create: `.claude/skills/review-board/_shared/output-schema.md`

- [ ] **Step 1: Create the output schema file**

```markdown
# Review Board — Specialist Output Schema

Every specialist MUST produce findings in this exact JSON structure.
The Chief Reviewer parses this format; deviations will be discarded.

## Schema

\`\`\`json
{
  "specialist": "<skill-id>",
  "tier": "<trivial|standard|high-risk|critical>",
  "duration_ms": <integer>,
  "findings": [
    {
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "confidence": <integer 0-100>,
      "file": "<relative/path/to/file.ts>",
      "line": <integer>,
      "issue": "<one-line description of the problem>",
      "fix": "<one-line description of the fix>",
      "reference": "<optional: path to canonical pattern>"
    }
  ],
  "summary": {
    "critical": <integer>,
    "high": <integer>,
    "medium": <integer>,
    "low": <integer>
  },
  "verdict": "<BLOCK|PASS>"
}
\`\`\`

## Rules

1. `specialist` must match the skill's `name` frontmatter field
2. `confidence` must be 0-100; the Chief Reviewer filters findings below 80
3. `verdict` is BLOCK if any CRITICAL finding exists, otherwise PASS
4. `file` paths are relative to repo root (e.g., `app/api/auth/route.ts`)
5. `reference` is optional — include when a canonical pattern exists in the codebase
6. If the specialist finds nothing, return an empty `findings` array with `verdict: "PASS"`
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/_shared/output-schema.md
git commit -m "feat(review-board): add shared specialist output schema (SYN-591)"
```

---

### Task 2: Create severity level definitions

**Files:**
- Create: `.claude/skills/review-board/_shared/severity-levels.md`

- [ ] **Step 1: Create the severity levels file**

```markdown
# Review Board — Severity Level Definitions

## Levels

### CRITICAL
**Definition:** Exploitable security flaw, data loss, cross-org data leak, or production crash.
**Examples:** Hardcoded secrets, SQL injection, missing auth on mutation, org-scope bypass, unbounded DELETE.
**Merge impact:** Always blocks merge.
**Confidence requirement:** Report only if confidence >= 80%.

### HIGH
**Definition:** Correctness bug, compliance violation, or reliability risk that will cause user-facing issues.
**Examples:** Missing rate limiter, broken error handling, incorrect API response shape, missing Zod validation.
**Merge impact:** Blocks merge when 3+ HIGH findings exist in a single review.
**Confidence requirement:** Report only if confidence >= 80%.

### MEDIUM
**Definition:** Quality or maintainability concern that should be addressed but is not urgent.
**Examples:** N+1 query, missing test coverage, cognitive complexity >15, missing ARIA labels.
**Merge impact:** Noted in review as recommendation. Does not block merge.
**Confidence requirement:** Report only if confidence >= 80%.

### LOW
**Definition:** Style, convention, or documentation suggestion.
**Examples:** Naming inconsistency, missing JSDoc, magic numbers, commit message format.
**Merge impact:** Informational only. Does not block merge.
**Confidence requirement:** Report only if confidence >= 80%.

## Verdict Rules (evaluated top-to-bottom, first match wins)

| Condition | Chief Reviewer Verdict | Merge Status |
|-----------|----------------------|-------------|
| Any CRITICAL finding | REQUEST_CHANGES | Blocked |
| 3+ HIGH findings | REQUEST_CHANGES | Blocked |
| 1-2 HIGH findings | COMMENT | Allowed (with warnings) |
| Only MEDIUM/LOW findings | APPROVE | Allowed |
| Zero findings | APPROVE | Allowed |
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/_shared/severity-levels.md
git commit -m "feat(review-board): add severity level definitions (SYN-591)"
```

---

### Task 3: Create Review Board README

**Files:**
- Create: `.claude/review-board/README.md`
- Create: `.claude/review-board/metrics.jsonl` (empty)
- Create: `.claude/review-board/metrics-archive/.gitkeep`

- [ ] **Step 1: Create README**

The README should document:
- What the Review Board is (1 paragraph)
- The 4-layer architecture (brief)
- How to trigger a review manually (for testing)
- How to override a blocked review
- Where metrics are stored
- Link to the full spec

- [ ] **Step 2: Create empty metrics file and archive directory**

```bash
touch .claude/review-board/metrics.jsonl
mkdir -p .claude/review-board/metrics-archive
touch .claude/review-board/metrics-archive/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add .claude/review-board/
git commit -m "feat(review-board): add README, empty metrics log, archive dir (SYN-591)"
```

---

## Chunk 2: Specialist Skills — Batch 1 (Core Quality)

Each specialist skill follows the same SKILL.md template from the spec.
Reference: `.claude/skills/review-board/_shared/output-schema.md` for output format.
Reference: `.claude/skills/review-board/_shared/severity-levels.md` for severity definitions.

### Task 4: Create `performance` specialist

**Files:**
- Create: `.claude/skills/review-board/performance/SKILL.md`

- [ ] **Step 1: Write the skill**

Frontmatter:
```yaml
---
name: performance
description: Review PR for bundle size regressions, N+1 queries, serverless function size, and render performance
type: review-specialist
severity_levels: [CRITICAL, HIGH, MEDIUM, LOW]
confidence_threshold: 80
---
```

Checklist sections (grouped by severity):
- **CRITICAL:** Infinite loops, unbounded recursion, memory leaks via unclosed streams
- **HIGH:** Bundle size increase >50KB client, serverless function >50MB, N+1 query in API route
- **MEDIUM:** Missing React.memo on expensive components, unnecessary re-renders from unstable references, missing useMemo/useCallback on computed values passed as props
- **LOW:** Import of entire library when tree-shaking available (e.g., `import _ from 'lodash'` vs `import get from 'lodash/get'`)

Synthex-specific rules:
- Serverless functions on Vercel have a 50MB limit
- SWR handles client-side caching — don't flag SWR refetch intervals as performance issues
- Turbopack dev server is slow; only flag production-relevant performance issues

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/performance/SKILL.md
git commit -m "feat(review-board): add performance specialist skill (SYN-591)"
```

---

### Task 5: Create `breaking-changes` specialist

**Files:**
- Create: `.claude/skills/review-board/breaking-changes/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** Prisma schema field removal/rename without migration plan, dropped database table
- **HIGH:** Removed/renamed exported function or type, API response shape change (added required field, removed field, changed type), component prop removal/rename
- **MEDIUM:** Changed default values, changed error message format, changed enum values
- **LOW:** Internal function rename (not exported), changed test fixture data

Synthex-specific rules:
- Check `prisma/schema.prisma` diffs — any field removal or rename is HIGH minimum
- Check `app/api/` response shapes — consumers depend on `{ error: string }` pattern
- Check `components/` exported props — dashboard pages depend on component interfaces
- Check `lib/` exports — `index.ts` barrel files define the public API

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/breaking-changes/SKILL.md
git commit -m "feat(review-board): add breaking-changes specialist skill (SYN-591)"
```

---

### Task 6: Create `typescript-strictness` specialist

**Files:**
- Create: `.claude/skills/review-board/typescript-strictness/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** `as any` cast on user input or auth-related data
- **HIGH:** `as any` cast without `// SAFETY:` comment explaining why, `@ts-ignore` without Linear ticket reference, non-null assertion (`!`) on potentially null database result
- **MEDIUM:** Overly broad union types where a generic would be clearer, missing return type annotation on exported functions, `unknown` used where a specific type exists
- **LOW:** Implicit `any` from untyped third-party library, missing readonly on immutable arrays

Synthex-specific rules:
- `as Prisma.InputJsonValue` is acceptable (Prisma JSON casting pattern)
- `verifyTokenSafe()` returns `string | null` — always check for null before using
- Australian English in string literals is correct, not a typo

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/typescript-strictness/SKILL.md
git commit -m "feat(review-board): add typescript-strictness specialist skill (SYN-591)"
```

---

### Task 7: Create `database-review` specialist

**Files:**
- Create: `.claude/skills/review-board/database-review/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** Raw SQL string concatenation (SQL injection), missing RLS on new multi-tenant table, cross-org query (missing organisationId in WHERE)
- **HIGH:** Missing index on column used in WHERE/JOIN, unbounded query on user-facing endpoint (no LIMIT), non-nullable column addition without default (breaks existing rows), Prisma `deleteMany` without WHERE clause
- **MEDIUM:** OFFSET-based pagination on large tables (use cursor), missing `select` clause (fetching all columns), transaction not used for multi-step mutations
- **LOW:** Inconsistent field naming (camelCase vs snake_case), missing @map on Prisma field

Synthex-specific rules:
- 68 Prisma models — check `prisma/schema.prisma` for relationship chains
- Organisation scoping is mandatory: every query touching user data must include `organisationId`
- `Prisma.InputJsonValue` cast for JSON fields is the approved pattern
- `npx prisma validate` must pass — remind in findings if schema was modified

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/database-review/SKILL.md
git commit -m "feat(review-board): add database-review specialist skill (SYN-591)"
```

---

## Chunk 3: Specialist Skills — Batch 2 (Runtime Behaviour)

### Task 8: Create `react-patterns` specialist

**Files:**
- Create: `.claude/skills/review-board/react-patterns/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** State update during render (infinite loop), calling hooks conditionally
- **HIGH:** Missing dependency in useEffect/useMemo/useCallback array, array index as React key in dynamic lists, stale closure capturing old state in event handler, missing effect cleanup (subscriptions, intervals, event listeners)
- **MEDIUM:** Prop drilling more than 3 levels without context, inline object/array creation in JSX props (creates new reference each render), missing error boundary around async data component
- **LOW:** Unnecessary fragment (`<>...</>`) wrapping single child, string ref instead of useRef

Synthex-specific rules:
- `'use client'` directive required on all components using hooks
- SWR with `credentials: 'include'` is the approved data fetching pattern for client components
- Radix UI components mount all tab panels simultaneously — `getByText` may match hidden panels
- `useRouter` must be from `next/navigation`, never `next/router`

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/react-patterns/SKILL.md
git commit -m "feat(review-board): add react-patterns specialist skill (SYN-591)"
```

---

### Task 9: Create `dependency-audit` specialist

**Files:**
- Create: `.claude/skills/review-board/dependency-audit/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** Known CVE with CVSS >= 9.0 in added dependency
- **HIGH:** GPL-2.0/GPL-3.0/AGPL licensed dependency added (incompatible with commercial use), known CVE with CVSS >= 7.0, duplicate package (same functionality as existing dep)
- **MEDIUM:** New dependency adding >100KB to client bundle, outdated major version of existing dependency, dependency with <100 weekly downloads (supply chain risk)
- **LOW:** New dev dependency without clear justification, pinned version instead of range

Synthex-specific rules:
- Check `package.json` diff for any additions
- Run `npm audit --json` mentally — flag critical/high CVEs
- Existing approved packages: next, react, prisma, swr, zod, tailwindcss, radix-ui, resend, stripe
- Bundle size matters — Vercel serverless functions have a 50MB limit

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/dependency-audit/SKILL.md
git commit -m "feat(review-board): add dependency-audit specialist skill (SYN-591)"
```

---

### Task 10: Create `accessibility` specialist

**Files:**
- Create: `.claude/skills/review-board/accessibility/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** Interactive element with no accessible name (button without text/aria-label), form input without associated label
- **HIGH:** Missing alt text on informational image, colour contrast below 4.5:1 for text (3:1 for large text), focus trap without escape mechanism, missing keyboard handler on click-only element
- **MEDIUM:** Missing skip-to-content link, missing aria-live on dynamic content regions, tab order broken by CSS positioning, missing focus indicator styles
- **LOW:** Redundant ARIA role matching semantic element, title attribute used instead of aria-label

Synthex-specific rules:
- Dark glassmorphic theme (bg-[#0f172a]) requires light text — check contrast
- Radix UI components include built-in ARIA — don't flag Radix internals
- Dashboard is a protected app (not public) — WCAG AA is the target, not AAA
- Previous WCAG fixes: gray-400 was changed to gray-300 for contrast (SYN-456)

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/accessibility/SKILL.md
git commit -m "feat(review-board): add accessibility specialist skill (SYN-591)"
```

---

### Task 11: Create `test-quality` specialist

**Files:**
- Create: `.claude/skills/review-board/test-quality/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **HIGH:** New API route without corresponding test file, test mocking the database (must use real Supabase), assertion-free test (test that never asserts), missing 401/403 test cases for authenticated endpoints
- **MEDIUM:** Test names that don't describe expected behaviour, missing edge case coverage (null, empty array, boundary values), only testing happy path (no error scenarios), snapshot test on frequently-changing component
- **LOW:** Inconsistent test file naming (should match source file), missing test description grouping (describe blocks), duplicated test setup that should be in beforeEach

Synthex-specific rules:
- Test structure for API routes: 401 (unauthenticated) -> 403 (wrong org) -> 400 (invalid input) -> 200 (happy path)
- NEVER mock the database — use real Supabase in tests
- Jest with ts-jest — use inline mock factories for TDZ workaround
- `notifications-crud` test failure is pre-existing (Next.js cookies outside request scope) — don't flag it
- 16 pre-existing Stripe test failures — don't flag those either

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/test-quality/SKILL.md
git commit -m "feat(review-board): add test-quality specialist skill (SYN-591)"
```

---

## Chunk 4: Specialist Skills — Batch 3 (Style & Process)

### Task 12: Create `commit-hygiene` specialist

**Files:**
- Create: `.claude/skills/review-board/commit-hygiene/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **HIGH:** Commit containing secrets or credentials (even if later removed — they're in git history), merge commit in PR (should be rebased)
- **MEDIUM:** Commit message not following conventional format (`type(scope): description`), single giant commit instead of atomic changes, fixup/squash commit left unresolved
- **LOW:** Missing scope in commit message, commit message over 72 characters, branch name not following convention (feature/, fix/, docs/)

Synthex-specific rules:
- Valid types: feat, fix, docs, chore, test, refactor, perf, style, ci, build
- Valid scopes: any directory name (e.g., auth, api, dashboard, video, prisma)
- All commits should reference a Linear issue: `(SYN-XXX)` or `(UNI-XXXX)` in message

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/commit-hygiene/SKILL.md
git commit -m "feat(review-board): add commit-hygiene specialist skill (SYN-591)"
```

---

### Task 13: Create `dx-review` specialist

**Files:**
- Create: `.claude/skills/review-board/dx-review/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **HIGH:** Function with cognitive complexity >20 (too complex to reason about safely), file over 500 lines with mixed responsibilities
- **MEDIUM:** Function with cognitive complexity >15, unclear variable names (single letter, abbreviations), magic numbers without named constants, function with >5 parameters (consider options object)
- **LOW:** Missing comment on non-obvious logic, inconsistent naming convention within a file, deeply nested conditionals (>3 levels)

Synthex-specific rules:
- Australian English is correct (colour, organise, authorise) — not a naming issue
- React components use PascalCase, utils use kebab-case, skills use SCREAMING-KEBAB
- Files in `lib/` are services — they should have clear, descriptive names
- Dashboard components often have both a page wrapper and a client component — this is intentional

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/dx-review/SKILL.md
git commit -m "feat(review-board): add dx-review specialist skill (SYN-591)"
```

---

### Task 14: Create `supabase-patterns` specialist

**Files:**
- Create: `.claude/skills/review-board/supabase-patterns/SKILL.md`

- [ ] **Step 1: Write the skill**

Checklist:
- **CRITICAL:** Direct Supabase admin client usage in client-side code, RLS policy using `auth.uid()` without proper check
- **HIGH:** Missing RLS policy on new table that stores user/org data, Edge Function without JWT verification, using `service_role` key where `anon` key would suffice
- **MEDIUM:** Not using `auth.uid()` in RLS when table has user_id column, missing `USING` clause in RLS (SELECT) policy, Edge Function not handling CORS headers
- **LOW:** Inconsistent Supabase client initialisation pattern, using `supabase.from()` instead of Prisma for queries that Prisma handles

Synthex-specific rules:
- Auth is Supabase-only — NEVER suggest Clerk, NextAuth, Auth.js
- Prisma is the primary ORM — Supabase client is for auth and realtime only
- Edge Functions use Deno runtime — proxy pattern via fetch() to Next.js endpoints
- All 68 Prisma models should have RLS if they contain user/org data

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/supabase-patterns/SKILL.md
git commit -m "feat(review-board): add supabase-patterns specialist skill (SYN-591)"
```

---

### Task 15: Create `review-metrics` skill (Layer 4)

**Files:**
- Create: `.claude/skills/review-board/review-metrics/SKILL.md`

- [ ] **Step 1: Write the skill**

This is a slash-command skill (`/review-metrics`) that reads `.claude/review-board/metrics.jsonl` and produces a trend report.

Frontmatter:
```yaml
---
name: review-metrics
description: Analyse Review Board metrics — weekly summary, recurring issues, specialist effectiveness, quality trends
type: slash-command
---
```

The skill should:
1. Read the metrics JSONL file
2. Calculate: total reviews, approve/block ratio, avg duration, most common finding types
3. Identify recurring issues (same type in 3+ consecutive PRs)
4. Rank specialist effectiveness (which produce the most actionable findings)
5. Detect quality trends (are blocking issues decreasing?)
6. Suggest preventive actions for recurring patterns

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/review-board/review-metrics/SKILL.md
git commit -m "feat(review-board): add review-metrics slash command skill (SYN-591)"
```

---

## Chunk 5: Upgrade Existing Skills

### Task 16: Append review-board output section to 5 existing skills

**Files:**
- Modify: `.claude/skills/code-review/SKILL.md`
- Modify: `.claude/skills/route-auditor/SKILL.md`
- Modify: `.claude/skills/architecture-enforcer/SKILL.md`
- Modify: `.claude/skills/security-hardener/SKILL.md`
- Modify: `.claude/skills/api-testing/SKILL.md`

- [ ] **Step 1: Read each existing skill file to understand current structure**

- [ ] **Step 2: Append a `## Review Board Output` section to each skill**

The section should contain:
```markdown
## Review Board Output

When invoked as part of the Synthex Review Board pipeline, produce output
matching the schema in `.claude/skills/review-board/_shared/output-schema.md`.

Map this skill's findings to the shared format:
- `specialist`: "<this-skill's-name>"
- `severity`: Map this skill's severity classification to CRITICAL/HIGH/MEDIUM/LOW
- `confidence`: Assign 0-100 based on how certain you are (only findings >= 80 are shown)
- `verdict`: BLOCK if any CRITICAL finding, otherwise PASS

Refer to `.claude/skills/review-board/_shared/severity-levels.md` for level definitions.
```

- [ ] **Step 3: Commit all 5 files together**

```bash
git add .claude/skills/code-review/SKILL.md \
       .claude/skills/route-auditor/SKILL.md \
       .claude/skills/architecture-enforcer/SKILL.md \
       .claude/skills/security-hardener/SKILL.md \
       .claude/skills/api-testing/SKILL.md
git commit -m "feat(review-board): add review-board output section to 5 existing skills (SYN-591)"
```

---

## Chunk 6: Chief Reviewer Agent

### Task 17: Create the Chief Reviewer orchestrator agent

**Files:**
- Create: `.claude/agents/chief-reviewer.md`

- [ ] **Step 1: Write the agent definition**

The agent file must include:
- Frontmatter: name, description, type, model (opus), tools (Glob, Grep, Read, Bash, Write)
- Full persona from the spec (15+ years at Google/Stripe/Netflix/Atlassian)
- Workflow: receive findings -> filter 80% -> deduplicate -> prioritise -> contextualise -> synthesise -> output
- Verdict rules table (from spec)
- GitHub review output format template
- Human override instructions
- Skills list: all 16 specialist skills
- Reference to shared schemas

The agent workflow must include 8 steps (not 7 — the spec's 7 plus metrics logging):
1. Receive specialist findings
2. Filter (confidence < 80%)
3. Deduplicate (same file:line)
4. Prioritise (CRITICAL → HIGH → MEDIUM → LOW)
5. Contextualise (read PR title, description, commits)
6. Synthesise (unified review with blocking issues, recommendations, commendations)
7. Output review to `.claude/review-board/latest-review.md` and verdict to `latest-verdict.txt`
8. **Append metrics entry** to `.claude/review-board/metrics.jsonl` (JSONL format, schema from spec Layer 4)

Key frontmatter:
```yaml
---
name: chief-reviewer
description: >-
  Synthex Chief Code Reviewer. 15+ years engineering leadership at Google,
  Stripe, Netflix, Atlassian. Orchestrates 16 specialist review skills,
  applies 80% confidence filtering, produces unified GitHub PR reviews.
  Hard gate: blocks merge on CRITICAL findings or 3+ HIGH findings.
type: review-orchestrator
model: opus
tools: Glob, Grep, Read, Bash, Write
skills:
  - code-review
  - route-auditor
  - architecture-enforcer
  - security-hardener
  - api-testing
  - review-board/performance
  - review-board/breaking-changes
  - review-board/typescript-strictness
  - review-board/database-review
  - review-board/react-patterns
  - review-board/dependency-audit
  - review-board/accessibility
  - review-board/test-quality
  - review-board/commit-hygiene
  - review-board/dx-review
  - review-board/supabase-patterns
---
```

The agent body must include:
- Full persona (from spec)
- The 8-step workflow above
- Verdict rules table
- GitHub review output format template (from spec)
- Human override instructions (dismiss review + OVERRIDE: [reason])
- Metrics JSONL entry format (from spec Layer 4)
- Reference to shared schemas for severity and output format

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/chief-reviewer.md
git commit -m "feat(review-board): add Chief Reviewer orchestrator agent (SYN-591)"
```

---

## Chunk 7: Layer 1 — Triage Script + GitHub Actions Workflow

### Task 18: Create the triage script

**Files:**
- Create: `.claude/review-board/triage.sh`

- [ ] **Step 1: Write the triage script**

The script must implement the full classification pipeline. Here is the complete logic:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Input ──────────────────────────────────────────────
PR_NUMBER="${PR_NUMBER:-${GITHUB_EVENT_NUMBER:-0}}"
BRANCH="${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}"
BASE_REF="${GITHUB_BASE_REF:-main}"

# ── Step 1: Gather diff data ──────────────────────────
CHANGED_FILES=$(git diff --name-only "origin/${BASE_REF}...HEAD")
DIFF_STAT=$(git diff --stat "origin/${BASE_REF}...HEAD" | tail -1)

FILES_CHANGED=$(echo "$DIFF_STAT" | grep -oP '\d+(?= files? changed)' || echo "0")
INSERTIONS=$(echo "$DIFF_STAT" | grep -oP '\d+(?= insertions?)' || echo "0")
DELETIONS=$(echo "$DIFF_STAT" | grep -oP '\d+(?= deletions?)' || echo "0")
TOTAL_LINES=$((INSERTIONS + DELETIONS))

# ── Step 2: Detect lockfile-only PRs ──────────────────
LOCKFILE_ONLY=true
while IFS= read -r file; do
  case "$file" in
    package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb) ;;
    *) LOCKFILE_ONLY=false; break ;;
  esac
done <<< "$CHANGED_FILES"

# ── Step 3: Detect high-risk paths ────────────────────
HIGH_RISK_PATHS=()
CRITICAL_PATHS=()
while IFS= read -r file; do
  case "$file" in
    lib/auth/*|lib/stripe/*|middleware.ts)
      HIGH_RISK_PATHS+=("$file") ;;
    app/api/*)
      HIGH_RISK_PATHS+=("$file") ;;
    prisma/schema.prisma|prisma/migrations/*)
      CRITICAL_PATHS+=("$file") ;;
    .env*|next.config.mjs|vercel.json)
      CRITICAL_PATHS+=("$file") ;;
  esac
done <<< "$CHANGED_FILES"

# ── Step 4: Check commit messages for escalation ──────
ESCALATION_KEYWORDS=false
COMMITS=$(git log --oneline "origin/${BASE_REF}...HEAD" --format="%s")
if echo "$COMMITS" | grep -qiE '^(BREAKING|migration|security):'; then
  ESCALATION_KEYWORDS=true
fi

# ── Step 5: Check PR labels (from GitHub event payload) ─
ESCALATION_LABELS=false
if [ -n "${GITHUB_EVENT_PATH:-}" ] && [ -f "$GITHUB_EVENT_PATH" ]; then
  LABELS=$(jq -r '.pull_request.labels[]?.name // empty' "$GITHUB_EVENT_PATH" 2>/dev/null || true)
  if echo "$LABELS" | grep -qiE '^(security|breaking-change|migration)$'; then
    ESCALATION_LABELS=true
  fi
fi

# ── Step 6: Detect new dependencies ───────────────────
NEW_DEPS="[]"
if echo "$CHANGED_FILES" | grep -q "^package\.json$"; then
  NEW_DEPS=$(git diff "origin/${BASE_REF}...HEAD" -- package.json \
    | grep -E '^\+\s+"[^"]+":' | grep -v '"version"' \
    | sed 's/.*"\([^"]*\)".*/"\1"/' | jq -sc '.' 2>/dev/null || echo "[]")
fi

# ── Step 7: Classify tier ─────────────────────────────
TIER="standard"  # default

# Lockfile-only => trivial (regardless of size)
if [ "$LOCKFILE_ONLY" = true ]; then
  TIER="trivial"
# Only docs/config files => trivial
elif echo "$CHANGED_FILES" | grep -qvE '\.(md|txt|gitignore|yml|yaml|json)$' 2>/dev/null; then
  TIER="standard"  # has code files
else
  TIER="trivial"   # only docs/config
fi

# Critical paths => critical
if [ ${#CRITICAL_PATHS[@]} -gt 0 ]; then
  TIER="critical"
# High-risk paths => high-risk minimum
elif [ ${#HIGH_RISK_PATHS[@]} -gt 0 ]; then
  [ "$TIER" = "trivial" ] || [ "$TIER" = "standard" ] && TIER="high-risk"
fi

# Escalation keywords/labels => bump by one
if [ "$ESCALATION_KEYWORDS" = true ] || [ "$ESCALATION_LABELS" = true ]; then
  case "$TIER" in
    trivial)   TIER="standard" ;;
    standard)  TIER="high-risk" ;;
    high-risk) TIER="critical" ;;
  esac
fi

# Large diff => bump by one (unless lockfile-only)
if [ "$LOCKFILE_ONLY" = false ] && [ "$TOTAL_LINES" -gt 500 ]; then
  case "$TIER" in
    trivial)   TIER="standard" ;;
    standard)  TIER="high-risk" ;;
    high-risk) TIER="critical" ;;
  esac
fi

# ── Step 8: Map tier to specialists + timeout ─────────
case "$TIER" in
  trivial)
    SPECIALISTS='["commit-hygiene","dx-review"]'
    TIMEOUT=120
    ;;
  standard)
    SPECIALISTS='["security","architecture","route-compliance","typescript-strictness","performance","breaking-changes","react-patterns","dependency-audit","accessibility","test-quality","code-quality","dx-review","commit-hygiene","api-testing"]'
    TIMEOUT=300
    ;;
  high-risk)
    SPECIALISTS='["security","architecture","route-compliance","typescript-strictness","performance","database-review","breaking-changes","react-patterns","dependency-audit","accessibility","test-quality","code-quality","dx-review","commit-hygiene","supabase-patterns","api-testing"]'
    TIMEOUT=480
    ;;
  critical)
    SPECIALISTS='["security","architecture","route-compliance","typescript-strictness","performance","database-review","breaking-changes","react-patterns","dependency-audit","accessibility","test-quality","code-quality","dx-review","commit-hygiene","supabase-patterns","api-testing"]'
    TIMEOUT=600
    # Critical tier: add label + Slack notification
    if [ -n "${GH_TOKEN:-}" ] && [ "$PR_NUMBER" -gt 0 ]; then
      gh pr edit "$PR_NUMBER" --add-label "needs-human-review" 2>/dev/null || true
      # Slack notification (if SLACK_WEBHOOK_URL is set)
      if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
          -H "Content-Type: application/json" \
          -d "{\"text\":\"Review Board: CRITICAL PR #${PR_NUMBER} requires human review. <https://github.com/${GITHUB_REPOSITORY}/pull/${PR_NUMBER}|View PR>\"}" \
          || true
      fi
    fi
    ;;
esac

# ── Step 9: Rotate metrics (cap at 500 entries, archive >90 days) ──
METRICS_FILE=".claude/review-board/metrics.jsonl"
ARCHIVE_DIR=".claude/review-board/metrics-archive"
if [ -f "$METRICS_FILE" ]; then
  NINETY_DAYS_AGO=$(date -u -d "90 days ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-90d +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo "")
  if [ -n "$NINETY_DAYS_AGO" ]; then
    MONTH=$(date -u +%Y-%m)
    mkdir -p "$ARCHIVE_DIR"
    # Archive entries older than 90 days
    jq -c "select(.date < \"$NINETY_DAYS_AGO\")" "$METRICS_FILE" >> "$ARCHIVE_DIR/$MONTH.jsonl" 2>/dev/null || true
    jq -c "select(.date >= \"$NINETY_DAYS_AGO\")" "$METRICS_FILE" > "${METRICS_FILE}.tmp" 2>/dev/null || true
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE" 2>/dev/null || true
  fi
  # Cap at 500 entries
  LINE_COUNT=$(wc -l < "$METRICS_FILE" 2>/dev/null || echo "0")
  if [ "$LINE_COUNT" -gt 500 ]; then
    tail -500 "$METRICS_FILE" > "${METRICS_FILE}.tmp"
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
  fi
fi

# ── Step 10: Build high-risk paths JSON ───────────────
HIGH_RISK_JSON="[]"
if [ ${#HIGH_RISK_PATHS[@]} -gt 0 ] || [ ${#CRITICAL_PATHS[@]} -gt 0 ]; then
  ALL_RISK=("${HIGH_RISK_PATHS[@]}" "${CRITICAL_PATHS[@]}")
  HIGH_RISK_JSON=$(printf '%s\n' "${ALL_RISK[@]}" | jq -Rsc 'split("\n") | map(select(. != ""))')
fi

# ── Step 11: Build manifest + write outputs ───────────
cat > manifest.json <<MANIFEST
{
  "pr_number": ${PR_NUMBER},
  "branch": "${BRANCH}",
  "tier": "$TIER",
  "specialists": $SPECIALISTS,
  "timeout_seconds": $TIMEOUT,
  "diff_stats": { "files_changed": $FILES_CHANGED, "insertions": $INSERTIONS, "deletions": $DELETIONS },
  "high_risk_paths": $HIGH_RISK_JSON,
  "new_dependencies": $NEW_DEPS
}
MANIFEST

echo "tier=$TIER" >> "$GITHUB_OUTPUT"
echo "timeout=$TIMEOUT" >> "$GITHUB_OUTPUT"
echo "manifest=$(jq -c . manifest.json)" >> "$GITHUB_OUTPUT"

echo "Triage complete: tier=$TIER, specialists=$(echo $SPECIALISTS | jq length), timeout=${TIMEOUT}s"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x .claude/review-board/triage.sh
```

- [ ] **Step 3: Commit**

```bash
git add .claude/review-board/triage.sh
git commit -m "feat(review-board): add PR triage classification script (SYN-591)"
```

---

### Task 19: Create the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/review-board.yml`

- [ ] **Step 1: Write the workflow YAML**

Use the exact YAML from the spec (lines 506-577), with these adjustments:
- `concurrency` group to cancel previous runs on force-push
- `if: github.event.pull_request.draft == false` to skip drafts
- `continue-on-error: true` on the review step for circuit breaker
- Circuit breaker step posts a comment on infrastructure failure

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/review-board.yml
git commit -m "ci(review-board): add GitHub Actions review workflow (SYN-591)"
```

---

## Chunk 8: Verification & Cleanup

### Task 20: Verify all files exist and structure is correct

- [ ] **Step 1: List all created files**

```bash
find .claude/skills/review-board -name "*.md" | sort
find .claude/review-board -type f | sort
ls -la .claude/agents/chief-reviewer.md
ls -la .github/workflows/review-board.yml
```

Expected output:
- 11 new specialist SKILL.md files + 1 review-metrics SKILL.md + 2 shared files = 14 files in review-board/skills
- 4 files in .claude/review-board/ (README.md, triage.sh, metrics.jsonl, metrics-archive/.gitkeep)
- 1 agent file (chief-reviewer.md)
- 1 workflow file (review-board.yml)

- [ ] **Step 2: Verify the 5 upgraded existing skills have the Review Board Output section**

```bash
grep -l "Review Board Output" .claude/skills/code-review/SKILL.md \
  .claude/skills/route-auditor/SKILL.md \
  .claude/skills/architecture-enforcer/SKILL.md \
  .claude/skills/security-hardener/SKILL.md \
  .claude/skills/api-testing/SKILL.md
```

Expected: all 5 files listed.

- [ ] **Step 3: Verify triage.sh is executable**

```bash
test -x .claude/review-board/triage.sh && echo "OK" || echo "FAIL"
```

- [ ] **Step 4: Update Linear issue SYN-591 with implementation complete status**

Add comment listing all files created, link to spec, note that branch protection must be configured manually in GitHub Settings.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git status
# If clean: done
# If dirty: commit remaining files
```

---

## Summary

| Chunk | Tasks | Files Created/Modified | Commits |
|-------|-------|----------------------|---------|
| 1: Foundation | 1-3 | 4 created | 3 |
| 2: Specialists Batch 1 | 4-7 | 4 created | 4 |
| 3: Specialists Batch 2 | 8-11 | 4 created | 4 |
| 4: Specialists Batch 3 | 12-15 | 4 created | 4 |
| 5: Existing Upgrades | 16 | 5 modified | 1 |
| 6: Chief Reviewer | 17 | 1 created | 1 |
| 7: Triage + Workflow | 18-19 | 2 created | 2 |
| 8: Verification | 20 | 0 | 0-1 |
| **Total** | **20 tasks** | **20 created, 5 modified** | **~19 commits** |

## Post-Implementation

After all tasks complete:
1. Create a PR from this branch to `main`
2. The Review Board workflow will attempt to review its own PR (meta!)
3. Configure branch protection in GitHub Settings (manual step for Phill)
4. Add `ANTHROPIC_API_KEY` to GitHub Actions secrets (manual step for Phill)
