# Synthex — Access Control Matrix

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b` (Synthex Phase 2)
**Last updated:** 2026-05-16
**Audience:** Senior Security Engineer, SOC 2 auditor, on-call.

## Role definitions

| Role               | Substrate                                  | Use cases                                                                       |
|--------------------|--------------------------------------------|---------------------------------------------------------------------------------|
| `anon`             | Public, pre-login (Supabase Postgres role) | Marketing pages, public references, demo endpoints behind rate limits.          |
| `authenticated`    | Logged-in user JWT (Supabase Postgres role)| User-facing app endpoints under a user's tenant context.                        |
| `service_role`     | Server-side only (Supabase Postgres role)  | Cron/internal jobs, OAuth callbacks, signed-webhook handlers, audit writes.    |
| `org_owner`        | Application-level (`team_members.role`)    | Per-tenant administrative actions (invite, billing, plan).                      |
| `org_admin`        | Application-level (`team_members.role`)    | Per-tenant management of members, content, settings.                            |
| `org_editor`       | Application-level (`team_members.role`)    | Content + campaign creation/edit; no admin.                                     |
| `org_viewer`       | Application-level (`team_members.role`)    | Read-only inside the tenant.                                                    |
| `founder`          | Hardcoded ALLOWLIST in `app/api/founder/*` | Founder-only diagnostic + delete-account endpoints.                             |

## Authoritative table classification

The detailed per-table RLS verdict lives in
`docs/security/rls-gap-list-2026-05-16.json`. Summary at the time of this
matrix:

| Verdict        | Tables | Comment                                                                                  |
|----------------|-------:|------------------------------------------------------------------------------------------|
| `SECURE`       |     18 | Tenant- or user-scoped policy attached. Adversarial test passes.                         |
| `USING_TRUE`   |    147 | `qual='true'` policy attached — open by default. Cross-tenant exposure if anon/auth keys reach the table. |
| `NO_POLICY`    |     61 | RLS on, zero policies. Service-role-only access works; anon/auth gets empty. Broken if non-service-role keys are used. |
| `OTHER`        |      8 | RLS on, role-based but no tenant clause. Audit + retune per table.                       |
| **Total**      |    234 |                                                                                          |

## Cross-cutting access conventions

1. **Tenant-scoped tables** (`has_org_id = true`): canonical policy is
   `USING (is_team_member(organization_id))`. The helper is
   `SECURITY DEFINER` and joins `team_members`. Column type MUST match
   `team_members.organization_id` (currently `text`).
2. **User-scoped tables** (`has_user_id = true`, no `organization_id`):
   canonical policy is `USING (user_id = (auth.uid())::text)` or
   `USING (user_id = auth.uid())` matching column type.
3. **Service-role-only tables** (audit, cron state, system internals):
   no anon/auth policy. Service-role implicit access.
4. **Public-read tables** (marketing references): explicit
   `USING (true)` for SELECT only, with an inline SQL comment justifying
   the open read.
5. **Append-only tables** (`audit_events_immutable`): service_role INSERT
   + SELECT only; UPDATE/DELETE blocked by trigger AND grant. See
   migration `20260516000001_immutable_audit_log.sql`.

## Service-role usage

Per `docs/security/service-role-leaks-2026-05-16.md`, 46 non-internal API
routes import `createServerClient` (service_role). Each must be reviewed
for cross-tenant safety BEFORE further RLS hardening. Routes that pass a
user-supplied `organization_id` straight to a `.from(...).eq(...)` query
on a tenant-scoped table are leaks that no RLS policy can close.

## SOC 2 evidence linkage (Margot Q1 finding — 21 artifacts)

The 21 SOC 2-relevant artifact categories Margot Q1 calls out are:

1. Access-control matrix (this file)
2. CSP — `docs/security/policies/csp.md`
3. Data classification — `docs/security/policies/data-classification.md`
4. Incident response — `docs/security/policies/incident-response.md`
5. Vendor management — `docs/security/policies/vendor-management.md`
6. Change management — `docs/security/policies/change-management.md`
7. RLS gap list — `docs/security/rls-gap-list-2026-05-16.json`
8. Service-role leak inventory — `docs/security/service-role-leaks-2026-05-16.md`
9. Adversarial RLS baseline — `docs/security/rls-adversarial-baseline-2026-05-16.md` (Phase 1, copied across at audit time)
10. Immutable audit ledger migration — `supabase/migrations/20260516000001_immutable_audit_log.sql`
11. Audit logger code path — `lib/security/audit-logger.ts`
12. Rate-limit middleware — `lib/rate-limit/`
13. Rate-limit coverage report — `docs/security/rate-limit-audit-2026-05-16.md`
14. RLS adversarial test — `tests/security/cross-tenant.spec.ts`
15. Immutable audit test — `__tests__/security/immutable-audit.spec.ts`
16. Penetration test report — (out of scope for this PR; tracked separately)
17. SBOM — Dependabot + npm-audit gated in CI
18. Secret-management policy — 1Password CLI per `feedback_secrets_handling`
19. Backup + restore runbook — (existing — to be linked when published)
20. Disaster recovery plan — (existing — to be linked when published)
21. Subprocessor inventory — embedded in `vendor-management.md`

## What this matrix does NOT cover (yet)

- A per-table `team_members.role` mapping (org_admin vs org_editor vs
  org_viewer). The current Phase 1/2 RLS work treats every team_member as
  having full tenant access via `is_team_member()`. Phase 3 should add
  role-aware policies on the 18 SECURE tables and propagate the pattern.
- Cross-organization sharing (e.g. an agency viewing a client's data).
  No production tables today support this without a service-role
  workaround. Phase 3.
