---
name: api-testing
description: >-
  Synthex API testing enforcer. NEVER mock the database in integration tests —
  use real Supabase. NEVER skip the 401 (unauthenticated) or 403 (wrong org)
  test cases. NEVER use pnpm. ALWAYS structure tests as: 401 → 403 → 400 →
  200/201 happy path. Activate on ANY request to write API tests, validate
  endpoints, add test coverage, or check test quality.
metadata:
  author: synthex
  version: '2.0'
  engine: synthex-ai-agency
  type: capability-uplift-code
  triggers:
    - api test
    - endpoint testing
    - api validation
    - contract testing
    - api security check
    - api test
    - write tests
    - test coverage
    - endpoint test
    - integration test
  requires:
    - code-review
context: fork
---

# API Testing Agent

## Purpose

Validates SYNTHEX API endpoints for correctness, security, and contract compliance.
Tests all HTTP methods, validates Zod schemas, verifies authentication flows,
and monitors for breaking changes across the Next.js App Router API surface.

## When to Use

Activate this skill when:

- Creating or modifying API routes in `app/api/`
- Testing endpoint request/response contracts
- Validating API security (auth, rate limiting, CORS)
- Checking for breaking changes after schema updates
- Generating OpenAPI documentation from routes

## When NOT to Use This Skill

- When testing UI components or visual regressions (use design or ui-ux)
- When validating database schema changes (use database-prisma)
- When reviewing general code quality without API focus (use code-review)
- When performing E2E user flow testing (use Playwright directly)
- Instead use: `code-review` for non-API code, `database-prisma` for schema work

## Tech Stack

- **Framework**: Next.js 14+ App Router
- **Language**: TypeScript (strict mode)
- **Database**: Prisma ORM with PostgreSQL/Supabase
- **Authentication**: JWT with secure httpOnly cookies
- **Deployment**: Vercel Serverless Functions
- **Validation**: Zod schemas

## Instructions

1. **Identify target endpoints** — Scan `app/api/` for route handlers matching the test scope
2. **Validate HTTP methods** — Test all supported methods (GET, POST, PATCH, DELETE) per route
3. **Test request body validation** — Send valid and invalid payloads against Zod schemas
4. **Verify response codes** — Confirm correct status codes for success, error, and edge cases
5. **Check authentication** — Verify APISecurityChecker integration on protected routes
6. **Test authorization** — Confirm role-based access control (admin vs user vs anonymous)
7. **Validate rate limiting** — Verify request throttling is active and correctly configured
8. **Check CORS** — Confirm only whitelisted origins are allowed
9. **Test error handling** — Verify graceful error responses with no sensitive data leakage
10. **Generate report** — Output test results with pass/fail status per endpoint

## Input Specification

| Parameter | Type   | Required | Description                                       |
| --------- | ------ | -------- | ------------------------------------------------- |
| endpoint  | string | yes      | API route path (e.g., `/api/analytics/sentiment`) |
| method    | string | no       | HTTP method to test (default: all supported)      |
| scope     | string | no       | `security`, `contract`, `full` (default: `full`)  |

## Output Specification

| Field          | Type      | Description                     |
| -------------- | --------- | ------------------------------- |
| endpoint       | string    | Tested route path               |
| method         | string    | HTTP method tested              |
| status         | pass/fail | Test result                     |
| details        | string    | Error description if failed     |
| security_score | number    | 0-100 security compliance score |

## Error Handling

| Error                     | Action                               |
| ------------------------- | ------------------------------------ |
| Route not found           | Log warning, skip with clear message |
| Authentication failure    | Flag as critical security issue      |
| Schema mismatch           | Report expected vs actual types      |
| Timeout (>5s response)    | Flag as performance issue            |
| Rate limit not configured | Flag as security warning             |

## Key Directories

- `app/api/` — API route handlers
- `lib/security/` — Security utilities (APISecurityChecker)
- `lib/validations/` — Zod schemas
- `types/` — TypeScript interfaces

## Commands

```bash
pnpm test --filter=api          # Run API tests
pnpm turbo run type-check       # Type check API routes
pnpm run lint                   # Validate schemas
```

## Integration Points

- Works with **database-prisma** for data validation
- Coordinates with **code-review** for endpoint coverage
- Reports to **client-retention** for SLA monitoring

---

## Capability Uplift — Override Defaults

**NEVER** mock the database in integration tests — past incidents showed that
mock/prod divergence caused production failures that passing tests masked.
Never skip the unauthenticated (401) or wrong-org (403) test cases — these
are the most commonly exploited paths. Never use `pnpm` — this project uses `npm`.

**INSTEAD** every API route test suite covers these cases in this order:

```typescript
describe('POST /api/resource', () => {
  it('returns 401 when unauthenticated', async () => { ... })
  it('returns 403 when accessing another org', async () => { ... })
  it('returns 400 when body is invalid', async () => { ... })
  it('returns 201 on success', async () => { ... })
})
```

Tests run against real Supabase (test database). The test user is a real
auth.users row. The org is a real Organization row. No mocks for DB calls.

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
