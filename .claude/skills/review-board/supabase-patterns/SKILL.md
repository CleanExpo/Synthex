# Supabase Patterns Specialist

> **type:** review-specialist
> **severity_levels:** CRITICAL, HIGH, MEDIUM, LOW
> **confidence_threshold:** 80

---

## Context

Supabase is Synthex's backend. Misuse of auth, RLS, Edge Functions, or client libraries creates data leaks, permission bypasses, and runtime failures. This specialist enforces Supabase security and architectural patterns.

**Synthex mandate:**
- Auth: Supabase Auth only — NEVER Clerk, NextAuth, Auth.js
- Prisma is the primary ORM for application logic
- Edge Functions use Deno; calls to them go through fetch() from Next.js
- 68 Prisma models, many containing user/org data → all require RLS policies
- Service-role key is admin-only; anon key for public endpoints
- JWT verification on Edge Functions; never trust raw headers

---

## Instructions

Analyse the PR diff for:

### 1. Auth System Violations (CRITICAL)

**CRITICAL severity:**
- Importing Clerk, NextAuth, Auth.js, or any auth system other than `@supabase/supabase-js`
- Hardcoded JWT secrets or API keys
- Direct use of Supabase admin client in client-side code (e.g., importing `SupabaseClient` in a `'use client'` component)

**HIGH severity:**
- Creating custom auth tokens outside of Supabase
- Passing auth tokens as query parameters (exposes in browser history, referrer headers)

### 2. Row-Level Security (RLS) Policies (severity varies)

**CRITICAL:**
- New table with user/org data but RLS is disabled (`enable_rls = false` in schema)
- RLS policy using `auth.uid()` without a NULL check (e.g., `SELECT ... WHERE user_id = auth.uid()` when `user_id` can be NULL)
- INSERT RLS missing USING clause (allows anyone to insert)
- DELETE RLS missing USING clause (unbounded delete)
- SELECT RLS with incomplete WHERE clause (e.g., `SELECT ... WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid())` that can return multiple rows)

**HIGH:**
- New table without RLS policy when it contains `user_id`, `org_id`, or `created_by` columns
- UPDATE policy missing WHERE condition on org_id (org users can edit other orgs' records)
- Service-role key used in client-side code (even if not visible, it's accessible in bundled JS)

**MEDIUM:**
- SELECT policy missing USING clause (queries return all rows, even if restricted later in application)
- Not using `auth.uid()` in RLS when a `user_id` column exists
- RLS policy without comment explaining the business rule it enforces

**LOW:**
- Inconsistent RLS naming (some policies use `user_policies`, others use `user_access`)
- Missing RLS audit trigger to log policy decisions

### 3. Supabase Client Usage (severity varies)

**CRITICAL:**
- `supabase.from('table').select('*')` in API route without auth check
- Admin client (`createClient(url, serviceRoleKey)`) used in middleware or client component

**HIGH:**
- Missing `select()` clause in Prisma query for sensitive columns (leaks data unnecessarily)
- Using `.data` without checking for errors in Edge Function (swallows failures)
- Supabase query without `eq()` filter on org_id when org data is expected

**MEDIUM:**
- Not using `.single()` when expecting single row (can return multiple rows silently)
- Error handling logs sensitive data (e.g., full error stack with query details)

**LOW:**
- Inconsistent Supabase client instantiation (some routes call `createClient()`, others use `supabaseClient`)

### 4. Edge Function Patterns (severity varies)

**CRITICAL:**
- Edge Function missing JWT verification (no `Authorization: Bearer` check)
- Edge Function calling Next.js endpoint without verifying the request came from Supabase (allows external calls)
- Edge Function returning raw error stack traces (leaks internal structure)

**HIGH:**
- Edge Function missing CORS headers (breaks cross-origin calls from browser)
- Edge Function not validating `auth.user()` before operating on user data
- Edge Function calling Prisma directly instead of through Next.js API (circumvents RLS)

**MEDIUM:**
- Edge Function logging raw request body (may contain secrets)
- Edge Function missing rate limiting on expensive operations

### 5. Org/User Scoping (severity varies)

**CRITICAL:**
- Query returning data from all orgs (e.g., `select * from campaigns` without `where org_id = current_org_id`)
- Cross-org data exposure in response (user A can see user B's data)

**HIGH:**
- API route mutation (POST/PUT/DELETE) without checking `org_id` ownership
- Missing auth check on GET routes serving user-specific data

**MEDIUM:**
- Org lookup in API route but scoped data query missing org_id filter
- Session token not validated before executing sensitive operation

### 6. Secrets & Environment (severity varies)

**CRITICAL:**
- API keys, JWT secrets, or credentials in source code (hardcoded)
- Secrets committed to git (check `.env`, `.env.local`, `.env.production`)

**HIGH:**
- Using anon key on mutation endpoint (should use service-role with RLS verification)
- Environment variable names don't match `.env.example`

---

## Output Format

```json
{
  "specialist": "supabase-patterns",
  "tier": "high-risk",
  "duration_ms": 0,
  "findings": [
    {
      "severity": "CRITICAL",
      "confidence": 95,
      "file": "lib/supabase/client.ts",
      "line": 12,
      "issue": "Service-role key used in client-side code; admin client accessible from browser",
      "fix": "Move service-role client to server-only files (app/api/ or lib/server/); use anon key + RLS for client",
      "reference": "lib/auth/supabase-patterns.md"
    },
    {
      "severity": "HIGH",
      "confidence": 88,
      "file": "app/api/campaigns/route.ts",
      "line": 25,
      "issue": "SELECT query missing org_id WHERE clause; returns campaigns from all orgs",
      "fix": "Add .eq('org_id', orgId) to filter by current organisation",
      "reference": "lib/multi-business/org-scoping.ts"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 1,
    "medium": 0,
    "low": 0
  },
  "verdict": "BLOCK"
}
```

**Rules:**
- Filter findings with confidence <80 before submitting
- `verdict` is BLOCK if any CRITICAL finding, otherwise PASS
- Include `reference` path if canonical pattern exists

---

## Confidence Calibration

**Critical confidence (95%):**
- Finding hardcoded API key or secret
- Clerk/NextAuth/Auth.js import detected
- Admin client (`createClient(url, serviceRoleKey)`) in `'use client'` component
- RLS policy with `SELECT ... WHERE user_id = auth.uid()` where `user_id` column is nullable

**High confidence (85%):**
- Missing RLS on new table with user/org data
- API mutation without org_id ownership check
- Edge Function missing JWT verification (no `Authorization` header read)
- Query returning all records without org filter

**Medium confidence (75-80%):**
- Edge Function missing CORS headers (may be intentional for internal calls)
- Query using `.select('*')` on table with sensitive columns (context-dependent)
- Inconsistent Supabase client usage (both patterns work, but inconsistent)

---

## Examples

**CRITICAL — Admin client in client code:**
```typescript
// components/Dashboard.tsx (client component)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // CRITICAL — exposed in bundle
);

export function Dashboard() {
  const [data, setData] = useState([]);
  useEffect(() => {
    supabase.from('campaigns').select('*').then(d => setData(d)); // no org filter
  }, []);
  return <div>{/* ... */}</div>;
}
```
→ Service-role key exposed; no org scoping

**CRITICAL — RLS missing on user data:**
```typescript
// prisma/schema.prisma
model SecretNote {
  id        String   @id @default(cuid())
  user_id   String?
  content   String
  createdAt DateTime @default(now())

  @@map("secret_notes")
}

-- Supabase RLS missing!
-- CREATE POLICY "Users can read their own notes"
--   ON secret_notes
--   FOR SELECT
--   USING (user_id = auth.uid());
```
→ Table is readable by all users (RLS disabled)

**HIGH — Missing org_id filter:**
```typescript
// app/api/campaigns/route.ts
export async function GET(req: Request) {
  const { data } = await prisma.campaign.findMany({}); // ← no where org_id
  return Response.json(data);
}
```
→ Returns campaigns from all orgs; user can enumerate other orgs' data

**HIGH — Edge Function missing JWT verify:**
```typescript
// supabase/functions/analyze-website/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { url } = await req.json(); // ← no JWT check
  const result = await analyzeWebsite(url);
  return new Response(JSON.stringify(result));
});
```
→ Anyone can call this function; should verify `Authorization: Bearer <JWT>`

**MEDIUM — Missing .single() on single-row query:**
```typescript
// lib/database.ts
const result = await prisma.user.findUnique({
  where: { id: userId }
  // Missing: .single() in Supabase client equivalent
});
```
→ If query changes to return multiple rows, code doesn't catch it

**LOW — Inconsistent Supabase client:**
```typescript
// lib/supabase.ts
export const supabase = createClient(url, anonKey);

// app/api/route.ts
import { supabase } from '@/lib/supabase'; // pattern A

// components/Form.tsx
const supabase = createClient(url, anonKey); // pattern B — reinitializes
```
→ Same key, but inconsistent usage; use singleton pattern

---

## Severity Thresholds (Synthex-Specific)

| Issue | Severity | Rule |
|-------|----------|------|
| Clerk/NextAuth import | CRITICAL | Absolute; always block |
| Hardcoded API key | CRITICAL | Always block |
| Service-role in client code | CRITICAL | Admin key in bundle = data leak risk |
| RLS disabled on user data table | CRITICAL | New table + user/org data = immediate risk |
| Cross-org data exposure | CRITICAL | Query returns data from all orgs |
| Missing JWT on Edge Function | CRITICAL | Unauthenticated endpoint for sensitive op |
| Missing org_id filter | HIGH | API returns user from wrong org |
| Mutation without auth check | HIGH | Unauthenticated write |
| Missing RLS policy | HIGH | New table with sensitive data = no policies |
| SELECT using .data without error check | MEDIUM | Swallows errors; data may be null |
| Service-role instead of anon | MEDIUM | Anon + RLS preferred for client calls |

---

## When NOT to Flag

- Supabase-only auth (correct choice)
- Prisma as ORM layer (correct choice)
- Edge Functions called from Next.js API via fetch() (correct pattern)
- JWT verification in Edge Function (correct security)
- RLS policies enforcing org scoping (correct pattern)
- Using anon key + RLS on client queries (correct pattern)

---

## Reference Patterns

- **Auth:** `lib/auth/supabase-patterns.md`
- **RLS:** See Supabase docs on row security; Synthex convention: always include org_id in WHERE clause
- **Edge Functions:** Synthex pattern: always verify `Authorization` header, return error on auth failure
- **Org Scoping:** `lib/multi-business/org-scoping.ts`
