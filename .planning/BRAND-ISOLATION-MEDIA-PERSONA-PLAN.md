# Brand-Isolation Plan — MEDIA + PERSONA surfaces

> **Status: DRAFT / PLAN ONLY. NOTHING APPLIED.**
> Prod apply is **founder-gated**, out-of-band via Supabase `apply_migration`
> against project `znyjoyjsvjotlzjppzal` (NEVER `prisma db push`, per
> `CLAUDE.md` + `.claude/rules/database/supabase-migrations.md`). The migration
> SQL ships under `supabase/migrations/` so it does **not** auto-apply on Vercel
> deploy (only `prisma/migrations/` is replayed by `scripts/build-with-migrations.sh`).

Two surfaces lack brand isolation because their tables have **no
`organization_id` column** — they scope by `user_id` alone, so a multi-business
owner who switches their active brand sees and mutates the **same user's** data
across **all** their brands. This plan gives both surfaces the established
brand-scope carve-out used by `ContentDraft` / `StudioContentDraft`.

The established pattern (canonical reference, read in-repo):

- `getEffectiveOrganizationId(userId)` — `lib/multi-business/business-scope.ts:28`
  [VERIFIED]. Returns `activeOrganizationId` for a multi-business owner, else the
  user's `organizationId` (home org), else `null`.
- Carve-out filter — `app/api/content-drafts/route.ts:32-43` [VERIFIED]:
  ```ts
  if (!effectiveOrgId) return { userId };
  return {
    userId,
    OR: [{ organizationId: effectiveOrgId }, { organizationId: null }],
  };
  ```
  The `organizationId: null` arm keeps legacy rows (created before brand-scoping)
  visible to their owner — zero data loss.
- Additive scalar `organization_id`, **no DB FK** to `organizations` (TEXT/UUID
  hazard per the DB rule) — exactly how `StudioContentDraft` does it
  (`prisma/schema.prisma:6864`, `@map("organization_id")`) [VERIFIED].

Backfill source of truth for BOTH surfaces: `public.users.organization_id` (the
owner's **home org**). `public.users` has `organization_id`,
`active_organization_id`, `is_multi_business_owner` [VERIFIED — schema.prisma
`model User`]. This is the same column `getEffectiveOrganizationId` falls back to.

---

## SURFACE 1 — MEDIA (`media_assets` + `media_folders`)

### Current state & scoping [VERIFIED]

- **Tables**: `public.media_assets`, `public.media_folders` — raw Supabase
  tables, **NOT** in `prisma/schema.prisma`. Created by
  `supabase/migrations/20260528073000_media_library_runtime_tables.sql`
  (`user_id TEXT NOT NULL REFERENCES public.users(id)`, no `organization_id`).
- **Service**: `lib/services/media-library.ts` — EVERY query is `.eq('user_id', userId)`
  with no org dimension. Reads: `getAssets` (L165), `getAsset` (L270),
  `getFolders` (L528), `getStats` (L682). Writes: `createAsset` (L294),
  `createFolder` (L552), `updateAsset` (L362), `deleteAsset` (L386),
  `deleteFolder` (L637), `updateFolder` (L604), batch ops.
- **Routes**: `app/api/media/library/route.ts` resolves `userId =
security.context.userId!` (L154, L300, L375, L487) then calls the service with
  `userId` only. `app/api/media/upload/route.ts` (L41) uploads under `userId`.
- Flagged in **#433**.

### Additive migration (drafted)

`supabase/migrations/20260615120000_media_brand_isolation_org_column.sql`:

- `ALTER TABLE public.media_assets  ADD COLUMN IF NOT EXISTS organization_id TEXT;`
- `ALTER TABLE public.media_folders ADD COLUMN IF NOT EXISTS organization_id TEXT;`
- `CREATE INDEX IF NOT EXISTS idx_media_assets_user_org  ON public.media_assets (user_id, organization_id);`
- `CREATE INDEX IF NOT EXISTS idx_media_folders_user_org ON public.media_folders (user_id, organization_id);`

Because these tables are NOT Prisma models, the drift checker
(`scripts/check-schema-drift.mjs`, which reads `prisma/schema.prisma`) does **not**
look at them — so there is **no schema.prisma sequencing constraint for media**.

### Backfill (drafted, in same SQL file, run after column confirmed present)

```sql
UPDATE public.media_assets a SET organization_id = u.organization_id
  FROM public.users u
 WHERE a.user_id = u.id AND a.organization_id IS NULL AND u.organization_id IS NOT NULL;
-- (same for media_folders)
```

Idempotent (only fills NULL rows). Owners with no home org stay NULL → visible
via carve-out.

### App-code changes AFTERWARD (follow-up lane, not in this PR)

Thread `organizationId` through `lib/services/media-library.ts`:

- Resolve `effectiveOrgId = await getEffectiveOrganizationId(userId)` in each
  media route (`app/api/media/library/route.ts`, `app/api/media/upload/route.ts`).
- **Reads** (`getAssets`/`getAsset`/`getFolders`/`getStats`): keep
  `.eq('user_id', userId)` and add the carve-out. In Supabase-JS terms the
  `{ userId, OR:[{organizationId:effOrg},{organizationId:null}] }` pattern is:
  ```ts
  query = query.eq('user_id', userId);
  if (effectiveOrgId)
    query = query.or(
      `organization_id.eq.${effectiveOrgId},organization_id.is.null`
    );
  ```
- **Writes** (`createAsset`/`createFolder`): stamp `organization_id: effectiveOrgId`
  on insert so new rows are brand-owned.
- **Mutations** (`updateAsset`/`deleteAsset`/`updateFolder`/`deleteFolder`/batch):
  add the same carve-out to the `.eq('id', …).eq('user_id', userId)` chain so a
  user cannot mutate another brand's asset.

### Rollout order (media)

1. Apply migration (nullable column + index) — additive, safe.
2. Run backfill UPDATEs.
3. Ship app-code carve-out in `media-library.ts` + routes.
4. LATER (optional, separate gated migration): `SET NOT NULL` once backfill is
   confirmed 100% and any null-org users are resolved.

### Rollback (media)

Drop the two indexes + two columns (additive-only). Must happen BEFORE the
app-code lane ships (or after reverting it), since the carve-out reads the column.

---

## SURFACE 2 — PERSONA (`Persona` model / `personas` table)

### Current state & scoping [VERIFIED]

- **Model**: `Persona` — `prisma/schema.prisma:1376`, `@@map("personas")`,
  `userId String @map("user_id")`, `@@index([userId])`, `@@index([status])`.
  **No `organizationId`.**
- **Routes**:
  - `app/api/personas/route.ts` — GET `findMany({ where: { userId } })` (L65-68);
    POST creates with `{ ...data, userId }` (L106-111); PATCH/DELETE verify
    ownership via `findUnique({ where:{id} })` then check `existingPersona.userId
!== userId` (L156-166, L216-226). All `userId`-only.
  - `app/api/personas/[id]/optimize/route.ts` — `findFirst({ where:{ id, userId } })`
    (L71-72). (It already calls `getEffectiveOrganizationId(userId)` at L83 for a
    _different_ downstream concern — confirms the helper is import-available here.)
  - `app/api/personas/[id]/train/route.ts` — `findFirst({ where:{ id, userId } })`
    (L76-77, L185-186). All `userId`-only.
- Flagged in **#454 / #449**.

### Additive migration (drafted)

`supabase/migrations/20260615120100_persona_brand_isolation_org_column.sql`:

- `ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS organization_id TEXT;`
- `CREATE INDEX IF NOT EXISTS idx_personas_user_org ON public.personas (user_id, organization_id);`

### Prisma schema.prisma diff — DOC ONLY THIS PR (drift-checker sequencing)

`scripts/check-schema-drift.mjs` fails the build if a scalar field declared in
`prisma/schema.prisma` is **missing from the live DB** [VERIFIED — checker header

- `scripts/build-with-migrations.sh` step 3 "THE HARD GATE"]. So adding the
  Prisma field now, while the column is absent in prod, would **break CI/deploy**.

Therefore the field below is **NOT applied to schema.prisma in this PR** — it is
documented here and added in a **FOLLOW-UP PR** only AFTER the column exists in
prod (migration applied + verified). Sequencing:

1. This PR (draft): SQL migration + plan only. schema.prisma untouched.
2. Founder applies SQL out-of-band → column present in prod.
3. Follow-up PR: add the Prisma field (drift check now passes because the column
   exists) + the app-code carve-out using `prisma.persona`.

Diff to apply in the follow-up PR (mirrors `StudioContentDraft` mapping):

```diff
 model Persona {
   id          String  @id @default(cuid())
   ...
   // Relations
   userId String @map("user_id")
+  organizationId String? @map("organization_id")

   createdAt DateTime @default(now()) @map("created_at")
   updatedAt DateTime @updatedAt @map("updated_at")

   trainingData PersonaTrainingData[]

   @@index([userId])
+  @@index([userId, organizationId])
   @@index([status])
   @@map("personas")
 }
```

(Nullable `String?` → backward-compatible; carve-out tolerates legacy NULLs.)

### Backfill (drafted, in the SQL file)

```sql
UPDATE public.personas p SET organization_id = u.organization_id
  FROM public.users u
 WHERE p.user_id = u.id AND p.organization_id IS NULL AND u.organization_id IS NOT NULL;
```

Idempotent; owners with no home org stay NULL → visible via carve-out.

### App-code changes AFTERWARD (follow-up lane, with the Prisma field PR)

Mirror `app/api/content-drafts/route.ts:32-43`:

- Add a `buildPersonaOwnershipWhere(userId, effectiveOrgId)` helper returning
  `{ userId }` when no org, else
  `{ userId, OR: [{ organizationId: effectiveOrgId }, { organizationId: null }] }`.
- `app/api/personas/route.ts`: GET `findMany` uses the helper; POST stamps
  `organizationId: effectiveOrgId`; PATCH/DELETE ownership check uses `findFirst`
  with the carve-out where (replace the `findUnique` + manual `userId !==` check).
- `optimize` + `train` routes: change `findFirst({ where:{ id, userId } })` to
  include the carve-out (`id` + the ownership where), reusing the
  `getEffectiveOrganizationId(userId)` already imported in optimize.

### Rollout order (persona)

1. Apply SQL migration (nullable column + index).
2. Run backfill UPDATE.
3. Follow-up PR: add Prisma field + app-code carve-out (drift check passes now).
4. LATER (optional, gated): `SET NOT NULL` + make Prisma field required.

### Rollback (persona)

If only the SQL applied: drop index + column (additive-only). If the Prisma-field
follow-up PR already merged, **revert that PR first**, else the drift checker
fails the build on the now-missing column.

---

## Risks & open items (evidence-tagged)

- **[INFERENCE] Multi-org backfill ambiguity.** A user can be a `TeamMember` of
  multiple orgs (`team_members` UNIQUE (user*id, organization_id) —
  `supabase/migrations/20260401000004_team_members.sql:15`). But every
  media/persona row has exactly ONE owning `user_id`, and there is no per-row
  signal of which brand it was created under. We deterministically assign the
  owner's **home org** (`users.organization_id`) — the same value
  `getEffectiveOrganizationId` returns for non-multi-business users. For a
  multi-business owner whose rows actually belong to a \_non-home* brand, the
  backfill may mis-attribute them to the home org. Mitigation: the carve-out's
  `organizationId IS NULL` arm is the safety net for any row left NULL; and
  because backfill writes home-org, a mis-attributed row is still owned by the
  same user (no cross-USER leak — only a within-owner cross-BRAND visibility that
  already exists today). **Founder should confirm** whether home-org backfill is
  acceptable or whether mis-attributable rows should be left NULL pending manual
  triage.
- **[VERIFIED] Drift-checker gate is real.** `scripts/check-schema-drift.mjs` is
  "THE HARD GATE" (`scripts/build-with-migrations.sh:21`). Hence Persona's Prisma
  field is doc-only here; media tables are non-Prisma so unaffected.
- **[INFERENCE] NOT NULL is a separate, later, gated step** — not in scope. Doing
  it before 100% backfill (incl. null-home-org users) would break inserts.
- **[VERIFIED] No data loss in the additive step** — `ADD COLUMN IF NOT EXISTS`
  nullable + `CREATE INDEX IF NOT EXISTS`, no DROP/rename/type-change.
- **[UNCONFIRMED] RLS interaction.** `media_assets`/`media_folders` RLS posture
  not audited in this plan; if RLS policies later key on `organization_id`, that
  is a separate follow-up (out of scope here).
