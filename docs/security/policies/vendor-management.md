# Vendor Management

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b`
**SOC 2 artifact:** #5 of 21 (Margot Q1)
**Owner:** Senior Security Engineer + CEO co-sign for Tier-A vendors.

## Subprocessor inventory (current)

| Vendor               | Service               | Data tier touched | Region    | DPA on file | Status                |
|----------------------|-----------------------|-------------------|-----------|-------------|-----------------------|
| Supabase             | Postgres, Auth, Storage, Edge Functions | T1-T4         | ap-southeast-1 (Sydney) | Yes — standard SCC | Critical (Tier-A)     |
| Vercel               | Edge runtime, build, deploy             | T1-T3 (logs)  | Global (Edge) + IAD1 | Yes               | Critical (Tier-A)     |
| Stripe               | Payments, invoicing                     | T3 (customer email + name) + T5 (PAN, handled by Stripe) | AU + US | Yes               | Critical (Tier-A)     |
| Anthropic            | Claude API (Sonnet, Opus)               | T2-T3 ephemeral | US                  | Anthropic DPA (Apr 2025) | Critical (Tier-A)     |
| OpenAI               | embeddings + occasional GPT             | T2-T3 ephemeral | US                  | Yes               | Operational (Tier-B)  |
| Google (Gemini)      | Gemini Flash + Pro                      | T2-T3 ephemeral | Global              | Yes               | Operational (Tier-B)  |
| ElevenLabs           | Voice synthesis                         | T2 (script text) | US                  | Yes               | Operational (Tier-B)  |
| Resend               | Transactional email                     | T4 (user email) | EU                   | Yes               | Operational (Tier-B)  |
| 1Password            | Secret management                       | T5              | Global              | Yes               | Critical (Tier-A)     |
| GitHub               | Source + Actions                        | T1-T2 (code only; never customer data) | US | Yes | Critical (Tier-A)     |
| DataForSEO           | SEO data ingest                         | T2              | EU                  | Yes               | Operational (Tier-B)  |
| Telegram             | Operator alerts (no customer data)      | None (internal)  | Global             | N/A               | Operational (Tier-C)  |
| Composio             | Tool routing for Margot                 | T2 (workflow data) | US                | Yes               | Operational (Tier-B)  |

Tier-A: critical path, downtime = SLA breach. Tier-B: degrades feature
but app remains usable. Tier-C: internal-only, no customer data.

## Tier classification triggers

- A vendor processes Tier 4 (PII) data → Tier-A.
- A vendor's downtime = our downtime → Tier-A.
- All Tier-A vendors require: signed DPA + annual security questionnaire
  refresh + named escalation contact in our 1Password.

## Onboarding new vendor

1. **Data tier check.** What tier of data does this vendor see? (See
   `data-classification.md`.)
2. **DPA.** No signed DPA = no production access. Standard SCC for
   non-EU vendors handling EU citizen data.
3. **SOC 2 / ISO 27001 report.** Vendors at Tier-A must produce a SOC 2
   Type II OR ISO 27001 certification.
4. **Subprocessor disclosure.** If we add the vendor to a customer-facing
   product, update the public subprocessor list at
   `unite-group.in/legal/subprocessors` within 30 days.
5. **Audit-log integration.** Vendor must support webhook or pull-based
   access logs that we can ingest into `audit_events_immutable`.

## Annual review

Q1 every year. Margot drives the checklist:
- DPA still valid + signed by the same legal entity
- Subprocessor list still matches what's in production code
- SOC 2 / ISO renewal letter received
- No critical CVE on the vendor's dependency chain (cross-checked
  against npm-audit + Dependabot)

Output: a single Linear ticket per vendor; closure proves Q1 review
complete.

## Breach notification SLA

If a vendor reports a breach affecting Tier 3 or Tier 4 data:
- Acknowledge their notification within 24h
- Begin customer notification process per `incident-response.md` (72h
  rule for affected tenants)
- File an immutable `compliance.vendor_breach` audit event

## DPA template

Located at `~/Documents/Legal/DPA-template-2026-05.docx` (Phill's drive).
Synthex requires the following clauses in every vendor DPA:

1. Data processor role definition (vendor is processor, Unite-Group is controller)
2. Subprocessor onboarding requires 30-day notice
3. Right to audit (annual, on-demand for cause)
4. Breach notification within 72 hours of vendor discovery
5. Data deletion within 30 days of contract end + certificate of destruction
6. Australian Privacy Principles compliance OR equivalent (GDPR, CCPA)

## Out-of-scope

- Vendors used only for internal staff productivity (e.g. Notion, Linear
  for our own team) are tracked separately in the IT inventory, not
  here. They never touch customer data.
