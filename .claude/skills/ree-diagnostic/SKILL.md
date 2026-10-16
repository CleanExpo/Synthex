---
name: ree-diagnostic
description: >-
  Operator procedure for the manual REE Diagnostic (initiative B1): a fixed
  five-day read of what Google, Maps and AI answer engines say about one vetted
  business, its entity consistency and its conversion path, ending in three
  ranked actions with evidence states and stated unknowns. Use when preparing,
  running or reviewing a diagnostic for a portfolio brand or an approved client.
  IDE-only: not product-invocable.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: action-skill
  triggers:
    - ree diagnostic
    - search diagnostic
    - visibility audit
    - what does google say about
  requires:
    - google-business-profile
    - google-search-console
    - google-updates-sentinel
---

# REE Diagnostic — manual operator procedure

Spec: `docs/ree/REE-SPEC.md` (§6 loop and evidence states, §13 guardrails). Source ledger: `docs/ree/sources/platform-changes-2025-2026.md`. Commercial context: B1 in the REE commercial plan (Board order 10, after the commercial-truth, brand-truth, evidence-state, legal and approval gates).

## Gate before day 1 (all must hold, or do not start)

- The client is vetted and founder-approved; price and terms are the founder-approved pilot terms. Prices are test hypotheses, never promises.
- Written consent and grants: GBP, Search Console and Bing Webmaster access, or the client's own exports. No grant means `UNAUTHORISED`, not a guess.
- No ad spend. No outcome or ranking guarantees anywhere in the deliverable.
- Tenant isolation: one client per working folder; never mix another client's data.
- Start a time log now. Every step is timed: the diagnostic doubles as the manual-vs-REE benchmark (B8).

## Evidence rules (non-negotiable)

Every reading carries exactly one state: `OBSERVED`, `UNAVAILABLE`, `UNAUTHORISED`, `UNSUPPORTED`, `STALE` or `PARTIAL`. Only `OBSERVED` is written as a number; a genuine zero is `OBSERVED 0`. Heuristic scores (GEO readiness, E-E-A-T, content quality) are labelled `DIAGNOSTIC` and never presented as visibility. Mentions, citations and outcomes are reported separately. Each claim is tagged `[VERIFIED]`, `[INFERENCE]` or `[UNCONFIRMED]`.

## Five days

| Day | Read                                                                                                                                                                                                                                                            | Output                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Entity truth.** Legal name, trading names, ABN, address or service area, phone, hours, categories, licences, insurer/partner permissions. Compare the GBP profile, website, Bing Places and the top directories.                                              | Entity sheet with every mismatch and its source                       |
| 2   | **Search and Maps.** 10–20 real customer queries × the client's suburbs × mobile: who appears in the local pack and organic results. GBP Performance and Search Console for the last full 28 days, web type only unless the account shows other reports.        | Capture log with date, locale, device and source per row              |
| 3   | **AI answers.** The same queries in Google AI Overviews/AI Mode, ChatGPT search, Perplexity, Gemini and Copilot, logged by hand with date, model and locale. Search Console generative-AI reports and Bing AI Performance if granted. Probes are `DIAGNOSTIC`.  | Answer log: is the business named, cited, wrong, or absent            |
| 4   | **Conversion path.** From result to enquiry on mobile: page speed (field data if present), call/booking friction, proof shown (real job photos, named expert, reviews), offer clarity, form fields. Optional: consented call or form tracking already in place. | Friction list with screenshots                                        |
| 5   | **Diff and rank.** Compare winners with matched non-winners (never copy one winner). Policy check each idea: SAFE / CAUTION / PROHIBITED (drop prohibited). Check the update calendar for confounds.                                                            | Three ranked actions, each with metric, window, control and stop rule |

## Deliverable (one document + one short video walkthrough)

1. **What Google, Maps and AI say about you today** — table of readings with states.
2. **Entity consistency** — mismatches, where, and the fix owner.
3. **Conversion path** — the three biggest frictions.
4. **Three ranked actions** — each pre-registered: hypothesis, evidence class, effort, metric, window, keep/inconclusive/stop rule. No guarantees.
5. **Unknowns** — every `UNAVAILABLE`/`UNAUTHORISED`/`UNSUPPORTED` reading and what would resolve it.
6. **Time log** — hours per day, for the margin gate (delivery cost cap set by the founder-approved pilot terms).

Video-first: record a 3–5 minute screen walkthrough for owners who prefer video.

## Never

- Never fabricate, smooth or back-fill a number; never turn a failed read into 0.
- Never scrape behind a login, bypass CAPTCHA or rate limits, or use a spoofed crawler user agent as proof of what Google sees.
- Never recommend incentivised or gated reviews, fake locations, keyword-stuffed names or AI-invented imagery (real photos only: `.claude/rules/real-images-only.md`).
- Never publish, post or change anything for the client during a diagnostic. Changes are a separate, approved engagement.
