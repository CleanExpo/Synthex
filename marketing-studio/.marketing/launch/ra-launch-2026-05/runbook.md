# RestoreAssist Launch Runbook — T+0 → T+30

**Ticket:** SYN-922 · **Campaign:** `ra-launch-2026-05` · **T-0:** 2026-05-08 · **Tier:** Standard

**Outcome target:** 500 App Store downloads + 40 demo bookings over 30 days.

**Phases:** Amplify T+0→T+7 · Distribute T+8→T+14 · Measure T+15→T+30.

**War room:** Telegram pinned status (hour-by-hour) · Linear per-drop tickets under SYN-922 · kill criteria = critical app bug (P0) or PR crisis.

> Email days are per-user relative to each download; the calendar shows the launch-day cohort. The NIR hero video (SYN-915f) is not yet rendered — T+1 carries a still-image contingency.

---

## Phase: Amplify

### T+0 — 2026-05-08 (Fri)

| Time       | Channel  | Asset                                                     | Owner                  | UTM                                                                                                             |
| ---------- | -------- | --------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn founder-origin (li-01)                           | Founder (Phill McGurk) | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-01-founder-origin` |
| 07:00 AEST | email    | Email D0 welcome (drip milestone, per-user from download) | Lifecycle ops          | `utm_source=email&utm_medium=email&utm_campaign=ra-launch-2026-05&utm_content=e1-welcome`                       |

- **Gate:** LinkedIn post live + brand-voice PASS; Email template live in ESP + UTM verified
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed.

### T+1 — 2026-05-09 (Sat)

| Time       | Channel | Asset                                                                             | Owner           | UTM                                                                                          |
| ---------- | ------- | --------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| 10:00 AEST | web     | NIR explainer video → landing hero + LinkedIn organic `SYN-915f (pending render)` | Web / Marketing | `utm_source=landing&utm_medium=referral&utm_campaign=ra-launch-2026-05&utm_content=nir-hero` |

- **Gate:** Landing hero renders (video OR still fallback)
- **Contingency:** If NIR video render fails T+1, ship the still-image carousel (li-05 slides) as landing hero instead and reschedule the video to T+2.

### T+2 — 2026-05-10 (Sun)

| Time       | Channel  | Asset                                                         | Owner         | UTM                                                                                                            |
| ---------- | -------- | ------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn product-scene (li-02)                                | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-02-product-scene` |
| 07:00 AEST | email    | Email D2 quick-start (drip milestone, per-user from download) | Lifecycle ops | `utm_source=email&utm_medium=email&utm_campaign=ra-launch-2026-05&utm_content=e2-quickstart`                   |

- **Gate:** LinkedIn post live + brand-voice PASS; Email template live in ESP + UTM verified
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed.

### T+3 — 2026-05-11 (Mon)

| Time       | Channel  | Asset                                                              | Owner        | UTM                                                                                            |
| ---------- | -------- | ------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------- |
| 11:00 AEST | outreach | Restoration Industry Australia (RIA) newsletter pitch — DUE by T+3 | Founder / PR | `utm_source=outreach&utm_medium=referral&utm_campaign=ra-launch-2026-05&utm_content=ria-pitch` |

- **Gate:** Pitch sent + logged
- **Contingency:** If pitch bounces, use the secondary contact; if no reply in 3 days, reschedule one follow-up only.

### T+4 — 2026-05-12 (Tue)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+5 — 2026-05-13 (Wed)

| Time       | Channel  | Asset                                                      | Owner         | UTM                                                                                                            |
| ---------- | -------- | ---------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn nir-explainer (li-03)                             | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-03-nir-explainer` |
| 07:00 AEST | email    | Email D5 NIR demo (drip milestone, per-user from download) | Lifecycle ops | `utm_source=email&utm_medium=email&utm_campaign=ra-launch-2026-05&utm_content=e3-nir-demo`                     |
| 11:00 AEST | outreach | IICRC Australia member newsletter pitch — DUE by T+5       | Founder / PR  | `utm_source=outreach&utm_medium=referral&utm_campaign=ra-launch-2026-05&utm_content=iicrc-au-pitch`            |

- **Gate:** LinkedIn post live + brand-voice PASS; Email template live in ESP + UTM verified; Pitch sent + logged
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. If pitch bounces, use the secondary contact; if no reply in 3 days, reschedule one follow-up only.

### T+6 — 2026-05-14 (Thu)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+7 — 2026-05-15 (Fri)

| Time       | Channel | Asset                                                   | Owner     | UTM                                                                                                   |
| ---------- | ------- | ------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| 16:00 AEST | review  | Attribution review vs KPI dashboard (channel-plan.json) | Analytics | `utm_source=review&utm_medium=internal&utm_campaign=ra-launch-2026-05&utm_content=attribution-review` |

- **Gate:** KPI thresholds checked; red → contingency
- **Contingency:** If downloads < amber threshold, reallocate the next LinkedIn slot to the best-performing trigger angle.

## Phase: Distribute

### T+8 — 2026-05-16 (Sat)

| Time       | Channel  | Asset                          | Owner         | UTM                                                                                                            |
| ---------- | -------- | ------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn product-scene (li-04) | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-04-product-scene` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed.

### T+9 — 2026-05-17 (Sun)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+10 — 2026-05-18 (Mon)

| Time       | Channel | Asset                                                                       | Owner         | UTM                                                                                          |
| ---------- | ------- | --------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| 07:00 AEST | email   | Email D10 case study (placeholder) (drip milestone, per-user from download) | Lifecycle ops | `utm_source=email&utm_medium=email&utm_campaign=ra-launch-2026-05&utm_content=e4-case-study` |

- **Gate:** Email template live in ESP + UTM verified
- **Contingency:** Standard: reschedule to next day if a drop slips.

### T+11 — 2026-05-19 (Tue)

| Time       | Channel  | Asset                                | Owner         | UTM                                                                                                                  |
| ---------- | -------- | ------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn comparison-carousel (li-05) | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-05-comparison-carousel` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed.

### T+12 — 2026-05-20 (Wed)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+13 — 2026-05-21 (Thu)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+14 — 2026-05-22 (Fri)

| Time       | Channel | Asset                                                   | Owner     | UTM                                                                                                   |
| ---------- | ------- | ------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| 16:00 AEST | review  | Attribution review vs KPI dashboard (channel-plan.json) | Analytics | `utm_source=review&utm_medium=internal&utm_campaign=ra-launch-2026-05&utm_content=attribution-review` |

- **Gate:** KPI thresholds checked; red → contingency
- **Contingency:** If downloads < amber threshold, reallocate the next LinkedIn slot to the best-performing trigger angle.

## Phase: Measure

### T+15 — 2026-05-23 (Sat)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+16 — 2026-05-24 (Sun)

| Time       | Channel  | Asset                                                                    | Owner         | UTM                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn customer-quote (li-06) — PLACEHOLDER, fill only with real quote | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-06-customer-quote` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. Quote slot: if no real permissioned win exists, skip — never fabricate; leave the slot empty.

### T+17 — 2026-05-25 (Mon)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+18 — 2026-05-26 (Tue)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+19 — 2026-05-27 (Wed)

| Time       | Channel  | Asset                          | Owner         | UTM                                                                                                            |
| ---------- | -------- | ------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn product-scene (li-07) | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-07-product-scene` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed.

### T+20 — 2026-05-28 (Thu)

| Time       | Channel | Asset                                                           | Owner         | UTM                                                                                        |
| ---------- | ------- | --------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| 07:00 AEST | email   | Email D20 referral ask (drip milestone, per-user from download) | Lifecycle ops | `utm_source=email&utm_medium=email&utm_campaign=ra-launch-2026-05&utm_content=e5-referral` |

- **Gate:** Email template live in ESP + UTM verified
- **Contingency:** Standard: reschedule to next day if a drop slips.

### T+21 — 2026-05-29 (Fri)

| Time       | Channel | Asset                                                   | Owner     | UTM                                                                                                   |
| ---------- | ------- | ------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| 16:00 AEST | review  | Attribution review vs KPI dashboard (channel-plan.json) | Analytics | `utm_source=review&utm_medium=internal&utm_campaign=ra-launch-2026-05&utm_content=attribution-review` |

- **Gate:** KPI thresholds checked; red → contingency
- **Contingency:** If downloads < amber threshold, reallocate the next LinkedIn slot to the best-performing trigger angle.

### T+22 — 2026-05-30 (Sat)

| Time       | Channel  | Asset                                                                    | Owner         | UTM                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn customer-quote (li-08) — PLACEHOLDER, fill only with real quote | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-08-customer-quote` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. Quote slot: if no real permissioned win exists, skip — never fabricate; leave the slot empty.

### T+23 — 2026-05-31 (Sun)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+24 — 2026-06-01 (Mon)

| Time       | Channel  | Asset                                                                    | Owner         | UTM                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn customer-quote (li-09) — PLACEHOLDER, fill only with real quote | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-09-customer-quote` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. Quote slot: if no real permissioned win exists, skip — never fabricate; leave the slot empty.

### T+25 — 2026-06-02 (Tue)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+26 — 2026-06-03 (Wed)

| Time       | Channel  | Asset                                                                    | Owner         | UTM                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn customer-quote (li-10) — PLACEHOLDER, fill only with real quote | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-10-customer-quote` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. Quote slot: if no real permissioned win exists, skip — never fabricate; leave the slot empty.

### T+27 — 2026-06-04 (Thu)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+28 — 2026-06-05 (Fri)

| Time       | Channel  | Asset                                                                    | Owner         | UTM                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn customer-quote (li-11) — PLACEHOLDER, fill only with real quote | Marketing ops | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-11-customer-quote` |

- **Gate:** LinkedIn post live + brand-voice PASS
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. Quote slot: if no real permissioned win exists, skip — never fabricate; leave the slot empty.

### T+29 — 2026-06-06 (Sat)

_Rest — no scheduled drop._

- **Gate:** Rest — no scheduled drop. Sequence emails still drip per-user.
- **Contingency:** None needed (rest day). If a prior drop slipped, backfill it here.

### T+30 — 2026-06-07 (Sun)

| Time       | Channel  | Asset                                                                    | Owner               | UTM                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| 09:00 AEST | linkedin | LinkedIn customer-quote (li-12) — PLACEHOLDER, fill only with real quote | Marketing ops       | `utm_source=linkedin&utm_medium=organic-social&utm_campaign=ra-launch-2026-05&utm_content=li-12-customer-quote` |
| 16:00 AEST | review   | Attribution review vs KPI dashboard (channel-plan.json)                  | Analytics           | `utm_source=review&utm_medium=internal&utm_campaign=ra-launch-2026-05&utm_content=attribution-review`           |
| 16:30 AEST | review   | Retro + file next-cycle tickets under SYN-915g                           | Founder / Marketing | `utm_source=review&utm_medium=internal&utm_campaign=ra-launch-2026-05&utm_content=retro`                        |

- **Gate:** LinkedIn post live + brand-voice PASS; KPI thresholds checked; red → contingency
- **Contingency:** If a caption fails brand-voice, hold and post next slot; never ship unreviewed. Quote slot: if no real permissioned win exists, skip — never fabricate; leave the slot empty. If downloads < amber threshold, reallocate the next LinkedIn slot to the best-performing trigger angle.
