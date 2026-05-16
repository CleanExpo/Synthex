# Incident Response

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b`
**SOC 2 artifact:** #4 of 21 (Margot Q1)
**Pager:** Telegram → @phill.mcgurk (single-shot per `feedback_no_repeating_alerts`)
**Backup pager:** Margot (Telegram, 24/7) — automatic Board escalation.

## Severity scale

| Sev  | Definition                                                                  | Page within | Phill paged?              |
|------|-----------------------------------------------------------------------------|-------------|---------------------------|
| Sev1 | Production down, data loss, or active cross-tenant breach (RLS bypass live) | 5 min       | Yes (single-shot)         |
| Sev2 | Degraded service, partial breach, single-tenant data exposure               | 30 min      | Yes (single-shot)         |
| Sev3 | Internal SLA miss, scheduled-task failure, single user impact               | 4 hours     | No (Margot Board ticket)  |
| Sev4 | Low-noise anomaly, infra cost spike, lint regression                        | 24 hours    | No (Linear ticket)        |

## Escalation chain

1. **Sentinel** (autonomous monitor) detects anomaly → single Telegram.
2. On-call engineer (= Senior Security Engineer in working hours; Margot
   after hours) acknowledges within the SLA.
3. If unacked, Margot escalates to Phill at +30 min for Sev1, +1h for Sev2.
4. Sev1 + Sev2 spawn a Linear incident ticket linked to the Telegram
   message and the `audit_events_immutable` event chain.

## Roles in active incident

- **Incident Commander (IC):** the on-call engineer. Single decision-maker.
- **Comms Lead:** Margot (or designate) — drafts customer-facing
  communication.
- **Scribe:** automatic — every IC action goes to `audit_events_immutable`
  with `event_type` starting `incident.*`.
- **Subject Matter Expert:** pulled in by the IC if needed.

## Playbook — RLS / cross-tenant data exposure (the live risk)

1. **Confirm.** Re-run `pg_policies` query against affected table.
2. **Contain.** If the leak is a service-role route, push a hotfix that
   adds a server-side `organization_id` assertion BEFORE the
   `.from(...).eq(...)` call. Deploy to production via Vercel as soon
   as CI green.
3. **Quantify.** Query `audit_logs` and `audit_events_immutable` for
   the table + time window. Build an affected-tenant list.
4. **Notify.** For Tier 3 + Tier 4 data: notify affected tenants within
   72 hours per data-classification policy. Draft via Comms Lead, sent
   from `security@unite-group.in`.
5. **Post-mortem.** Within 5 business days. Permanent guard added per
   `feedback_audit_verification`.

## Post-mortem template (copy + fill)

```
# Incident <ID> — <date> — <one-line summary>

Sev: <1|2|3|4>
Duration: <detect→resolve>
Affected: <tenants / users / data classes>

## Timeline
- HH:MM — Detection (auto / human)
- HH:MM — Containment
- HH:MM — Resolution

## Root cause
<single paragraph>

## Why our existing guards didn't catch this
<honesty, no scapegoating>

## Permanent guards added
- [ ] <test / lint / monitor / runbook>

## Data classification impact
- Tier <X> data exposed: <none / row counts>

## Auditor-facing summary
<3 sentences a SOC 2 auditor can quote>
```

## Required documents for SOC 2 audit

- Last 12 months of post-mortems (`docs/incidents/`)
- Sev1 + Sev2 ack-time table (auto-extracted from `audit_events_immutable`)
- Annual tabletop exercise log (run by Margot)
- Vendor breach notification process (see `vendor-management.md`)

## Telegram message format (single-shot)

```
INCIDENT Sev<N> <ID>
<one-line summary>
ack: telegram thread or `/incident-ack <ID>`
runbook: docs/security/policies/incident-response.md
```

Per `feedback_no_repeating_alerts`: never every-cycle pings of
non-actionable state. Sentinel batches anomalies in one daily message
unless severity escalates.
