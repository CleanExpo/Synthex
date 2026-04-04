# Synthex Review Board — Design Specification

**Date:** 2026-03-31
**Author:** Claude (brainstorming session with Phill)
**Status:** Draft
**Linear:** TBD (issue to be created on approval)

---

## Problem

Code reaches `main` without consistent, thorough review. The existing review infrastructure (4 agents, 5 skills, hooks) is powerful but fragmented — each piece runs independently, there is no orchestration layer, no risk-based triage, no unified verdict, and no merge enforcement via GitHub branch protection. The result: review quality depends on which tools happen to be invoked manually.

## Solution

A 4-layer automated code review system — the **Synthex Review Board** — that triggers on every PR to `main`, runs domain-specialist reviews in parallel, produces a unified verdict from a senior engineering authority, and tracks patterns over time to continuously improve.

## Success Criteria

- Every PR to `main` receives an automated review before merge is possible
- Zero CRITICAL issues reach `main` (hard gate via GitHub branch protection)
- Review completes in under 10 minutes for the largest PRs
- False positive rate stays below 15% (measured by human overrides)
- Recurring issues decrease month-over-month (learning loop signal)

---

## Severity Level Definitions

| Level | Definition | Examples | Merge Impact |
|-------|-----------|----------|-------------|
| **CRITICAL** | Exploitable security flaw, data loss, cross-org data leak, or production crash | Hardcoded secrets, SQL injection, missing auth on mutation, org-scope bypass, unbounded DELETE | Blocks merge |
| **HIGH** | Correctness bug, compliance violation, or reliability risk that will cause user-facing issues | Missing rate limiter, broken error handling, incorrect API response shape, missing Zod validation | Blocks merge (at 3+) |
| **MEDIUM** | Quality or maintainability concern that should be addressed but is not urgent | N+1 query, missing test coverage, cognitive complexity >15, missing ARIA labels | Noted in review |
| **LOW** | Style, convention, or documentation suggestion | Naming inconsistency, missing JSDoc, magic numbers, commit message format | Informational only |

---

## Cost Model

### Per-Review Estimates

| Tier | Specialists | Est. Input Tokens | Est. Output Tokens | Est. Cost (USD) |
|------|------------|-------------------|-------------------|----------------|
| Trivial | 2 | ~8K | ~2K | ~$0.15 |
| Standard | 12 | ~60K | ~15K | ~$1.20 |
| High-Risk | 16 | ~80K | ~20K | ~$1.60 |
| Critical | 16 + human flag | ~80K | ~20K | ~$1.60 |

### Monthly Budget (at 20 PRs/week)

Assuming 60% Standard, 25% High-Risk, 10% Trivial, 5% Critical:
- ~80 PRs/month: **~$85-110 USD/month** in Anthropic API usage
- Chief Reviewer synthesis adds ~$0.30 per review on top

These are estimates based on Opus pricing. Actual costs depend on diff sizes and specialist output length. The tiered dispatch system ensures trivial PRs (doc changes, config) cost 10x less than full reviews.

---

## Architecture

```
PR opened to main
       |
       v
+-------------------+
|    PR MANAGER     |  Layer 1: Triage & dispatch
|  (GitHub Action)  |
|                   |
|  Classify risk tier (trivial/standard/high-risk/critical)
|  Select specialists to invoke
|  Set review depth & timeout budget
+--------+----------+
         |
         v
+-------------------------------------------+
|         SPECIALIST PANEL                  |  Layer 2: Parallel domain reviews
|         (16 skills, run as subagents)     |
|                                           |
|  Batched in 4 groups of 4 (rate limits)  |
|                                           |
|  Security | Architecture | Performance    |
|  Database | TypeScript   | React          |
|  Routes   | Testing      | Accessibility  |
|  Breaking | Dependencies | DX             |
|  Commits  | API Contract | Bundle         |
|  Supabase Patterns                        |
+---------------------+--------------------+
                      | structured findings
                      v
+-------------------------------------------+
|         CHIEF REVIEWER                    |  Layer 3: Final authority
|         (Orchestrator Agent)              |
|                                           |
|  Persona: 15+ years at Google/Stripe/     |
|  Netflix. Systems thinker.                |
|                                           |
|  Collect -> Filter (80%) -> Deduplicate   |
|  -> Prioritise -> Synthesise -> Verdict   |
|  -> Post GitHub PR review                 |
|  -> Block merge if REQUEST_CHANGES        |
+---------------------+--------------------+
                      |
                      v
+-------------------------------------------+
|         LEARNING LOOP                     |  Layer 4: Metrics & improvement
|         (Post-review data collection)     |
|                                           |
|  Track verdicts, finding types, false     |
|  positives, time-to-review, specialist    |
|  accuracy, and code quality trends.       |
|  Suggest preventive lint rules when       |
|  patterns recur across 3+ PRs.           |
+-------------------------------------------+
```

---

## Layer 1: PR Manager

### Purpose

Triage incoming PRs by risk and dispatch the appropriate review depth.

### Implementation

A GitHub Actions workflow at `.github/workflows/review-board.yml` that:

1. Triggers on `pull_request` events targeting `main` (opened, synchronize, reopened)
2. Skips draft PRs (`if: github.event.pull_request.draft == false`)
3. Runs a classification script (`.claude/review-board/triage.sh`)
4. Outputs a JSON manifest for the orchestrator via `$GITHUB_OUTPUT`

### Risk Tiers

| Tier | Criteria | Specialists Invoked | Timeout |
|------|----------|-------------------|---------|
| **Trivial** | Only `.md`, `.txt`, comments, config files, `.gitignore` | commit-hygiene, dx-review | 2 min |
| **Standard** | Components, utils, styles, tests, hooks | Full panel minus security deep-scan and database-review | 5 min |
| **High-Risk** | `lib/auth/`, `app/api/`, `prisma/schema.prisma`, `lib/stripe/`, payments, middleware | Full panel including security deep-scan | 8 min |
| **Critical** | Database migrations, `.env` changes, auth system rewrites, `next.config.mjs`, `vercel.json` | Full panel + adds `needs-human-review` label to PR + Slack notification to #synthex-reviews | 10 min |

### Classification Signals

- **File paths:** `lib/auth/` or `prisma/` = high-risk minimum
- **Diff size:** >500 lines changed = bump tier by one level (exception: lockfile-only changes are capped at Trivial)
- **PR labels:** `security`, `breaking-change`, `migration` = automatic escalation
- **Commit messages:** `BREAKING:`, `migration:`, `security:` keywords = escalation
- **New dependencies:** Any additions to `package.json` = trigger dependency-audit
- **Lockfile-only:** PRs where ALL changed files are `package-lock.json`, `pnpm-lock.yaml`, or similar generated files = Trivial tier regardless of diff size

### Triage Script Output

The triage script writes outputs to `$GITHUB_OUTPUT` for downstream steps:

```bash
# .claude/review-board/triage.sh
# ... classification logic ...
echo "tier=$TIER" >> "$GITHUB_OUTPUT"
echo "timeout=$TIMEOUT" >> "$GITHUB_OUTPUT"
echo "manifest=$(cat manifest.json | jq -c)" >> "$GITHUB_OUTPUT"
```

### Manifest Schema

```json
{
  "pr_number": 42,
  "branch": "feature/campaign-analytics",
  "tier": "high-risk",
  "specialists": ["security", "architecture", "route-compliance", "database-review", "typescript-strictness", "performance", "test-quality", "breaking-changes", "code-quality", "react-patterns", "accessibility", "dependency-audit", "dx-review", "commit-hygiene", "supabase-patterns", "api-testing"],
  "timeout_seconds": 480,
  "diff_stats": { "files_changed": 12, "insertions": 340, "deletions": 85 },
  "high_risk_paths": ["lib/auth/session.ts", "app/api/analytics/route.ts"],
  "new_dependencies": []
}
```

---

## Layer 2: Specialist Panel

### Purpose

16 domain-focused review skills that each analyse the PR diff through their specific lens and produce structured findings.

### Parallelism Strategy

Specialists run in **4 batches of 4** to respect Anthropic API rate limits while maintaining speed:

| Batch | Specialists | Rationale |
|-------|------------|-----------|
| 1 | security, architecture, route-compliance, typescript-strictness | Core quality (must run first, findings may inform others) |
| 2 | performance, database-review, breaking-changes, react-patterns | Runtime behaviour |
| 3 | test-quality, accessibility, dependency-audit, supabase-patterns | Compliance & coverage |
| 4 | code-quality, dx-review, commit-hygiene, api-testing | Style & process |

Each specialist gets `total_timeout / 3` to allow for overhead and synthesis. For a high-risk PR (480s total), each specialist gets ~160s.

### Skill Registry

#### Existing Skills (Upgraded In-Place)

The 5 existing skills remain at their current file paths but receive a new `review-board-output` section appended to their SKILL.md. This avoids duplicating content while adding structured output for the Review Board. The Chief Reviewer references them by their existing paths.

| # | Skill ID | Focus | Source File (unchanged) |
|---|----------|-------|-------------|
| 1 | `code-quality` | Australian English, naming conventions, readability, dead code detection, cognitive complexity | `.claude/skills/code-review/SKILL.md` |
| 2 | `route-compliance` | Auth pattern (getUserIdFromRequestOrCookies), Zod validation, org scoping, NextRequest type, runtime export | `.claude/skills/route-auditor/SKILL.md` |
| 3 | `architecture` | Layer rule enforcement (Pages > Components > Hooks > lib/ > DB), no cross-layer imports, pattern consistency, no forbidden packages | `.claude/skills/architecture-enforcer/SKILL.md` |
| 4 | `security` | OWASP Top 10, hardcoded secrets, CSP headers, cookie flags (httpOnly, secure, sameSite), JWT safety, rate limiting coverage | `.claude/skills/security-hardener/SKILL.md` |
| 5 | `api-testing` | 401>403>400>200 test structure, real Supabase (never mocks), coverage for changed endpoints | `.claude/skills/api-testing/SKILL.md` |

#### New Skills

| # | Skill ID | Focus | Key Checks |
|---|----------|-------|------------|
| 6 | `performance` | Runtime efficiency | Bundle size delta (fail if +50KB client), N+1 query detection, serverless function size (<50MB), unnecessary re-renders, missing memo/useMemo |
| 7 | `breaking-changes` | Contract stability | Removed/renamed exports, Prisma schema field removals/renames, API response shape changes, component prop type changes, removed CSS classes |
| 8 | `typescript-strictness` | Type safety | No `as any` casts (except explicitly annotated), proper generics over union types, strict null checks, exhaustive switch/case, no @ts-ignore without ticket |
| 9 | `database-review` | Query health | Missing indexes on WHERE/JOIN columns, unbounded queries (no LIMIT on user-facing), RLS on all multi-tenant tables, no raw SQL concatenation, migration backward compatibility |
| 10 | `react-patterns` | Component quality | Hooks rules (deps arrays), key prop usage (no array index), stale closure detection, effect cleanup, proper error boundaries, no state updates during render |
| 11 | `dependency-audit` | Supply chain safety | npm audit (critical/high), license compliance (block GPL-2/3, AGPL), bundle size impact of new packages, duplicate package detection, outdated major versions |
| 12 | `accessibility` | Inclusive design | WCAG 2.1 AA compliance, ARIA labels on interactive elements, contrast ratios (4.5:1 text, 3:1 large), keyboard navigation, focus management, skip links |
| 13 | `test-quality` | Test effectiveness | Coverage gaps in changed files, test naming conventions, edge case coverage (null, empty, boundary), no mocked database, assertion quality (not just "no throw") |
| 14 | `commit-hygiene` | Git discipline | Conventional commit format (`type(scope): desc`), atomic commits (one concern per commit), no merge commits in PR, branch naming convention, no fixup/squash leftovers |
| 15 | `dx-review` | Developer experience | Function/variable naming clarity, cognitive complexity (<15 per function), file organisation, documentation on non-obvious logic, no magic numbers without constants |
| 16 | `supabase-patterns` | Platform alignment | auth.uid() usage in RLS, edge function Deno patterns, realtime subscription cleanup, storage bucket policies, no direct Prisma in client components |

**Note:** The existing `sql-hardener` skill's coverage (SQL injection, index optimisation) is subsumed by the `database-review` and `security` specialists. No coverage is lost.

### Skill File Structure

New skills live at `.claude/skills/review-board/<skill-id>/SKILL.md`:

```markdown
---
name: <skill-id>
description: <one-line description for the orchestrator>
type: review-specialist
severity_levels: [CRITICAL, HIGH, MEDIUM, LOW]
confidence_threshold: 80
---

## Context
[What this specialist reviews and why it matters]

## Checklist
[Ordered list of checks, grouped by severity]

## Output Format
[Structured findings template — must match the Specialist Output Schema]

## Synthex-Specific Rules
[Patterns unique to this codebase]
```

### Specialist Output Schema

Every specialist produces findings in this exact format:

```json
{
  "specialist": "security",
  "tier": "high-risk",
  "duration_ms": 12400,
  "findings": [
    {
      "severity": "CRITICAL",
      "confidence": 95,
      "file": "app/api/analytics/route.ts",
      "line": 28,
      "issue": "Query uses userId without orgId — cross-org data leak",
      "fix": "Add organisationId to WHERE clause, use getOrganisationId() helper",
      "reference": "lib/auth/get-organisation.ts:15 for pattern"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 0,
    "medium": 2,
    "low": 1
  },
  "verdict": "BLOCK"
}
```

---

## Layer 3: Chief Reviewer (Orchestrator Agent)

### Purpose

Synthesise all specialist findings into a single, authoritative PR review posted to GitHub.

### Relationship to Existing Agents

The **Chief Reviewer** replaces the existing `senior-reviewer.md` agent for automated CI-triggered reviews. The `senior-reviewer` agent remains available for manual invocation (e.g., ad-hoc review of a specific file or component during development). The Chief Reviewer has broader scope (16 specialists vs. senior-reviewer's 5) and structured output for GitHub integration.

### Agent Definition

File: `.claude/agents/chief-reviewer.md`

**Persona:**

> You are the Chief Code Reviewer for Synthex. You have 15+ years of engineering leadership at Google, Stripe, Netflix, and Atlassian. You have reviewed thousands of PRs, shipped systems serving billions of requests, and mentored hundreds of engineers.
>
> You think in systems, not lines. You care about correctness, security, and maintainability — in that order. You are direct, constructive, and never petty. You praise good work and flag real problems. You understand that shipping matters, so you distinguish between "must fix before merge" and "improve in a follow-up."
>
> You never produce vague feedback. Every finding has a file, line, issue, and fix. Every verdict has a clear rationale. You treat the developer as a peer — explain the why, not just the what.

### Workflow

1. **Receive** all specialist findings (JSON array)
2. **Filter** — discard any finding with confidence < 80%
3. **Deduplicate** — if multiple specialists flag the same file:line, keep the highest-severity version
4. **Prioritise** — sort: CRITICAL first, then HIGH, MEDIUM, LOW
5. **Contextualise** — read the PR title, description, and commit messages to understand developer intent
6. **Synthesise** — produce a unified review:
   - Executive summary (1-2 sentences, what this PR does and what the review found)
   - Blocking issues table (CRITICAL + HIGH that require changes)
   - Recommendations (MEDIUM findings, suitable for follow-up PRs)
   - Commendations (what was done well — always include at least one)
   - Specialist breakdown (which specialists ran, findings per specialist)
   - Verdict with rationale (state which rule triggered the verdict)
7. **Post** — submit as a GitHub PR review using `gh pr review`

### Verdict Rules

| Condition | Verdict | Merge Status |
|-----------|---------|-------------|
| Any CRITICAL finding (after 80% confidence filter) | `REQUEST_CHANGES` | **Blocked** |
| 3+ HIGH findings | `REQUEST_CHANGES` | **Blocked** |
| 1-2 HIGH findings | `COMMENT` | Allowed (with warnings) |
| Only MEDIUM/LOW findings | `APPROVE` | Allowed |
| Zero findings | `APPROVE` | Allowed |

Rules are evaluated top-to-bottom; the first matching condition determines the verdict.

### Human Override Mechanism

When a developer believes a finding is a false positive or the block is incorrect:

1. **Dismiss the review** in GitHub UI (click "Dismiss review" on the Chief Reviewer's review)
2. **Add a comment** explaining why: `OVERRIDE: [reason]` (e.g., `OVERRIDE: This is a test fixture, not production code`)
3. The override is logged in the metrics JSONL with `"human_override": true` and the override reason
4. The PR can then be merged (the required status check still passes independently of the review)

Overrides are tracked in Layer 4 metrics. If override rate exceeds 30% for a specialist, that specialist's rules are flagged for review.

### GitHub Review Format

```markdown
## Synthex Review Board

**Verdict: REQUEST_CHANGES** (triggered by: 1 CRITICAL finding)

### Summary
This PR adds campaign analytics endpoints. The specialist panel identified
an org-scoping gap in the query layer and a missing rate limiter.

### Blocking Issues
| # | Severity | File:Line | Issue | Fix |
|---|----------|-----------|-------|-----|
| 1 | CRITICAL | `app/api/analytics/route.ts:28` | Query uses userId without orgId | Add organisationId to WHERE clause |
| 2 | HIGH | `app/api/analytics/route.ts:1` | No rate limiter | Import authStrict from lib/rate-limit/ |
| 3 | HIGH | `app/api/analytics/route.ts:45` | Missing Zod validation on query params | Add z.object schema with safeParse |

### Recommendations
- Add EXPLAIN ANALYZE for the analytics aggregation query (3+ JOINs)
- Test coverage: add 403 (wrong org) test case per api-testing standard

### Commendations
- Clean separation of analytics logic into a service function
- Good use of the existing SWR fetcher pattern in the dashboard component
- Proper TypeScript generics on the response type

### Specialist Panel
| Specialist | Findings | Verdict |
|-----------|----------|---------|
| security | 1 CRITICAL | BLOCK |
| route-compliance | 2 HIGH | BLOCK |
| architecture | 0 | PASS |
| performance | 1 MEDIUM | PASS |
| ... | ... | ... |

---
*Reviewed by Synthex Review Board | 16 specialists | Confidence: 80%+ | Duration: 45s*
*To override: dismiss this review and comment `OVERRIDE: [reason]`*
```

---

## Layer 4: Learning Loop + Metrics

### Purpose

Track review patterns over time to identify recurring issues, measure review effectiveness, and suggest preventive improvements.

### Data Collection

After each review, the Chief Reviewer appends an entry to `.claude/review-board/metrics.jsonl` (JSON Lines format, one entry per line):

```json
{
  "pr_number": 42,
  "date": "2026-03-31T20:15:00+11:00",
  "branch": "feature/campaign-analytics",
  "tier": "high-risk",
  "specialists_run": 16,
  "duration_seconds": 45,
  "findings": {
    "critical": 1,
    "high": 2,
    "medium": 3,
    "low": 1,
    "total": 7,
    "filtered_low_confidence": 2
  },
  "verdict": "REQUEST_CHANGES",
  "verdict_trigger": "1 CRITICAL finding",
  "top_finding_types": ["org-scoping", "rate-limiting", "zod-validation"],
  "specialists_with_findings": ["security", "route-compliance", "performance"],
  "human_override": false,
  "override_reason": null
}
```

### Metrics File Rotation

- Entries older than 90 days are archived to `.claude/review-board/metrics-archive/YYYY-MM.jsonl`
- Active file is capped at 500 entries; oldest are rotated on append
- Rotation is handled by the triage script at the start of each review run

### Metrics Skill

A `/review-metrics` slash command skill (`.claude/skills/review-board/review-metrics/SKILL.md`) that reads the JSONL log and produces:

- **Weekly summary:** PRs reviewed, approve/block ratio, avg review time
- **Recurring issues:** Finding types that appear in 3+ consecutive PRs
- **Specialist effectiveness:** Which specialists produce the most actionable findings
- **Quality trend:** Are blocking issues decreasing over time?
- **Preventive suggestions:** When a finding type recurs 3+ times, suggest a lint rule or hook

### Learning Signals

| Signal | Threshold | Action |
|--------|-----------|--------|
| Same finding type in 3+ consecutive PRs | 3 PRs | Suggest lint rule or pre-commit hook |
| Specialist consistently produces 0 findings | 10 consecutive reviews | Consider removing from default panel for that tier |
| Human override rate > 30% for a specialist | 10+ reviews | Review specialist's rules for false positives |
| Average review time > 8 minutes | 5 consecutive reviews | Investigate bottleneck specialist, consider parallelisation improvements |
| Blocking rate > 50% | 20+ reviews | The team may need training on common issues — surface top 3 |

---

## File Structure

```
.claude/
  agents/
    chief-reviewer.md              # Layer 3 orchestrator agent (NEW)
    senior-reviewer.md             # Existing — kept for manual invocation
  skills/
    # Existing skills (upgraded in-place with review-board output section)
    code-review/SKILL.md
    route-auditor/SKILL.md
    architecture-enforcer/SKILL.md
    security-hardener/SKILL.md
    api-testing/SKILL.md

    # New review-board skills
    review-board/
      _shared/
        output-schema.md           # Shared finding format for all specialists
        severity-levels.md         # CRITICAL/HIGH/MEDIUM/LOW definitions
      performance/SKILL.md         # Specialist 6 (new)
      breaking-changes/SKILL.md    # Specialist 7 (new)
      typescript-strictness/SKILL.md  # Specialist 8 (new)
      database-review/SKILL.md     # Specialist 9 (new)
      react-patterns/SKILL.md      # Specialist 10 (new)
      dependency-audit/SKILL.md    # Specialist 11 (new)
      accessibility/SKILL.md       # Specialist 12 (new)
      test-quality/SKILL.md        # Specialist 13 (new)
      commit-hygiene/SKILL.md      # Specialist 14 (new)
      dx-review/SKILL.md           # Specialist 15 (new)
      supabase-patterns/SKILL.md   # Specialist 16 (new)
      review-metrics/SKILL.md      # Layer 4 metrics reporter
  review-board/
    triage.sh                      # Layer 1 classification script
    metrics.jsonl                  # Layer 4 review history log
    metrics-archive/               # Rotated metrics (>90 days)
    README.md                      # System documentation

.github/
  workflows/
    review-board.yml               # GitHub Actions trigger workflow
```

---

## GitHub Actions Integration

### Workflow: `.github/workflows/review-board.yml`

```yaml
name: Synthex Review Board
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

concurrency:
  group: review-board-${{ github.event.pull_request.number }}
  cancel-in-progress: true  # New push cancels previous review

jobs:
  review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for diff analysis

      - name: Triage PR
        id: triage
        run: bash .claude/review-board/triage.sh

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Write manifest to file
        run: echo '${{ steps.triage.outputs.manifest }}' > .claude/review-board/manifest.json

      - name: Run Review Board
        id: review
        # Note: exact CLI flags will be adapted during implementation
        # to match the Claude Code CLI interface at build time.
        # The intent is: load the chief-reviewer agent with the
        # triage manifest as context, output the review to a file.
        run: |
          claude -p "You are the Chief Reviewer. Review this PR using the manifest at .claude/review-board/manifest.json. Follow the agent instructions in .claude/agents/chief-reviewer.md. Write the review to .claude/review-board/latest-review.md and the verdict (approve/request-changes/comment) to .claude/review-board/latest-verdict.txt." \
            --timeout ${{ steps.triage.outputs.timeout }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        continue-on-error: true

      - name: Post Review (on success)
        if: steps.review.outcome == 'success'
        run: |
          VERDICT=$(cat .claude/review-board/latest-verdict.txt)
          gh pr review ${{ github.event.pull_request.number }} \
            --body-file .claude/review-board/latest-review.md \
            --$VERDICT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Circuit Breaker (on failure)
        if: steps.review.outcome == 'failure'
        run: |
          gh pr comment ${{ github.event.pull_request.number }} \
            --body "## Synthex Review Board — Infrastructure Error

          The automated review could not complete. This is NOT a code quality issue.

          **Reason:** Review pipeline failure (API timeout, rate limit, or infrastructure error).
          **Action:** Manual review is required for this PR. The automated check will not block merge due to this infrastructure failure.

          To retry: push a new commit or re-run the workflow.

          ---
          *Synthex Review Board | Infrastructure failure | $(date -u +%Y-%m-%dT%H:%M:%SZ)*"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Branch Protection Rules

Configure in GitHub Settings > Branches > Branch protection rules for `main`:

- **Require status checks to pass:** `Synthex Review Board / review`
  - This is the primary enforcement mechanism — the status check must pass
- **Do NOT rely on "Require pull request reviews"** for the bot review — `GITHUB_TOKEN` reviews don't count toward this requirement
- Optionally: require 1 human review in addition to the bot review (recommended for Critical tier PRs)

### Force-Push Behaviour

Each `synchronize` event triggers a fresh review. The `concurrency` group with `cancel-in-progress: true` ensures the previous review is cancelled and the new one starts clean. No findings carry over from previous runs.

---

## Dependencies

- **GitHub Actions** — workflow execution environment
- **Claude Code CLI** (`@anthropic-ai/claude-code`) — installed via npm in the workflow
- **ANTHROPIC_API_KEY** — stored as GitHub Actions secret
- **gh CLI** — for posting PR reviews (pre-installed on GitHub Actions runners)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| High token usage per review | Tiered dispatch — trivial PRs only run 2 specialists (~$0.15 vs ~$1.60) |
| False positives blocking merges | 80% confidence threshold + human override via review dismissal |
| Review takes too long | Per-tier timeouts, 4-batch parallelism, concurrency cancellation on new pushes |
| API rate limits | Specialists run in 4 batches of 4, max 1 concurrent review per PR |
| Stale review on force-push | `concurrency` group cancels previous run; fresh review on each push |
| Infrastructure failure blocks PRs | Circuit breaker: post comment explaining failure, mark check as neutral |
| Draft PR waste | Workflow skips draft PRs (`github.event.pull_request.draft == false`) |
| Lockfile bloat false escalation | Lockfile-only PRs capped at Trivial tier regardless of diff size |

---

## Out of Scope (Future Enhancements)

- CODEOWNERS-based routing (assign specific specialists based on file ownership)
- Cross-PR pattern analysis (detect patterns across multiple PRs, not just within one)
- Web dashboard for metrics visualisation
- Slack notifications on review verdicts (except Critical tier — included in this spec)
- Auto-fix suggestions (apply fixes automatically for simple issues)
- GitHub App token for bot reviews counting toward review requirements
