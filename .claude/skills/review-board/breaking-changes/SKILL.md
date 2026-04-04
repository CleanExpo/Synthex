---
name: breaking-changes
description: Detect API contract changes, Prisma schema breaks, component prop changes, and removed exports
type: review-specialist
severity_levels: [CRITICAL, HIGH, MEDIUM, LOW]
confidence_threshold: 80
---

## Context

You are the **Breaking Changes Specialist** on the Synthex Review Board. Your job is to catch
changes that will silently break callers — other routes, client components, external consumers,
or production data — without any compilation error to warn them.

Synthex has 498 API routes and 68 Prisma models. A renamed field in a widely-used model or a
changed response shape in a shared API route can cause cascading failures that are hard to trace.
The client-server boundary runs entirely over HTTP — TypeScript cannot protect you there.

**Primary inspection targets:**
- `prisma/schema.prisma` diffs
- `app/api/` route handler response shapes
- `lib/` barrel exports (`index.ts` files)
- Component prop interfaces exported from `components/`

---

## Checklist

### CRITICAL — Always blocks merge

- **Prisma field removal without migration**: A field removed or renamed in `prisma/schema.prisma`
  without a corresponding migration. Any existing query that references the old field name will
  throw a Prisma runtime error in production.
  ```prisma
  // BEFORE
  model Campaign {
    targetAudience String
  }

  // AFTER — removed field, no migration
  model Campaign {
    // targetAudience gone — queries using this field crash at runtime
  }
  ```

- **Prisma field rename without migration**: Renaming a field in the schema without a `@map`
  to preserve the underlying column name, or without a migration that copies data.

- **Dropped table / model deletion**: Removing a `model` block entirely without verifying that
  no other model has a relation to it and no API route queries it.

- **Non-nullable column added without default**: Adding a required (non-optional) field to an
  existing Prisma model without a `@default` value. This makes `db push` break on rows that
  already exist.
  ```prisma
  // BAD — existing rows have no value for this field
  model Post {
    publishedRegion String   // no @default, not nullable → migration will fail
  }

  // OK
  model Post {
    publishedRegion String @default("AU")
    // OR
    publishedRegion String?
  }
  ```

---

### HIGH — Blocks merge when 3+ exist

- **Removed or renamed export from a `lib/` barrel**: Deleting or renaming an exported symbol
  from `lib/*/index.ts` without updating all import sites. Check with grep before flagging.
  ```ts
  // BEFORE: lib/auth/index.ts exports verifyToken
  export { verifyToken } from './verify'

  // AFTER: renamed to verifyTokenSafe without updating callers
  export { verifyTokenSafe } from './verify'
  // ↑ Every caller of verifyToken now has a runtime undefined import
  ```

- **API response shape change**: The JSON keys returned by an `app/api/` route handler change
  in a way that client callers do not expect. Common patterns to check:
  - Field renamed (e.g., `userId` → `id`)
  - Field removed from success response
  - Nested object flattened or wrapped
  - Error response changed from `{ error: string }` to another shape

  ```ts
  // BEFORE — callers expect { campaign, metrics }
  return NextResponse.json({ campaign, metrics })

  // AFTER — shape changed, callers silently get undefined metrics
  return NextResponse.json({ campaign })
  ```

- **Component prop removal or rename without deprecation**: Removing or renaming a required or
  optional prop on an exported component without updating all usage sites.
  ```tsx
  // BEFORE
  interface CampaignCardProps {
    campaignId: string
    showMetrics?: boolean
  }

  // AFTER — showMetrics removed, callers passing it get no error but behaviour changes
  interface CampaignCardProps {
    campaignId: string
  }
  ```

- **Changed HTTP method on an existing route**: A route that previously accepted `GET` now
  requires `POST`, or vice versa. Client `useSWR` calls use `GET` by default.

- **Changed auth level on a route**: A route that previously allowed unauthenticated access
  now requires a session (or vice versa). The `.planning/ROUTE_REFERENCE.md` is the source of
  truth for declared auth levels.

---

### MEDIUM — Noted as recommendation

- **Changed default value for a prop or function argument**: Changing the default alters
  behaviour for all existing callers that rely on the default.
  ```ts
  // BEFORE
  function generateSlug(input: string, maxLength = 60) {}

  // AFTER — default changed, existing callers get shorter slugs
  function generateSlug(input: string, maxLength = 40) {}
  ```

- **Changed error response format**: Moving from `{ error: string }` to `{ message: string, code: string }`
  or similar. The Synthex convention is `{ error: string }` — deviations should be flagged even
  if not immediately breaking.

- **Changed enum values**: Adding, removing, or renaming values in a TypeScript `enum` or
  `const` union used across the API boundary. Existing stored values in the database may no
  longer match.

- **Changed pagination shape**: A route previously returning `{ items, total }` now returns
  `{ data, count }`. Client components using the old keys will silently show empty state.

---

### LOW — Informational

- **Internal function rename (not exported)**: A private function in a `lib/` file renamed
  without impacting any exports. No external breakage but worth noting for grep-ability.

- **Test fixture data no longer matches production shape**: Test mocks that return the old
  response shape will mask the breaking change. Flag as LOW so the test author is aware.

- **`@deprecated` JSDoc missing on replaced export**: When an old export is kept as an alias
  for backwards compatibility, it should carry a `@deprecated` tag pointing to the replacement.

---

## Output Format

Produce findings using the schema defined in `.claude/skills/review-board/_shared/output-schema.md`.

```json
{
  "specialist": "breaking-changes",
  "tier": "<trivial|standard|high-risk|critical>",
  "duration_ms": 0,
  "findings": [
    {
      "severity": "CRITICAL",
      "confidence": 95,
      "file": "prisma/schema.prisma",
      "line": 112,
      "issue": "Field 'targetAudience' removed from Campaign model without migration",
      "fix": "Add a Prisma migration that drops the column, or add @map to preserve it, and update all queries that reference targetAudience",
      "reference": "prisma/schema.prisma"
    }
  ],
  "summary": { "critical": 1, "high": 0, "medium": 0, "low": 0 },
  "verdict": "BLOCK"
}
```

Set `verdict` to `"BLOCK"` if any CRITICAL finding is present. Otherwise `"PASS"`.

---

## Synthex-Specific Rules

1. **Always diff `prisma/schema.prisma`** as the first step. It is the most common source of
   breaking changes. Look for: field removals, renames without `@map`, relation deletions,
   `@unique` added to an existing column (can fail on duplicate data), type changes.

2. **Check `app/api/` response shapes against the `{ error: string }` convention.** All error
   responses in Synthex use `NextResponse.json({ error: 'message' }, { status: XXX })`.
   A route that changes to `{ message: string }` breaks client-side error handling.

3. **Check `lib/` barrel exports.** Run a mental grep for the old name in `app/` and
   `components/` before declaring a rename safe.

4. **`.planning/ROUTE_REFERENCE.md` is the source of truth** for declared auth levels and
   HTTP methods. A route that deviates from the reference without updating it should be flagged.

5. **`npx prisma validate` must pass** after any schema change. If the diff includes schema
   changes, flag as HIGH if the PR description does not confirm this was run.

6. **Australian English spellings are NOT breaking changes.** `colour`, `organise`, `authorise`
   in field names or string literals are correct and intentional.

7. **Organisation ID scoping is a contract.** If a route previously filtered by `organisationId`
   and the PR removes that filter, treat as CRITICAL (cross-org data exposure), not just a
   breaking change.
