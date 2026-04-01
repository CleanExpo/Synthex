# Synthex Architecture Reference

Last updated: 2026-04-01 | Milestone: v12.0

---

## Layer Rule (non-negotiable)

```
Pages (app/) → Components (components/) → Hooks (hooks/) → lib/ services → Database (Prisma)
```

No cross-layer imports. Each layer only imports from the layer directly below.

---

## Domain Architecture

| Domain       | Skill                 | Key lib path                  | Notes                                         |
| ------------ | --------------------- | ----------------------------- | --------------------------------------------- |
| Auth         | `auth-patterns`       | `lib/auth/`                   | Supabase ONLY — check here first, always      |
| AI/Content   | `content-pipeline`    | `lib/ai/`                     | Model registry, provider abstraction, BYOK    |
| Social       | `social-integrations` | `lib/social/`                 | 9 platforms, OAuth, webhooks, token encryption|
| API security | `route-auditor`       | `lib/rate-limit/`             | Zod validation, org scoping, rate limiting    |
| Database     | `database-prisma`     | `lib/prisma.ts`               | Schema patterns, migrations, query conventions|
| Security     | `security-hardener`   | `lib/audit/`                  | CSP, CORS, rate limiting, audit logging       |
| Deploy       | `build-orchestrator`  | `scripts/`, `vercel.json`     | Vercel, crons, env management                 |

---

## Auth Flow

```
Browser request
  → Supabase session cookie (httpOnly)
  → getAuthenticatedUser() in lib/auth/get-user.ts
  → JWT verification + RBAC role check
  → owner bypass (isOwnerEmail())
  → handler receives typed { userId, orgId, role }
```

**Functions available in `lib/auth/`:**
- `getAuthenticatedUser(req)` — primary auth check, returns user or null
- `getUserIdFromRequestOrCookies(req)` — ID-only (lightweight)
- `verifyTokenSafe(token)` — no-throw JWT decode
- `isOwnerEmail(email)` — owner bypass check

---

## API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

const RequestSchema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  // 2. Validate
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // 3. Org scope check
  if (parsed.data.orgId !== user.orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Business logic via lib/ service
  const result = await someService.create(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
```

**Error shape:** `{ error: string, details?: unknown }` for 4xx | `{ error: string, message?: string }` for 5xx

---

## Rate Limiting

| Category      | Limit      | Use for                |
| ------------- | ---------- | ---------------------- |
| `authStrict`  | 5 req/min  | Auth endpoints         |
| `writeDefault`| 30 req/min | Mutations (POST/PUT)   |
| `readDefault` | 120 req/min| Read endpoints         |

Import from `lib/rate-limit/` — never implement ad-hoc.

---

## Database Safety Rules

- **Never** drop columns, rename columns, or change column types without explicit approval
- New columns must have defaults or be nullable (backward-compatible migrations only)
- All queries must be org-scoped: `where: { orgId: user.orgId }` — never expose cross-org data
- Always run `npx prisma validate` before any `db push`
- Current schema: **131+ Prisma models** in `prisma/schema.prisma`

---

## Data Fetching Patterns

Three patterns — use the right one for the context:

| Context                     | Pattern                        | Package            |
| --------------------------- | ------------------------------ | ------------------ |
| Hook in `hooks/`            | `useApi()` / `useMutation()`   | `hooks/use-api.ts` |
| Standalone widget/component | `useSWR(url, fetchJson, opts)` | `swr`              |
| Server-side (API/action)    | `fetch()` directly             | native             |

**SWR reference implementation:** `components/dashboard/GamificationWidget.tsx`

```typescript
// Always use credentials: 'include' with SWR
const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());
const { data } = useSWR('/api/some-endpoint', fetcher);
```

**Anti-patterns:**
- ❌ raw `fetch()` in `'use client'` components — use SWR
- ❌ new custom fetch abstractions — use the three patterns above only
- ❌ missing `credentials: 'include'` on SWR fetcher

---

## AI/Content Architecture

- **Model registry:** `lib/ai/model-registry.ts` — all provider/model definitions live here
- **BYOK:** User-supplied API keys encrypted at rest via `lib/encryption/`
- **Provider priority:** Anthropic direct → OpenRouter → user BYOK
- **Claude 4.6 thinking:** `adaptive` mode — paired with `cache: true` on system prompt for repeat calls
- **Confidence gating:** every AI step returns `confidenceScore` (0.0–1.0); auto-approve ≥ 0.85

---

## Workflow Engine

Location: `lib/workflow/` (orchestrator, step-executor, context-builder)

- Max 2 automatic retries per step before human escalation
- Each step reads from `StepExecution.outputData` of previous — no full history injection
- Human approval gates mandatory for any step writing to external systems
- Parallel executions allowed; single-execution is default
- 7 step types: `ai-generate`, `ai-analyse`, `ai-enrich`, `human-approval`, `action-publish`, `action-schedule`, `action-notify`

---

## Front-End Patterns

```tsx
// Server Component (default — no directive needed)
export default function DashboardPage() {
  return <DashboardClient />;
}

// Client Component (add 'use client' only when you need hooks, events, browser APIs)
'use client';
export function DashboardClient() { ... }
```

- Component structure: `React.forwardRef` with `cn()` for className merging
- Always handle: loading, error, empty, success states
- Import with `@/` alias: `import { Button } from "@/components/ui/button"`
- Tailwind utilities only — no inline `style={{...}}`
- Design tokens (`text-cyan-400`, `bg-surface-dark`) over raw colours

**Known Turbopack quirk:** `@heroicons/react` ESM build has missing files. The `resolveAlias` in `next.config.mjs` fixes this — do not remove or modify those alias entries.
