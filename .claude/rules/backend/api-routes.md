---
paths: app/api/**/*.ts, lib/**/*.ts
effort: medium
---

# API Route Rules (Next.js App Router)

## Route Handler Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

// Zod schema — required for all mutation routes
const RequestSchema = z.object({
  name: z.string().min(1).max(255),
  orgId: z.string(),
});

export async function POST(req: NextRequest) {
  // 1. Auth check
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // 2. Parse + validate body
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Org-scope check — user must belong to requested org
  if (parsed.data.orgId !== user.orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Business logic
  const result = await someService.create(parsed.data);

  return NextResponse.json(result, { status: 201 });
}
```

## Security Requirements

Every route must implement:

1. **Authentication** — call `getAuthenticatedUser()` or equivalent, return 401 if missing
2. **Zod validation** — on all POST/PUT/PATCH/DELETE routes (not required on GET-only utility routes)
3. **Org scoping** — queries must include `orgId: user.orgId` (never allow cross-org data)
4. **Rate limiting** — use `lib/rate-limit/` patterns appropriate for the category:
   - `authStrict`: 5 req/min (auth endpoints)
   - `writeDefault`: 30 req/min (mutations)
   - `readDefault`: 120 req/min (reads)

## Error Response Shape

```typescript
// Always return structured errors
{ error: string, details?: unknown }  // 4xx
{ error: string, message?: string }   // 5xx
```

## Key Utilities

| Import                 | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `lib/auth/get-user.ts` | Get authenticated user from session                          |
| `lib/rate-limit/`      | Rate limiter factory (authStrict, writeDefault, readDefault) |
| `lib/prisma.ts`        | Prisma client singleton                                      |

## Anti-Patterns

- ❌ No auth check — any unauthenticated endpoint is a vulnerability
- ❌ No Zod validation on mutations — runtime crashes and injection risk
- ❌ Query without `orgId` filter — cross-org data leak
- ❌ Catch-all `try/catch` that swallows errors silently — log and re-throw or return structured error
- ❌ `any` types in request/response — defeats TypeScript's safety
