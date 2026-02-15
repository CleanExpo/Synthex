---
name: post-route-create
type: hook
trigger: After any file in app/api/ is created or significantly modified
priority: 1
blocking: false
version: 1.0.0
---

# Post-Route-Create Hook (NON-BLOCKING)

**PURPOSE**: Provides real-time compliance feedback whenever an API route is
created or significantly modified. Warns about missing security patterns but
does not block the workflow — the developer can address warnings before commit.

## Trigger Conditions

This hook activates after:
- A new file is created under `app/api/**/*.ts`
- An existing file under `app/api/**/*.ts` is modified with >10 lines changed
- A route handler function (GET, POST, PUT, DELETE, PATCH) is added or modified

## Quick Compliance Checks

### Check 1: Centralised Auth Import
**Scan for:** Import of `getUserIdFromRequestOrCookies` from `@/lib/auth/jwt-utils` OR import of `APISecurityChecker` from `@/lib/security/api-security-checker`.
```bash
grep -n "getUserIdFromRequestOrCookies\|APISecurityChecker" <file>
```
**If missing:** WARN — "This route does not use centralised auth. Import `getUserIdFromRequestOrCookies` from `@/lib/auth/jwt-utils` or use `APISecurityChecker.check()`."

### Check 2: Auth Enforcement
**Scan for:** `getUserIdFromRequestOrCookies(request)` call or `security.context.userId` usage in each handler.
```bash
grep -n "getUserIdFromRequestOrCookies\|security\.context\.userId\|unauthorizedResponse" <file>
```
**If missing:** WARN — "Handler functions should verify authentication. Add: `const userId = await getUserIdFromRequestOrCookies(request); if (!userId) return unauthorizedResponse();`"

### Check 3: No Raw JWT
**Scan for:** Direct `jwt.verify()` calls or `as any` casts.
```bash
grep -n "jwt\.verify\|as any" <file>
```
**If found:** WARN — "Found raw JWT verification or `as any` cast. Use `getUserIdFromRequestOrCookies()` from `@/lib/auth/jwt-utils` instead."

### Check 4: Input Validation on Mutating Handlers
**Scan for:** POST/PUT/DELETE/PATCH handlers that call `request.json()`.
**Then check:** Whether the parsed body is validated with Zod (`.parse(`, `.safeParse(`).
```bash
grep -n "request\.json()" <file>
grep -n "\.parse(\|\.safeParse(" <file>
```
**If `request.json()` exists without Zod validation:** WARN — "POST/PUT/DELETE body is not validated. Add Zod schema validation: `const body = schema.parse(await request.json())`"

### Check 5: NextRequest Type
**Scan for:** Handler parameter type.
```bash
grep -n "request: Request[^a-zA-Z]" <file>
```
**If found:** WARN — "Use `NextRequest` from `next/server` instead of generic `Request` type."

### Check 6: Runtime Export for Prisma
**Scan for:** Prisma usage without runtime export.
```bash
grep -n "from '@/lib/prisma'\|from '../.*prisma'" <file>
grep -n "export const runtime" <file>
```
**If Prisma imported but no runtime export:** WARN — "This route uses Prisma but doesn't export `runtime = 'nodejs'`. Add: `export const runtime = 'nodejs';`"

## Output Format

```
======================================
 Route Compliance Check: app/api/new-feature/route.ts
======================================

[PASS] Check 1: Centralised auth import found
[PASS] Check 2: Auth enforcement in handlers
[WARN] Check 3: Found jwt.verify() on line 23 — use centralised auth instead
[WARN] Check 4: POST body not validated with Zod (line 45)
[PASS] Check 5: Uses NextRequest type
[PASS] Check 6: Runtime export present

Result: 4/6 passed | 2 warnings
Action: Address warnings before committing

======================================
```

## Standard Route Template

When warnings are found, suggest this template as reference:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  // ... add fields
});

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  try {
    const data = await prisma.model.findMany({
      where: { userId },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  try {
    const body = createSchema.parse(await request.json());
    const data = await prisma.model.create({
      data: { ...body, userId },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}
```

## Reference Implementation

See `app/api/campaigns/route.ts` for a recently-audited route that passes all checks.

## Integration

- Uses checks from **route-auditor** skill (subset for speed)
- Non-blocking — allows development flow to continue
- Warnings feed into **senior-reviewer** agent if a review is triggered
- Complements **pre-deploy-security** hook which blocks at deploy time
