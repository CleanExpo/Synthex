# B2 — Trigger Orchestration Layer

> **Status:** Scoping only (SYN-812). Implementation gated on B1 and B3.

## Scope

Event-detection logic for the 8 active triggers (Q2.5.2):

| Trigger | Detection signal                     | Action                                    |
| ------- | ------------------------------------ | ----------------------------------------- |
| T1      | New lead lands in `leads` table      | Sequence start                            |
| T2      | Lead replies via Mailchimp           | Sequence advance                          |
| T3      | 7-day no-action since T1             | Sequence advance                          |
| T4      | Cross-promotion eligibility met      | Cross-brand touch (B1 dependency)         |
| T5      | **Compliance deadline approaching**  | Compliance touch — overrides T3/T4/T7/T10 |
| T7      | Quarterly check-in window            | Sequence advance                          |
| T8      | **Hard compliance deadline reached** | Compliance touch — overrides T3/T4/T7/T10 |
| T10     | Annual renewal window                | Sequence advance                          |

T5 and T8 are compliance overrides — they pause T3/T4/T7/T10 for the same
identity until the compliance window closes.

## Foundation references

- Q2.5.2 — 8 active triggers + override semantics
- Q2.5.3 — pooled frequency cap (3 touches / 7 days per identity, ESP-side)
- Q3.2.4 — source-of-truth job ID linking D4 ↔ N4 (no double-counting)
- 8pm-7am AU quiet hours — hard-coded, not configurable per brand
- One-reply-ends-sequence — any inbound from the identity halts active triggers

## Hard dependencies

- **B3 must ship first** — no email triggers fire without an ESP wired
- **B1 must ship first** — frequency cap pooling needs cross-brand identity
- **VG-71 must clear** — external client agreement gates B1, which gates B2

## Architecture

Single orchestrator process (Edge Function with cron triggers, plus
event-driven webhooks from Mailchimp / Stripe / etc.). Each trigger:

1. **Detection function** — pure function over `(identity_id, time_window)`
   returning `{ should_fire: bool, override_reason?: string }`
2. **Frequency cap check** — query `identity_records.last_touch_at` joined
   with `mailchimp_events` for the rolling 7-day window
3. **Quiet hours check** — current time in AEST, between 07:00 and 20:00
4. **Override check** — for T3/T4/T7/T10, return false if T5 or T8 is active
   for the same identity
5. **Source-of-truth job ID** — every fired trigger writes a row to
   `trigger_dispatch_log` with a job ID that downstream consumers reference
   (D4 ↔ N4 link in Q3.2.4)

## State machine

```
new lead → T1 fired → 7-day timer
         ↓
     reply received? → T2 fired → sequence ends OR continues based on copy
         ↓
     no reply 7d → T3 fired
         ↓
     T5 / T8 window? → T5 / T8 fires; T3/T4/T7/T10 paused for window
         ↓
     T7 / T10 timers continue once compliance window closes
```

## Frequency cap rule

3 touches per 7-day window per identity, **pooled across brands**. Pooling
requires B1's cross-brand identity records — without it, each brand
maintains its own 3-per-7 limit and the rule is violated whenever an
identity touches multiple brands.

`mailchimp_events` table queried by `identity_id` (from B1) over a rolling
7-day window. If `count >= 3`, all triggers for that identity short-circuit
with `override_reason: 'frequency_cap_pool_exceeded'`.

## Smoke test plan

1. Create a fresh `lead` row → T1 should fire within 60 seconds.
2. Set system time to 21:00 AEST → T1 should defer to next 07:00 (quiet hours).
3. Fire T5 for an identity that has T3 pending → T3 fires must short-circuit
   with `override_reason: 't5_compliance_override'`.
4. Inject 3 prior `mailchimp_events` rows in the past 7 days for one
   identity → next trigger fires must short-circuit with frequency cap.
5. Send an inbound reply to a sequence in flight → all subsequent triggers
   for that identity must be suppressed (one-reply-ends-sequence).
6. Identity touches DR + NRPG in same week → frequency count is pooled,
   not per-brand.

## CEO action items (must clear before engineering starts)

- [ ] B1 (identity resolution) shipped to production
- [ ] B3 (Mailchimp ESP) shipped to production with Customer Journey
      templates for T3, T4, T5, T7, T8, T10
- [ ] external client agreement (VG-71) — gates B1, gates B2
- [ ] Confirm 8pm-7am AEST is the right quiet-hours window for AU+NZ
      (NZ is UTC+12 vs AU UTC+10 — does the rule apply per-recipient or
      per-business-clock?)
- [ ] Confirm one-reply-ends-sequence applies to ALL active sequences for
      the identity, or only the sequence the reply was addressed to

## Out of scope

- T6 / T9 — not in the active list (Q2.5.2)
- ESP-side throttling — that's Mailchimp config, lives in B3
- Outbound calling triggers — separate epic, not in the 8 active list
