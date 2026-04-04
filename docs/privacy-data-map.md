# Privacy Data Map — Synthex

**Applicable regulation:** Australian Privacy Act 1988 — Australian Privacy Principle (APP) 11
**Last updated:** 24/03/2026

---

## Account Deletion (POST /api/founder/delete-account)

Deletes the authenticated user's account by removing the record from `auth.users`.
All dependent tables are removed automatically via `ON DELETE CASCADE` foreign-key constraints.

### Tables cascaded from `auth.users`

| Table                           | Relationship               | Notes                                                     |
| ------------------------------- | -------------------------- | --------------------------------------------------------- |
| `users`                         | `user_id → auth.users.id`  | Profile, settings, preferences                            |
| `organizations`                 | via `users.id`             | Owner-only orgs cascade; shared orgs retain other members |
| `campaigns`                     | `user_id → users.id`       | All campaign data                                         |
| `posts`                         | via `campaigns`            | Content, scheduling, drafts                               |
| `platform_posts`                | via `posts`                | Per-platform publish records                              |
| `platform_connections`          | `user_id → users.id`       | OAuth tokens (encrypted at rest)                          |
| `platform_metrics`              | via `platform_connections` | Engagement analytics                                      |
| `api_credentials`               | `user_id → users.id`       | BYOK API keys                                             |
| `subscriptions`                 | `user_id → users.id`       | Stripe subscription references                            |
| `audit_logs` (user-linked rows) | `user_id → users.id`       | See Retention section below                               |
| `ab_tests`                      | via `campaigns`            | A/B test configurations                                   |
| `ab_test_variants`              | via `ab_tests`             | Variant copy                                              |
| `ab_test_results`               | via `ab_test_variants`     | Performance data                                          |
| `scheduled_reports`             | `user_id → users.id`       | Report schedules                                          |
| `report_deliveries`             | via `scheduled_reports`    | Delivery history                                          |
| `brand_generations`             | `user_id → users.id`       | AI-generated brand assets                                 |
| `user_psychology_preferences`   | `user_id → users.id`       | Onboarding profile data                                   |
| `onboarding_progress`           | `user_id → users.id`       | Step completion state                                     |
| `gsc_properties`                | via `platform_connections` | Google Search Console links                               |

### Pre-deletion steps (performed by the API)

1. **OAuth token revocation** — best-effort call to each connected platform's token revocation endpoint before DB deletion. Failures are logged and do not block deletion.
2. **Supabase admin user deletion** — `supabase.auth.admin.deleteUser(userId)` removes the `auth.users` row, triggering all cascades above.

---

## Data Retention

The following data is retained after account deletion for legal or safety reasons.

| Data                           | Retention period | Reason                                                   |
| ------------------------------ | ---------------- | -------------------------------------------------------- |
| Anonymised audit log entries   | 7 years          | Legal obligation — financial and operational audit trail |
| Billing records (Stripe)       | 7 years          | Tax obligation (Australian Taxation Office requirement)  |
| Aggregate/anonymised analytics | Indefinite       | No PII — used for platform improvement only              |

Audit log rows retain `action`, `resource_type`, `outcome`, `category`, and `severity` but have `user_id` set to `NULL` on deletion (or are retained with a synthetic anonymised identifier). Billing records are held in Stripe's systems under Synthex's data processing agreement.

---

## Subject Access Requests

To request a copy of your data before deletion, contact **privacy@synthex.social**.
We will respond within 30 days as required under APP 12.

---

## Contact

**Privacy Officer:** Synthex Pty Ltd · privacy@synthex.social
**Data Processing Agreement:** Available on request
