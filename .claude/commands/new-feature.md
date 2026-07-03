---
description: Scaffold a complete feature the Synthex way — org-scoped API route (defineOrgRoute + Zod), a lib/ service, types, and a component with loading/error/empty states.
argument-hint: <feature-name>
---

# New Feature Command

Scaffold a complete feature called '$ARGUMENTS' following Synthex conventions.

> **Layers:** `app/api/$ARGUMENTS/route.ts` → `lib/$ARGUMENTS/` service → Prisma → Supabase, with UI in `components/` fetching via `hooks/`.
> **Naming:** React files `PascalCase.tsx`, utils/services `kebab-case.ts`.
> **Route ordering:** 401 (no session) → 403 (no org) → 400 (bad body) → 404 → 200/201.

## 1. API Route

Create `app/api/$ARGUMENTS/route.ts` using the typed route contract (auth + org-scope + Zod are built in):

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { defineOrgRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const createSchema = z.object({
  // define the create payload
});

// GET — list for the caller's org
export const GET = defineOrgRoute(
  {
    onError: e => logger.error('$ARGUMENTS list failed', { error: String(e) }),
  },
  async (_input, { clientId }) => {
    const items = await prisma.$ARGUMENTS.findMany({
      where: { organizationId: clientId },
    });
    return NextResponse.json({ data: items });
  }
);

// POST — create within the caller's org
export const POST = defineOrgRoute(
  { body: createSchema, serverErrorMessage: 'Failed to create $ARGUMENTS' },
  async ({ body }, { clientId }) => {
    const created = await prisma.$ARGUMENTS.create({
      data: { ...body, organizationId: clientId },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  }
);
```

For item-level operations create `app/api/$ARGUMENTS/[id]/route.ts` with GET/PUT/DELETE — every query filtered by `{ id, organizationId: clientId }` so an item from another org returns 404, never another org's data.

> Use `defineRoute` (not `defineOrgRoute`) only for endpoints that are intentionally not org-scoped. Error responses follow `{ error, details? }` — the contract handles this for you.

## 2. Service (`lib/$ARGUMENTS/`)

Create `lib/$ARGUMENTS/service.ts` holding the business logic:

- `list(orgId)` — return all items for the org
- `getById(orgId, id)` — return one or `null`
- `create(orgId, data)` — validate-then-persist
- `update(orgId, id, data)` / `remove(orgId, id)`

Rules: services own business logic and call Prisma directly; they never import from `app/`, `components/`, or `hooks/`. Always take `orgId` and scope every query by it.

## 3. Database (Prisma)

If the feature needs a new model, add it to `prisma/schema.prisma`:

- New columns must be **nullable or defaulted** (backward-compatible)
- Run `npx prisma validate` then `npx prisma generate`
- Apply the migration out of band via Supabase MCP `apply_migration` — **never `prisma db push`**

## 4. Types

Prefer generated Prisma types — `import type { $ARGUMENTS, Prisma } from '@prisma/client'`. Only add a file under `types/` for API-shaped types the Prisma model doesn't cover.

## 5. Component with ALL states (`components/$ARGUMENTS/`)

- `components/$ARGUMENTS/$ARGUMENTSPanel.tsx` — main component (`'use client'` only if it needs hooks/handlers)
- Data fetching via a hook using `useApiSWR` / `useApi` with an **org-scoped key** (so a brand switch never serves another brand's data)
- Render loading (skeleton), error, and empty states — every async surface needs all three

## 6. Wire it up

- Add navigation so a user can actually reach the feature
- Confirm the auth gate is correct for the intended role

## 7. Verify

```bash
npm run type-check && npm run lint && npm test
```

Paste the real output, then produce the verification checklist from `.claude/rules/verification-gate.md` before claiming done.
