# Synthex Code Standards Reference

Last updated: 2026-04-01

---

## Language & Localisation

- **Spelling:** Australian English — colour, organise, recognise, licence (noun), authorise, behaviour, catalogue
- **Currency:** AUD — always display as `$XX.XX AUD` or `A$XX.XX`
- **Dates:** DD/MM/YYYY — e.g. `01/04/2026`
- **Timezone:** AEST/AEDT — never PST or UTC in user-facing text

---

## File Naming

| Type              | Convention        | Example                          |
| ----------------- | ----------------- | -------------------------------- |
| React component   | `PascalCase.tsx`  | `TeamInviteBanner.tsx`           |
| Utility / service | `kebab-case.ts`   | `get-client-by-slug.ts`          |
| API route         | `route.ts`        | `app/api/advisor/route.ts`       |
| Test file         | `*.test.ts`       | `advisor-brief.test.ts`          |
| Skill             | `SKILL.md`        | `auth-patterns/SKILL.md`         |
| Hook              | `use-*.ts`        | `use-api.ts`                     |

---

## Git Commit Format

```
type(scope): short description

# Types: feat | fix | docs | refactor | test | chore | perf | security
# Scope: api | auth | ui | db | infra | deps | config

# Examples:
feat(api): add advisor-brief endpoint
fix(auth): resolve JWT expiry race condition
security(api): add org-scope check to tasks route
refactor(ui): extract TeamCard into shared component
```

All commits must reference a Linear issue where applicable:
```
feat(advisor): add weekly metrics cron (SYN-595)
```

---

## TypeScript Standards

```typescript
// ✅ Always explicit return types on exported functions
export async function getAdvisorBrief(orgId: string): Promise<AdvisorBrief | null> { ... }

// ✅ Type imports (reduces bundle impact)
import type { AdvisorBrief } from '@/lib/advisor/types';

// ✅ Unknown in catch blocks (not any)
try { ... } catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
}

// ❌ Never use 'any'
// ❌ Never use type assertions (as Type) without runtime validation
// ❌ Never suppress with @ts-ignore — fix the root cause
```

---

## API Route Standards

Every route must implement (in order):

1. **Rate limiting** — call the appropriate limiter from `lib/rate-limit/`
2. **Authentication** — `getAuthenticatedUser()` → return 401 if null
3. **Zod validation** — on ALL POST/PUT/PATCH/DELETE (not required on GET-only utility routes)
4. **Org scope check** — `parsed.data.orgId !== user.orgId` → return 403
5. **Business logic** — via `lib/` service, never inline in route handler

```typescript
// Error response shapes (always structured):
{ error: string, details?: unknown }  // 4xx responses
{ error: string, message?: string }   // 5xx responses
```

**Anti-patterns:**
- ❌ No auth check — any unauthenticated endpoint is a vulnerability
- ❌ No Zod on mutations — runtime crashes + injection risk
- ❌ Query without `orgId` filter — cross-org data leak
- ❌ Silent `catch` that swallows errors — log and return structured error
- ❌ `any` types in request/response bodies

---

## React Component Standards

```tsx
// 1. Loading state
if (isLoading) return <ComponentSkeleton />;

// 2. Error state
if (error) return <ComponentError error={error} />;

// 3. Empty state
if (!data?.length) return <ComponentEmpty onAction={handleCreate} />;

// 4. Success state
return <ComponentContent data={data} />;
```

Every component must handle all four states. Use `DashboardError` for error.tsx files.

---

## Prisma / Database Standards

```typescript
// ✅ Always org-scope every query
const result = await prisma.someModel.findMany({
  where: { orgId: user.orgId, ...otherFilters },
});

// ✅ Select only needed fields (performance + security)
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, orgId: true },
});

// ❌ Never query without orgId on org-owned models
// ❌ Never use prisma.user.findMany() without filter in production paths
// ❌ Never drop/rename columns without explicit approval
```

---

## Cron Route Standards

All cron-triggered routes must verify `CRON_SECRET`:

```typescript
const cronSecret = req.headers.get('x-cron-secret');
if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
}
```

---

## Environment Variables

- Never commit real values — only `.env.example` with placeholder descriptions
- New env vars must be added to `.env.example` with a comment explaining their purpose
- Production secrets live in Vercel dashboard only
- Never log API keys, tokens, or passwords — even in debug output

---

## Dependency Policy

Before installing any package:
1. Check if the functionality exists in the codebase already
2. State: package name + reason + estimated bundle size impact
3. Prefer packages already in the project over new ones
4. Serverless function size limit: 50MB — large packages need justification
