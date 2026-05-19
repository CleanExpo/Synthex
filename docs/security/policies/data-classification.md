# Data Classification

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b`
**SOC 2 artifact:** #3 of 21 (Margot Q1)
**Owner:** Senior Security Engineer (rotates per board policy)

## Tiers

| Tier              | Examples                                                   | Storage rules                                                                               | Audit rules                                          |
|-------------------|------------------------------------------------------------|---------------------------------------------------------------------------------------------|------------------------------------------------------|
| **Tier 1 — Public** | Marketing pages, public testimonials, blog posts            | Plain Postgres `public.*`; RLS `using(true)` for SELECT is intentional.                    | Best-effort. No special logging.                     |
| **Tier 2 — Internal**| Internal analytics, anonymised telemetry, system events     | Postgres `public.*`; service_role-only or tenant-scoped RLS.                                | Sampled. 90-day retention via `audit_logs`.          |
| **Tier 3 — Confidential**| Tenant content, campaigns, leads, GBP/GA4 metrics, drafts   | Postgres `public.*`; STRICT tenant-scoped RLS; service-role routes require `@allow-service-role` annotation. | Every read/write → `audit_logs` (tier 3 events).     |
| **Tier 4 — Sensitive PII** | Email, phone, OAuth refresh tokens, full names, IP history | Postgres `public.*` + field-level encryption via `lib/security/field-encryption.ts`; never in logs. | Every access → `audit_events_immutable` (compliance).|
| **Tier 5 — Restricted**  | Payment card data (PCI), passwords, secrets, API keys      | NEVER in our Postgres. Stripe vault + 1Password + Supabase Vault only.                      | Out-of-band; every access logged at the secrets-manager layer. |

## Per-product mapping (current)

| Table family                                | Tier | Justification                                                              |
|---------------------------------------------|------|----------------------------------------------------------------------------|
| `BlogPost`, `industry_templates`            | 1    | Marketing, public-read by design                                           |
| `analytics_events`, `analytics_metrics`     | 2    | Internal telemetry, tenant-aggregated                                       |
| `leads`, `campaigns`, `content_drafts`, `gbp_*`, `gsc_*`, `keyword_*`, `invoices` | 3    | Tenant business data — the core SaaS payload                              |
| `users.email`, `auth_events`, `vault_access_logs` | 4    | PII + auth telemetry                                                       |
| `vault_secrets`, OAuth tokens               | 5    | Pass-through to Supabase Vault and Stripe — encrypted at rest by provider |

## Retention

- Tier 1: no retention floor; deleted on user request.
- Tier 2 + Tier 3: retained per the active subscription. On account
  closure, soft-delete + 90-day grace, then hard-delete with audit
  trail to Tier 4.
- Tier 4: 7-year retention for SOC 2 evidence, then auto-purge with a
  final immutable audit record.
- Tier 5: provider-managed (Supabase Vault, Stripe, 1Password).

## Encryption-at-rest

- Postgres: Supabase TDE + AES-256 baseline.
- Tier 4 PII columns: additionally column-encrypted via libsodium
  (`lib/security/field-encryption.ts`). Encryption key is fetched from
  Supabase Vault at startup; never in env vars.
- Tier 5: never in our infrastructure.

## In-transit

TLS 1.2+ for every endpoint. Supabase Postgres connection uses pooler
on port 6543 with `sslmode=require`.

## Out-of-scope (not yet in our system)

- PHI (health information) — Synthex does not handle.
- Australian TFN / similar government identifiers — not stored.
- Children-under-13 data — Synthex ToS prohibits.
