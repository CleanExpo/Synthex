# Phase 6 — Brand-Config TenantConfig Envelope (Tasks 6.2–6.5)

**Phase entry:** Phase 6 lands the **TenantConfig envelope** introduced in Task 6.1 (PR #237) as the runtime substrate for multi-brand pilot activation. v1 enforces 1:1 `tenant_slug === brand_slug` per ADR-002 — multi-brand-per-tenant is deferred to v2.

**Trajectory recap:**
- Task 6.1 — TenantConfig + PilotConfig types + `phill` tenant + type-test → **DRAFT PR #237 (open, mergeable)**. Adds `TenantConfig<TBrand>`, `BrandConfigWithPilot`, `PilotConfig`, `assertSingleTenantBrand()` to `packages/brand-config/src/types.ts`.
- Tasks 6.2–6.5 — runtime + UI + onboarding integration — this document decomposes them.

**Author:** Senior Engineer, Synthex Phase 5
**Date:** 2026-05-16
**Branch:** `feat/synthex-phase5-brand-config-phase6`

---

## Type structure (verified, post-PR-237)

```ts
// packages/brand-config/src/types.ts
export interface PilotConfig {
  semantic_dedup_enabled: boolean;
}

export interface BrandConfigWithPilot extends BrandConfig {
  pilotConfig: PilotConfig;
}

export interface TenantConfig<TBrand extends BrandConfig = BrandConfig> {
  tenant_slug: string;
  billing_tier: 'pro' | 'enterprise';
  brands: Record<string, TBrand>;
}

export function assertSingleTenantBrand(t: TenantConfig): void;
```

Note: `brands` is `Record<string, TBrand>` (not keyed by `BrandSlug`) — this is deliberate so the founder-internal `phill` tenant can live alongside the 8 portfolio brands without polluting the public `BrandSlug` union.

---

## Task 6.2 — TenantConfig resolver

**Owner:** Senior Engineer (Synthex Phase 5)
**PR order:** SECOND (after #237 merges)
**Dependencies:** PR #237 (TenantConfig types + `phill` tenant)

### Affected files (exact paths)

- `packages/brand-config/src/tenant-resolver.ts` — **NEW**
- `packages/brand-config/src/index.ts` — re-export `resolveTenantConfig`, `TENANTS`
- `packages/brand-config/src/tests/tenant-resolver.test-d.ts` — **NEW** (type-test, in-package)
- `__tests__/brand-config/tenant-resolver.spec.ts` — **NEW** (runtime jest test, root jest discovers `__tests__/**`)

### Spec

Build a single canonical lookup function that turns a tenant slug into a validated `TenantConfig`. v1 has one tenant in PR #237 (`phill`); 6.2 expands this so every existing portfolio brand can be resolved as its own tenant under the v1 1:1 rule.

Public API (exported from package index):

```ts
export type TenantSlug = BrandSlug | 'phill';

export const TENANTS: Record<TenantSlug, TenantConfig<BrandConfigWithPilot>>;

export function resolveTenantConfig(
  slug: TenantSlug,
): TenantConfig<BrandConfigWithPilot>;
```

Behaviour:
1. `TENANTS` is a frozen at-module-load `Record` mapping every existing brand slug (`'dr' | 'nrpg' | 'ra' | 'carsi' | 'ccw' | 'synthex' | 'unite' | 'john-coutis' | 'phill'`) to a `TenantConfig`.
2. Each portfolio tenant is constructed by wrapping the existing `BrandConfig` from `brands/index.ts` with a default `pilotConfig: { semantic_dedup_enabled: false }` (opt-in, off by default).
3. `phill` is imported directly from `brands/phill.ts` (built in PR #237) with `semantic_dedup_enabled: true` already set.
4. `resolveTenantConfig(slug)` returns the entry from `TENANTS` and runs `assertSingleTenantBrand()` before returning. Throws `Error('Unknown tenant slug: <slug>')` for any slug not in the map.
5. Module-load guarantee: `Object.freeze(TENANTS)` so callers cannot mutate.
6. The `billing_tier` default for portfolio brands is `'pro'`; `phill` stays at `'enterprise'`.

### Acceptance criteria (testable)

- AC-1: `resolveTenantConfig('dr')` returns a `TenantConfig` whose `tenant_slug === 'dr'` and `brands.dr.slug === 'dr'`.
- AC-2: For every key in `BrandSlug | 'phill'`, `resolveTenantConfig(key)` resolves without throwing and `assertSingleTenantBrand` passes.
- AC-3: `resolveTenantConfig('unknown')` throws `Error` with message containing `'Unknown tenant'`.
- AC-4: `TENANTS` is frozen — `() => { (TENANTS as any).foo = 1 }` throws in strict mode.
- AC-5: `resolveTenantConfig('phill').brands.phill.pilotConfig.semantic_dedup_enabled === true` (founder default).
- AC-6: `resolveTenantConfig('dr').brands.dr.pilotConfig.semantic_dedup_enabled === false` (portfolio default).
- AC-7: `npm run typecheck` in `packages/brand-config` passes.

### Tests required

- `packages/brand-config/src/tests/tenant-resolver.test-d.ts` — type-level: assigning the return of `resolveTenantConfig` to `TenantConfig<BrandConfigWithPilot>` compiles; passing a non-`TenantSlug` literal fails `tsc`.
- `__tests__/brand-config/tenant-resolver.spec.ts` — runtime: all 7 ACs above (one `it()` block per AC). Imports from `@unite-group/brand-config`.

### Risks

- **R1:** The PR #237 author exported `BrandConfig` (not `BrandConfigWithPilot`) from index.ts. Need to add `BrandConfigWithPilot` + `TenantConfig` + `PilotConfig` + `assertSingleTenantBrand` to the re-export list. Trivial.
- **R2:** PR #237 is still open. Task 6.2 must rebase on `main` *after* #237 merges. If #237 stalls, 6.2 can be developed on a feature branch off #237's head — but cannot merge until #237 does.

---

## Task 6.3 — TenantConfig lifecycle hooks

**Owner:** Senior Engineer (Synthex Phase 5)
**PR order:** THIRD
**Dependencies:** Task 6.2 (uses `resolveTenantConfig`)

### Affected files (exact paths)

- `packages/brand-config/src/lifecycle.ts` — **NEW**
- `packages/brand-config/src/index.ts` — re-export `registerLifecycleHook`, `runLifecycleHook`, `LifecycleEvent`, `LifecycleHook`
- `packages/brand-config/src/tests/lifecycle.test-d.ts` — **NEW** (type-test)
- `__tests__/brand-config/lifecycle.spec.ts` — **NEW** (runtime jest)

### Spec

In-memory hook registry keyed by `tenant_slug + event`. No persistence — this is a pure runtime substrate that consumers (Task 6.5 onboarding flow, future admin tooling) call.

Public API:

```ts
export type LifecycleEvent =
  | 'beforeProvision'
  | 'afterProvision'
  | 'beforeArchive'
  | 'afterArchive';

export type LifecycleHook = (tenant: TenantConfig) => Promise<void> | void;

/** Registers a hook. Returns an unregister function. */
export function registerLifecycleHook(
  slug: TenantSlug | '*',  // '*' = applies to all tenants
  event: LifecycleEvent,
  hook: LifecycleHook,
): () => void;

/** Runs hooks for the given (slug, event) in registration order. */
export async function runLifecycleHook(
  slug: TenantSlug,
  event: LifecycleEvent,
): Promise<void>;

/** Test-only — clears all registered hooks. NOT exported from package index. */
export function __resetLifecycleRegistry(): void;
```

Behaviour:
1. Registry is a module-scoped `Map<string, LifecycleHook[]>` keyed by `${slug}:${event}` (or `*:${event}` for wildcard).
2. `runLifecycleHook(slug, event)` runs every hook registered for both `slug:event` AND `*:event` in registration order, sequentially (awaits each).
3. **Idempotency rule:** registering the SAME function reference for the SAME `(slug, event)` pair is a no-op (no double-registration). Compared by reference equality.
4. **Error policy:** if a hook throws, `runLifecycleHook` re-throws immediately — no swallowing. Subsequent hooks do NOT run. This is the safer default for `beforeProvision` (e.g. fail-closed on a budget-check hook).
5. `__resetLifecycleRegistry` is exported from the module but NOT re-exported from the package's `index.ts` — only test files import it via `from '@unite-group/brand-config/lifecycle'` (subpath).

### Consumer integration (required for acceptance)

At least ONE consumer must call the hooks in this PR. Candidate: the brand-onboarding flow (Task 6.5) is downstream; therefore this PR adds a single CALLER in `app/api/admin/tenants/provision/route.ts` (NEW, admin-only POST endpoint that triggers `runLifecycleHook(slug, 'beforeProvision')` and `'afterProvision'` around a no-op provisioning stub).

The actual provisioning logic is Task 6.5's concern — Task 6.3 just installs the call sites.

### Acceptance criteria (testable)

- AC-1: `registerLifecycleHook('dr', 'beforeProvision', fn)` followed by `runLifecycleHook('dr', 'beforeProvision')` invokes `fn` exactly once with the `dr` `TenantConfig`.
- AC-2: Registering the same function reference twice for the same `(slug, event)` does NOT double-fire on a single `runLifecycleHook` call.
- AC-3: Hooks fire in registration order — verified by an array push test.
- AC-4: Wildcard `'*'` hooks fire for every tenant on the matching event.
- AC-5: A hook that throws causes `runLifecycleHook` to reject with that error and subsequent hooks for that `(slug, event)` are NOT called.
- AC-6: `unregister()` (the returned function) removes the hook and subsequent `runLifecycleHook` calls do not invoke it.
- AC-7: `POST /api/admin/tenants/provision` with body `{ slug: 'dr' }` runs `beforeProvision` then `afterProvision` for `dr` — verified via a registered spy hook in the route test.

### Tests required

- `__tests__/brand-config/lifecycle.spec.ts` — ACs 1–6 (use `__resetLifecycleRegistry` in `beforeEach`).
- `__tests__/api/admin/tenants/provision.test.ts` — AC-7 + admin-gate test (401 without admin auth).

### Risks

- **R1:** Module-scoped state is hot-reload-fragile in Next.js dev mode. Acceptable for v1 (lifecycle hooks are infrastructure-time, not per-request). Document in JSDoc on `lifecycle.ts`.
- **R2:** Sequential awaited execution is intentional (vs `Promise.all`) so `beforeProvision` hooks can short-circuit on failure. Do NOT optimise.

---

## Task 6.4 — Pilot activation UI

**Owner:** Senior Engineer (Synthex Phase 5)
**PR order:** FOURTH
**Dependencies:** Tasks 6.2, 6.3 + new Supabase migration

### Affected files (exact paths)

- `supabase/migrations/20260520000001_tenant_config.sql` — **NEW** (creates `tenant_config` table)
- `app/dashboard/admin/pilot/page.tsx` — **NEW** (server component, lists tenants + toggle)
- `app/dashboard/admin/pilot/PilotToggle.tsx` — **NEW** (client component, optimistic toggle)
- `app/dashboard/admin/pilot/loading.tsx` — **NEW** (skeleton)
- `app/api/admin/pilot/route.ts` — **NEW** (`GET` lists, `PATCH` updates `semantic_dedup_enabled`)
- `lib/tenant-config/repository.ts` — **NEW** (thin Supabase wrapper — `getTenantConfig`, `upsertTenantConfig`)
- `__tests__/api/admin/pilot.test.ts` — **NEW** (route + admin-gate test)

### Schema (`supabase/migrations/20260520000001_tenant_config.sql`)

```sql
-- Phase 6 Task 6.4 — TenantConfig persistence layer.
-- 1:1 with packages/brand-config TenantConfig envelope (ADR-002).
create table if not exists public.tenant_config (
  tenant_slug      text primary key,
  billing_tier     text not null check (billing_tier in ('pro', 'enterprise')),
  pilot_config     jsonb not null default '{"semantic_dedup_enabled": false}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tenant_config_updated_at_idx on public.tenant_config(updated_at desc);

-- RLS: admin-only via service_role; deny anon + authenticated.
alter table public.tenant_config enable row level security;
create policy "tenant_config_service_role_all" on public.tenant_config
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Seed: one row per existing brand at billing_tier='pro', dedup=false.
insert into public.tenant_config (tenant_slug, billing_tier, pilot_config)
values
  ('dr',          'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('nrpg',        'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('ra',          'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('carsi',       'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('ccw',         'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('synthex',     'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('unite',       'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('john-coutis', 'pro',        '{"semantic_dedup_enabled": false}'::jsonb),
  ('phill',       'enterprise', '{"semantic_dedup_enabled": true}'::jsonb)
on conflict (tenant_slug) do nothing;
```

### UI Spec

`app/dashboard/admin/pilot/page.tsx`:
- Server component. Fetches all rows from `tenant_config` via service-role Supabase client.
- Renders a table: `tenant_slug | billing_tier | semantic_dedup_enabled (toggle)`.
- Toggle is the `PilotToggle` client component — optimistic UI, PATCH to `/api/admin/pilot` on change.
- Uses existing `Card`, `Table`, `Switch` primitives from `components/ui/`.
- Admin-only — inherits the existing `app/dashboard/admin/layout.tsx` owner-email gate (no new gate code needed).

### API Spec (`app/api/admin/pilot/route.ts`)

```ts
// GET /api/admin/pilot → 200 { tenants: TenantConfigRow[] }
// PATCH /api/admin/pilot → body: { tenant_slug, semantic_dedup_enabled }
//   200 { ok: true } | 401 (not admin) | 404 (unknown slug) | 400 (bad body)
```

Both endpoints call `verifyAdmin(request)` from `lib/admin/verify-admin.ts` and 401 on failure. PATCH validates `tenant_slug` against `TENANTS` (from Task 6.2) — unknown slugs 404.

### Acceptance criteria (testable)

- AC-1: Migration applies cleanly on a fresh DB and seeds 9 rows (8 brands + phill).
- AC-2: `GET /api/admin/pilot` without admin auth returns 401.
- AC-3: `GET /api/admin/pilot` with admin auth returns all 9 rows.
- AC-4: `PATCH /api/admin/pilot` with `{ tenant_slug: 'dr', semantic_dedup_enabled: true }` updates ONLY the `dr` row — `nrpg` and others remain `false` (isolation test).
- AC-5: `PATCH` with `tenant_slug: 'unknown'` returns 404.
- AC-6: `PATCH` with admin auth correctly bumps `updated_at`.
- AC-7: `/dashboard/admin/pilot` renders without runtime error in production build (`next build`).

### Tests required

- `__tests__/api/admin/pilot.test.ts` — ACs 2–6 with mocked Supabase + admin auth.
- A Playwright test is NOT required for v1 — the route test covers the contract. Add to backlog for v2.

### Risks

- **R1:** Migration ordering — must run AFTER any migration that creates the `auth.role()` helper (standard Supabase, no risk).
- **R2:** The seed `insert ... on conflict do nothing` is idempotent — safe to re-run.
- **R3:** The UI fetches all tenants on every page load. v1 has 9 rows — no pagination needed. Document threshold (>100 rows triggers pagination redesign).

---

## Task 6.5 — Brand onboarding flow update

**Owner:** Senior Engineer (Synthex Phase 5)
**PR order:** FIFTH (LAST — depends on 6.2 + 6.3 + 6.4)
**Dependencies:** Tasks 6.2, 6.3, 6.4

### Affected files (exact paths)

- `app/(onboarding)/onboarding/page.tsx` — **MODIFY** (wire TenantConfig envelope on final step)
- `components/onboarding/finalize-tenant.ts` — **NEW** (server action — creates `tenant_config` row + fires lifecycle hooks)
- `lib/tenant-config/provision.ts` — **NEW** (high-level provisioner used by onboarding + admin route from 6.3)
- `app/api/admin/tenants/provision/route.ts` — **MODIFY** (swap the no-op stub from 6.3 for the real `provision` call from `lib/tenant-config/provision.ts`)
- `__tests__/onboarding/finalize-tenant.spec.ts` — **NEW** (integration test with mocked Supabase)
- `__tests__/lib/tenant-config/provision.test.ts` — **NEW** (unit test for `provision`)

### Spec

When a new tenant lands on the final onboarding step (`/onboarding`), submitting the form must:

1. Server-action `finalizeTenant({ slug, billingTier })` runs.
2. It calls `resolveTenantConfig(slug)` (from Task 6.2) to validate the slug is known.
3. Calls `runLifecycleHook(slug, 'beforeProvision')` (from Task 6.3).
4. Upserts a row into `tenant_config` via `lib/tenant-config/repository.ts` (from Task 6.4) — defaults `pilot_config` to `{ semantic_dedup_enabled: false }` for portfolio tenants.
5. Calls `runLifecycleHook(slug, 'afterProvision')`.
6. Returns `{ tenant_slug, pilot_config }` to the client; client redirects to `/dashboard`.

`lib/tenant-config/provision.ts` is the SHARED implementation called by BOTH `finalizeTenant` (server action) AND `POST /api/admin/tenants/provision` (admin route from Task 6.3, which 6.5 upgrades from a stub to a real call).

### Acceptance criteria (testable)

- AC-1: Submitting the onboarding form with `slug: 'dr'` creates a `tenant_config` row for `dr` if none exists.
- AC-2: Submitting twice for the same slug is idempotent — the row is upserted, not duplicated (PK constraint enforces this).
- AC-3: `beforeProvision` and `afterProvision` lifecycle hooks fire in order — verified by a test spy.
- AC-4: A `beforeProvision` hook that throws aborts the operation — NO `tenant_config` row is created.
- AC-5: Submitting with an unknown slug throws `Error('Unknown tenant slug: <slug>')` from `resolveTenantConfig`.
- AC-6: `POST /api/admin/tenants/provision` body `{ slug: 'dr' }` produces the same end state as the onboarding form (both call `provision`).
- AC-7: After a successful onboarding, `GET /api/admin/pilot` lists the new tenant (proves end-to-end persistence).

### Tests required

- `__tests__/lib/tenant-config/provision.test.ts` — ACs 1–5 with mocked Supabase + lifecycle.
- `__tests__/onboarding/finalize-tenant.spec.ts` — server action test (ACs 1, 3, 4).
- `__tests__/api/admin/tenants/provision.test.ts` — UPGRADE the test from Task 6.3 to assert real DB write (AC-6).
- E2E: a Playwright `tests/e2e/onboarding-finalize.spec.ts` is **OPTIONAL** for v1. Add to backlog. The integration tests above cover the contract.

### Risks

- **R1:** The onboarding page is 605 lines — modifying it carries regression risk for non-Phase-6 flows. Mitigation: confine all new code to the new server action; touch the page file ONLY to wire the action call on submit.
- **R2:** Lifecycle-hook failures during onboarding need a user-facing error. Render the error in the existing onboarding error UI — don't add a new toast pattern.
- **R3:** Supabase upsert is on PK conflict — no race condition risk for concurrent provisions of the same slug.

---

## Phase 6 PR sequence (summary)

| Order | PR title | Branch | Depends on |
|---|---|---|---|
| 1 | `feat(brand-config): TenantConfig envelope (Phase 6 Task 6.1)` | `feat/brand-config-tenant-envelope` | — | **EXISTING — PR #237** |
| 2 | `feat(brand-config): TenantConfig resolver (Phase 6 Task 6.2)` | `feat/synthex-phase5-brand-config-phase6` | #237 |
| 3 | `feat(brand-config): TenantConfig lifecycle hooks (Phase 6 Task 6.3)` | TBD | Task 6.2 |
| 4 | `feat(admin): pilot activation UI + tenant_config table (Phase 6 Task 6.4)` | TBD | Task 6.3 |
| 5 | `feat(onboarding): wire TenantConfig provisioning (Phase 6 Task 6.5)` | TBD | Tasks 6.2 + 6.3 + 6.4 |

All five PRs are **squash-merge only**. No `--no-verify`. Each PR ships with green CI before the next branches.

---

## Hard rules (carried from mandate)

- NO `--no-verify`. Block on hygiene PR if hooks fail.
- Reuse existing brand-config patterns; no new runtime dependencies.
- Squash merge only.
- Every spec above is detailed enough that a different engineer can execute without further clarification — per the writing-plans skill bar.
