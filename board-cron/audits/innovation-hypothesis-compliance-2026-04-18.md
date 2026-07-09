# Innovation Pre-Build Compliance Audit — 5-Innovation Readiness Matrix

**Audit date:** 2026-04-18
**Task reference:** SYN-757 (Session 40 Next Action 3) — Rotation 10 Innovation Governance Arc.
**Owner:** Engineering (Claude execution) + Phill (SYN-736 authoring window this weekend).
**Companion artifacts:** `board-cron/templates/innovation-hypothesis.md` (registration template, SYN-755),
`board-cron/logs/innovation-hypothesis-compliance.jsonl` (compliance log).

---

## Executive summary

**Phill can author complete hypotheses for 3 of 5 innovations this weekend (SYN-621, SYN-647,
SYN-680) without waiting for any additional technical preconditions.** The remaining two (SYN-602
Algorithm KB, SYN-663 Content Intelligence Engine) are partial: their per-signal scoring depends on
`content_performance_profiles` (SYN-631), so only a partial hypothesis — baseline + category +
sunset trigger — can be authored now, with the RPC-delta metric finalised once SYN-631 lands
(earliest Sprint 5 Week 2).

**SYN-736 priority escalation recommended: Normal → High.** Three of five hypotheses are
weekend-ready with zero preconditions, and each unauthored innovation currently ships with no
pre-registered success threshold — meaning the Sunset Review mechanism (SYN-734) cannot score it.
Authoring is the cheapest possible unblock and gates the entire governance arc.

**Total authoring time:** ~2.5 hours across two weekend sessions.

---

## Readiness matrix

| # | Issue | Innovation | `innovation_category` | Weekend-ready | Second-level blocker | Baseline data availability | Earliest complete hypothesis | Earliest 90d window close |
|---|-------|-----------|-----------------------|:-------------:|----------------------|----------------------------|------------------------------|---------------------------|
| 1 | SYN-602 | Algorithm KB | Intelligence Infrastructure | ⚠️ partial | SYN-631 (`content_performance_profiles`) | Partial — engagement variance available; per-signal scoring needs SYN-631 | Sprint 5 Week 2 | ~Sprint 8 Week 1 |
| 2 | SYN-621 | ROI Attribution | Client Outcome Attribution | ✅ ready | None | Complete — zero attribution visibility, confirmed by `posts` table | This weekend | ~Sprint 9 Week 1 |
| 3 | SYN-647 | Knowledge Graph | Intelligence Infrastructure | ✅ ready | SYN-650 A/B gate — ship precondition only, **not** a blocker for authoring | Complete — `recommended_actions` and `ai_weekly_digests` available | This weekend | ~Sprint 9 Week 2 |
| 4 | SYN-663 | Content Intelligence Engine | Intelligence Infrastructure | ⚠️ partial | SYN-631 + SYN-664 (`content_score_history`, first sub-issue of SYN-663) | Partial — engagement variance available | Sprint 5 Week 2 | ~Sprint 10 Week 1 |
| 5 | SYN-680 | Ask Synthex Anything | Conversational Interfaces | ✅ ready | SYN-681 (`client-context-query`; follows SYN-626 immediately) | Complete — zero conversational UI exists, confirmed by absence of `conversation_events` table | This weekend | ~Sprint 11 Week 1 |

Legend: ✅ ready = a complete hypothesis (all 10 mandatory template fields) can be authored now with
no further technical precondition. ⚠️ partial = baseline, category and sunset trigger are authorable
now, but the RPC-delta metric / `success_threshold_aud` cannot be finalised until the named
second-level blocker lands.

---

## Provisional `innovation_category` assignments

These values pre-populate the `category` column of the `innovation_outcomes` table when SYN-734
ships. They are also the authoritative category for each innovation's hypothesis `innovation_category`
field (template field 4).

| Issue | Innovation | Provisional `innovation_category` |
|-------|-----------|-----------------------------------|
| SYN-602 | Algorithm KB | Intelligence Infrastructure |
| SYN-621 | ROI Attribution | Client Outcome Attribution |
| SYN-647 | Knowledge Graph | Intelligence Infrastructure |
| SYN-663 | Content Intelligence Engine | Intelligence Infrastructure |
| SYN-680 | Ask Synthex Anything | Conversational Interfaces |

Distribution: Intelligence Infrastructure ×3, Client Outcome Attribution ×1, Conversational
Interfaces ×1. The fourth taxonomy category, Measurement Governance, has no unshipped innovation in
this cohort (it covers the governance infrastructure itself — the `innovation_outcomes` table, the
scorecard view, the Sunset Review protocol, and the hypothesis template).

---

## Suggested execution order for Phill's SYN-736 weekend authoring

**Session 1 — Saturday (~1.5 hours): the three zero-precondition innovations, complete hypotheses.**

1. **SYN-621 ROI Attribution** — start here; baseline is the cleanest (zero attribution visibility,
   directly confirmed by the `posts` table) and there are no second-level blockers.
2. **SYN-647 Knowledge Graph** — baseline complete (`recommended_actions`, `ai_weekly_digests`);
   record SYN-650's A/B gate as a `ship_precondition`, not an authoring blocker.
3. **SYN-680 Ask Synthex Anything** — baseline complete (absence of `conversation_events` table);
   record SYN-681 (which follows SYN-626) as a `ship_precondition`.

**Session 2 — Sunday (~1 hour): the two partials, authored to partial completeness.**

4. **SYN-602 Algorithm KB** — author baseline (engagement variance), category and sunset trigger;
   leave RPC-delta / `success_threshold_aud` provisional pending SYN-631.
5. **SYN-663 Content Intelligence Engine** — same partial treatment; note both SYN-631 and SYN-664
   (`content_score_history`) as the preconditions before the metric can be fixed.

Save each completed hypothesis to `board-cron/templates/innovation-hypothesis-{SYN-XXX}-{slug}.md`
(e.g. `innovation-hypothesis-SYN-680-ask-synthex-anything.md`).

---

## Template completability cross-reference

Checked against the 10 mandatory fields in `board-cron/templates/innovation-hypothesis.md`. The
table records, per innovation, whether each mandatory field is completable **now** given current data
availability.

| Template field | SYN-602 | SYN-621 | SYN-647 | SYN-663 | SYN-680 |
|----------------|:-------:|:-------:|:-------:|:-------:|:-------:|
| 1. `innovation_hypothesis_id` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. `parent_issue` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3. `innovation_title` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4. `innovation_category` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5. `rpc_delta_metric` | ⚠️ needs SYN-631 | ✅ | ✅ | ⚠️ needs SYN-631/664 | ✅ |
| 6. `success_threshold_aud` | ⚠️ needs SYN-631 | ✅ | ✅ | ⚠️ needs SYN-631/664 | ✅ |
| 7. `measurement_window_days` | ✅ (default 90) | ✅ | ✅ | ✅ (default 90) | ✅ |
| 8. `baseline_state` (mandatory) | ✅ partial data | ✅ | ✅ | ✅ partial data | ✅ |
| 9. `ship_preconditions` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10. `sunset_trigger` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Conclusion:** for SYN-621, SYN-647 and SYN-680 all ten mandatory fields are completable now — a
fully valid hypothesis can be registered this weekend. For SYN-602 and SYN-663, eight of ten fields
are completable now; only the two dollar-denominated fields (`rpc_delta_metric`,
`success_threshold_aud`) must wait for `content_performance_profiles` (SYN-631) — and, for SYN-663,
`content_score_history` (SYN-664) — before the 90-day sunset clock can be armed. Per template field 6,
an `innovation_outcomes` row cannot be inserted without `success_threshold_aud`, so the two partials
should not be treated as "shipped" for Sunset Review purposes until those fields are filled.

---

## SYN-736 call to action

After SYN-755 (template) and SYN-756 (sunset spec) are shipped, execute SYN-736 this weekend in the
order above. Escalate SYN-736 Normal → High. Each hypothesis uses
`board-cron/templates/innovation-hypothesis.md`; save completed copies to
`board-cron/templates/innovation-hypothesis-{SYN-XXX}-{slug}.md`. ~2.5 hours total authoring time.
