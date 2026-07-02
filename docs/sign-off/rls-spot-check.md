# RLS Cross-Tenant Spot Check — Synthex production — 2026-05-16

## Recent 5 users sampled

```
id                                    | email                              | created
7271732c-6a18-49d7-b2f2-dde69f8228f2  | bugbountytest478@gmail.com         | 2026-03-04
5d9cdc53-3415-42b2-8a93-854eaf24af66  | phill.mcgurk+test1@gmail.com       | 2026-03-01
609eab9f-c94e-45cc-9e70-392400d9e8b2  | e2e-1772184218996@synthex.test     | 2026-02-27
9d29bee4-f38d-4c1e-ac93-f5f8ce1f4307  | e2e-1772183472684@synthex.test     | 2026-02-27
df93cdf5-24f8-40bf-9672-804e73c2bc5d  | e2e-1772182841626@synthex.test     | 2026-02-27
```

## Tenant-ID NULL audit on content tables

```sql
SELECT 'campaigns'        AS tbl, COUNT(*) total, COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_orgs FROM campaigns
UNION ALL
SELECT 'content_calendars', COUNT(*), COUNT(*) FILTER (WHERE organization_id IS NULL) FROM content_calendars
UNION ALL
SELECT 'posts',             COUNT(*), 0 FROM posts;  -- posts has no organization_id column
```

| Table | Total rows | NULL org_id | Status |
|---|---|---|---|
| campaigns | 33 | **1** | **FAIL — cross-tenant leak risk** |
| content_calendars | 2 | 0 | PASS |
| posts | 189 | n/a (no column) | NEEDS-REVIEW (org isolation via FK chain?) |
| brand_profiles | (table does not exist) | n/a | NEEDS-REVIEW |

## NULL row detail

```
id=cmm37zez50005l404mvrci9bx
name="Scheduled Posts"
organization_id=null
created_at=2026-02-26 08:47:09.714
```

A NULL `organization_id` on a row in an RLS-policied tenant table means **either**:
1. RLS policy lets NULL pass for some role, exposing this row cross-tenant, OR
2. The row predates the organization_id column and was never backfilled.

Either way, this is a **production data integrity defect** that must be triaged.

## Posts table tenancy

`posts` has no `organization_id` column. Isolation must flow through a relation (likely `content_calendar_id → content_calendars.organization_id` or `user_id → users.organization_id`). This is a valid pattern but the RLS policy must explicitly join through that FK — verify in a follow-up audit.

## Verdict: CONDITIONAL FAIL

One concrete cross-tenant leak risk (`campaigns.id=cmm37zez50005l404mvrci9bx`) needs triage. Posts table tenancy model needs explicit RLS-policy verification.
