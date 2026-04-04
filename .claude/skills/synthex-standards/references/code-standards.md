# Code Standards — Synthex Codebase Patterns

## Anti-Patterns (NEVER produce these)

```typescript
// ✗ Wrong router import
import { useRouter } from 'next/router'
// ✓ Correct
import { useRouter } from 'next/navigation'

// ✗ Direct navigation
window.location.href = '/path'
// ✓ Correct
const router = useRouter(); router.push('/path')

// ✗ Raw fetch in client component
const data = await fetch('/api/things').then(r => r.json())
// ✓ Correct (SWR with credentials)
const { data } = useSWR('/api/things', fetchJson)
// where fetchJson = (url) => fetch(url, { credentials: 'include' }).then(r => r.json())

// ✗ Any auth system other than Supabase
import { auth } from '@clerk/nextjs'
import { getServerSession } from 'next-auth'
// ✓ Always Supabase only
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils'

// ✗ Prisma query without org scope
await prisma.campaign.findMany()
// ✓ Always org-scoped
await prisma.campaign.findMany({ where: { organizationId } })

// ✗ Schema push (breaks production migrations)
npx prisma db push
// ✓ Safe migration
npx prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --script > migration.sql
npx prisma db execute --file migration.sql --schema prisma/schema.prisma

// ✗ any types
const handler = async (req: any, res: any) => {}
// ✓ Typed
export async function POST(request: NextRequest): Promise<NextResponse>

// ✗ Browser confirm/alert (blocks extension events)
window.confirm('Are you sure?')
// ✓ Sonner toast with action
toast.warning('...', { action: { label: 'Confirm', onClick: async () => {} } })

// ✗ Silent catch
catch (err) { /* nothing */ }
// ✓ Always handle or propagate
catch (err) {
  logger.error('context', { error: err })
  return NextResponse.json({ error: 'message' }, { status: 500 })
}
```

## Synthex Patterns

### Authentication

```typescript
const userId = await getUserIdFromRequestOrCookies(request);
if (!userId)
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
```

### Organisation scope

```typescript
// Direct org field
const items = await prisma.model.findMany({ where: { organizationId } });
// Via relation
const posts = await prisma.post.findMany({
  where: { campaign: { organizationId } },
});
```

### Mutation validation

```typescript
const Schema = z.object({ field: z.string().min(1) });
const parsed = Schema.safeParse(await request.json());
if (!parsed.success)
  return NextResponse.json(
    { error: 'Validation failed', details: parsed.error.flatten() },
    { status: 400 }
  );
```

### Error response shape

```typescript
// 4xx
{ error: string, details?: unknown }
// 5xx
{ error: string, message?: string }
```

### Rate limiting

```typescript
import { authStrict, writeDefault, readDefault } from '@/lib/rate-limit';
// authStrict: 5 req/min  (auth endpoints)
// writeDefault: 30 req/min (mutations)
// readDefault: 120 req/min (reads)
export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    /* handler */
  });
}
```

### Data fetching in components

```typescript
// In hooks/
const { data, error, isLoading, mutate } = useSWR('/api/things', url =>
  fetch(url, { credentials: 'include' }).then(r => r.json())
);

// In server/API routes
const res = await fetch('/api/things'); // native fetch, no SWR
```

## Language & Format

- Australian English in all user-facing strings
- Currency: AUD (never USD unless explicitly required)
- Dates: DD/MM/YYYY
- Commit format: `type(scope): description` e.g. `fix(api): resolve auth timeout`
- File naming: React `PascalCase.tsx` · Utils `kebab-case.ts` · Skills `SKILL.md`
