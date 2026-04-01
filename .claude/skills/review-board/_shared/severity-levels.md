# Review Board — Severity Level Definitions

## Levels

### CRITICAL

**Definition:** Exploitable security flaw, data loss, cross-org data leak, or production crash.

**Examples:** Hardcoded secrets, SQL injection, missing auth on mutation, org-scope bypass, unbounded DELETE, cross-organisation data exposure, unvalidated redirect.

**Merge impact:** Always blocks merge.

**Confidence requirement:** Report only if confidence >= 80%.

### HIGH

**Definition:** Correctness bug, compliance violation, or reliability risk that will cause user-facing issues.

**Examples:** Missing rate limiter on public endpoint, broken error handling, incorrect API response shape, missing Zod validation on POST/PUT/PATCH/DELETE, authentication bypass edge case.

**Merge impact:** Blocks merge when 3+ HIGH findings exist in a single review.

**Confidence requirement:** Report only if confidence >= 80%.

### MEDIUM

**Definition:** Quality or maintainability concern that should be addressed but is not urgent.

**Examples:** N+1 query, missing test coverage for changed code, cognitive complexity >15, missing ARIA labels, inefficient algorithm, missing React.memo on expensive component.

**Merge impact:** Noted in review as recommendation. Does not block merge.

**Confidence requirement:** Report only if confidence >= 80%.

### LOW

**Definition:** Style, convention, or documentation suggestion.

**Examples:** Naming inconsistency, missing JSDoc on exported function, magic numbers, commit message format, redundant code comment, import ordering.

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

## Synthex-Specific Calibration

When assessing severity, remember these are NOT bugs in Synthex:
- Australian English spellings (colour, organise, authorise, licence)
- Supabase-only auth (no Clerk, NextAuth, Auth.js)
- SWR with `credentials: 'include'` for client data fetching
- Selective error boundaries (not every component needs one)
- `as Prisma.InputJsonValue` casts (approved Prisma JSON pattern)
- `useRouter` from `next/navigation` (not `next/router`)
