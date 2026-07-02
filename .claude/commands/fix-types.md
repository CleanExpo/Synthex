---
description: Regenerate the Prisma client (the source of Synthex's DB types), then run the type-check gate and report real results.
allowed-tools: Read, Edit, Bash
---

# Fix Types Command

Regenerate database types and clear type errors. Synthex types come from **Prisma**, not `supabase gen types`.

## Steps

### 1. Validate the schema first

```bash
npx prisma validate
```

Stop and fix the schema if this fails — never regenerate against an invalid schema.

### 2. Regenerate the Prisma client

```bash
npx prisma generate
```

This regenerates `@prisma/client` from `prisma/schema.prisma`, giving every `lib/` service and route the current model types. (`npm run db:validate` runs validate + generate together.)

> Need raw Supabase row types for a one-off? Use the Supabase MCP `generate_typescript_types` tool — but the canonical type source for product code is the Prisma client.

### 3. Type-check

```bash
npm run type-check   # tsc --noEmit
```

Paste the actual output. If there are errors, fix them at the call sites — do not declare done while `tsc` reports errors.

### 4. Use generated types correctly

```typescript
import type { Prisma, Campaign } from '@prisma/client';

type CampaignWithPosts = Prisma.CampaignGetPayload<{
  include: { posts: true };
}>;
type CampaignCreateInput = Prisma.CampaignCreateInput;
```

## Common Issues

### Schema changed but types are stale

Re-run `npx prisma generate` — the client is generated, not hand-edited.

### "Cannot find module '@prisma/client'"

Run `npm install` (the `postinstall` hook runs `prisma generate`), then regenerate.

### Type conflicts with hand-written types in `types/`

Prefer the generated Prisma type; delete the duplicate hand-written definition and import from `@prisma/client`.

## Report

After completion, report:

- `prisma validate` result
- `prisma generate` result
- `npm run type-check` output (the real pass/error count)
- Any files that still need import updates
