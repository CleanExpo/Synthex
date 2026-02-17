# CLI Control Plane — Operational Rules

Primary directive: **Validate → Stabilize → Execute → Observe**

## Intent Classification

Before executing any task, classify the intent:

| Intent | Description | Risk | Gate |
|--------|-------------|------|------|
| **Build** | New feature, component, API route | MEDIUM | Type-check + lint after |
| **Fix** | Bug fix, error resolution | LOW–MEDIUM | Test before + after |
| **Refactor** | Restructure without behavior change | MEDIUM | Full test suite before + after |
| **Migrate** | Schema change, data migration | HIGH | Backup + rollback plan required |
| **Deploy** | Push to production | HIGH | release:check must pass |
| **Plan** | Design, architecture, roadmap | LOW | No code gate |
| **Audit** | Review, scan, analyze | LOW | Read-only — no mutations |
| **Explore** | Research, investigate, discover | LOW | Read-only — no mutations |

## Validation Gates

Block execution if prerequisites are missing:

```
BEFORE any code change:
  ✓ File has been READ (never edit blind)
  ✓ Intent classified
  ✓ Risk level assessed
  ✓ Affected files identified

BEFORE database changes:
  ✓ npx prisma validate passes
  ✓ Migration is backward-compatible (or rollback plan exists)
  ✓ No data loss without explicit user approval

BEFORE deployment:
  ✓ npm run type-check passes
  ✓ npm test passes (zero failures)
  ✓ npx prisma validate passes
  ✓ vercel.json is valid
  ✓ No secrets in committed files
```

## Migration Safety Mode

When modifying Prisma schema or creating migrations:

1. **Always validate first**: `npx prisma validate` before any schema push
2. **Backward compatibility**: New columns must have defaults or be optional
3. **No destructive changes** without explicit user instruction:
   - Dropping columns/tables
   - Renaming columns (breaks existing queries)
   - Changing column types (data loss risk)
4. **Rollback feasibility**: Every migration should be reversible
5. **Test with**: `npm run db:migrate:dry-run` when available

## Schema Awareness

The Prisma schema has 67 models. Key relationships:

- User → Organization → Campaign → Post → PlatformPost
- User → PlatformConnection → PlatformMetrics
- Campaign → ABTest → ABTestVariant → ABTestResult
- User → Subscription (Stripe)
- Report → ScheduledReport → ReportDelivery

**Rule**: Never modify a model without checking downstream dependencies.

## Execution Safety

Estimate risk before executing:

| Level | Criteria | Action |
|-------|----------|--------|
| **LOW** | Read-only, local files, no side effects | Execute freely |
| **MEDIUM** | Writes to files, modifies code, runs tests | Execute with verification |
| **HIGH** | Database changes, deployments, external API calls | Confirm with user first |

## Error Intelligence Format

When encountering errors, report in this format:

```
ERROR: [What happened]
CAUSE: [Root cause analysis]
FIX:   [Specific action to resolve]
BLOCKING: [yes/no — does this block the current task?]
```

## Environment Safety

- **Never commit** `.env`, `.env.local`, or files containing secrets
- **Never log** API keys, tokens, or passwords — even in debug output
- **Always use** environment variables for sensitive configuration
- **Verify** `.env.example` stays in sync when adding new env vars
- Production secrets live in **Vercel dashboard only**

## Dependency Stability

- **No unnecessary additions**: Only add packages that solve a real problem
- **Check bundle impact**: Consider serverless function size limits (50MB)
- **Prefer existing packages**: Check if functionality exists before adding new deps
- **Pin versions**: Use exact versions in package.json for predictability
- **Audit regularly**: `npm audit` for known vulnerabilities

## Hallucination Prevention

- **Never guess** file paths — use Glob/Grep to find them
- **Never assume** an API exists — read the source first
- **Never fabricate** test results — run the actual tests
- **Never invent** package names — check package.json
- **Never generate** URLs unless confident they're valid

## Partial Execution Mode

When a multi-step task encounters a failure mid-execution:

1. **Stop** at the failure point — don't continue blindly
2. **Report** what succeeded and what failed
3. **Assess** whether partial state is consistent
4. **Propose** either: fix and continue, or rollback to clean state
5. **Never** leave the codebase in an inconsistent state without flagging it

## Momentum Protection

- **Checkpoint** progress at natural breakpoints (after each file, each test pass)
- **Don't redo** work that already succeeded
- **Preserve context** — reference previous decisions, don't re-derive them
- **Batch related changes** — multiple small commits > one giant commit

## Supervision Signals

Watch for these signals from the user:

| Signal | Meaning | Response |
|--------|---------|----------|
| "LGTM" / "looks good" | Approval to proceed | Continue execution |
| "Wait" / "hold on" | Pause requested | Stop and await further input |
| "Why?" | Justification needed | Explain reasoning before continuing |
| "Revert" / "undo" | Rollback requested | Identify scope and revert cleanly |
| "Skip" | Bypass current step | Move to next step, note what was skipped |

## Strategic Signals

Recognize and respond to strategic context:

- **Time pressure**: Prioritize working solutions over perfect ones
- **Exploration phase**: Broad research, multiple options, no commitment
- **Hardening phase**: Lock down, test everything, no new features
- **Demo prep**: Focus on visible functionality, defer internal cleanup

## Confidence Output

Before major executions (deployments, migrations, large refactors), output confidence:

```
CONFIDENCE: [0-100]
RISK: [LOW/MEDIUM/HIGH]
REVERSIBLE: [yes/no/partial]
READY: [yes/no — all prerequisites met?]
```

Only proceed at CONFIDENCE >= 80 for HIGH risk actions.
Only proceed at CONFIDENCE >= 60 for MEDIUM risk actions.
LOW risk actions can proceed at any confidence level.
