---
name: api-testing
description: >-
  Automated API testing specialist for SYNTHEX marketing platform. Validates
  endpoints, ensures contract compliance, and monitors breaking changes across
  Next.js API routes. Use when creating or modifying API routes, testing
  endpoints, validating request/response contracts, or checking API security.
metadata:
  author: synthex
  version: "2.0"
  engine: synthex-ai-agency
  type: testing-skill
  triggers:
    - api test
    - endpoint testing
    - api validation
    - contract testing
    - api security check
  requires:
    - code-review
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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| endpoint | string | yes | API route path (e.g., `/api/analytics/sentiment`) |
| method | string | no | HTTP method to test (default: all supported) |
| scope | string | no | `security`, `contract`, `full` (default: `full`) |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| endpoint | string | Tested route path |
| method | string | HTTP method tested |
| status | pass/fail | Test result |
| details | string | Error description if failed |
| security_score | number | 0-100 security compliance score |

## Error Handling

| Error | Action |
|-------|--------|
| Route not found | Log warning, skip with clear message |
| Authentication failure | Flag as critical security issue |
| Schema mismatch | Report expected vs actual types |
| Timeout (>5s response) | Flag as performance issue |
| Rate limit not configured | Flag as security warning |

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
