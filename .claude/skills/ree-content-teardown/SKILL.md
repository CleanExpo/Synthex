---
name: ree-content-teardown
description: >-
  Operator procedure for reverse-engineering videos, posts, pages and ads
  lawfully: a measurable teardown schema (identity and rights, evidence states,
  hook, structure, proof, comments, performance, hypothesis), permitted
  collection routes, and the sampling rules that stop one viral post becoming a
  "rule". Use when studying competitor or own content to design a test.
  IDE-only: not product-invocable.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: action-skill
  triggers:
    - content teardown
    - reverse engineer video
    - reverse engineer post
    - why did this video work
  requires:
    - ree-diagnostic
---

# REE Content Teardown — operator procedure

Spec: `docs/ree/REE-SPEC.md` §6 (Capture → Decompose → Diff → Hypothesise). A teardown produces **hypotheses**, never proof; only a pre-registered test with a control confirms anything.

## Sampling rules

- At least **ten eligible assets** per niche × format × time window before calling anything "top-performing"; compare at similar age and audience size.
- Always include **matched non-winners**. Public view counts identify candidates, not causes.
- Use same-age view velocity and within-channel medians if permitted; never invent a single "viral score".
- Retention, three-second hold, CTR, locality and sales come only from authorised owner analytics. Never infer them from public counters.
- A second reviewer codes a sample for agreement. Keep failed and inconclusive results.

## Schema (one row per asset; unknown stays null, never 0)

| Group                | Fields                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and rights  | tenant; platform and asset ID; URL; creator; publish time and timezone; geography evidence; format; organic/paid/unknown; licence or consent; collection route; retention deadline                                                    |
| Evidence             | per field: evidence state (OBSERVED, UNAVAILABLE, UNAUTHORISED, UNSUPPORTED, STALE, PARTIAL); source; collection version; missing reason                                                                                              |
| Hook and package     | shortest necessary hook excerpt; first frame; promise at 0–1 s and 1–3 s; time to proof; title/thumbnail match; pattern (curiosity, utility, transformation)                                                                          |
| Structure and pacing | timecoded beats; problem → diagnosis → method → proof → CTA; runtime or word count; cuts per 10 s; first payoff; dead time; caption coverage; on-screen text readability                                                              |
| Proof and conversion | named expert; original evidence; dates and measurements; honest before/after; limitations; offer; CTA time and place; landing-page match; form friction                                                                               |
| Comments             | sample frame and sort; sampled vs total; counts of questions, praise, objections, scepticism, purchase intent, spam; no demographic or sensitive inference; missing comments ≠ positive                                               |
| Performance          | public counters with definitions and asset age; authorised reach/retention/saves/shares; paid distribution; own-channel enquiries and bookings                                                                                        |
| Hypothesis           | reusable principle; matched winner/non-winner IDs; confounds (including Google updates); intervention and control; primary metric; smallest useful effect; cost ceiling; window; keep/inconclusive/stop rule; replication requirement |

## Permitted collection routes (check current terms before each use)

- **YouTube Data API:** public metadata and statistics via `videos.list`; comments via their own API; retention/CTR need owner-authorised Analytics. Caption listing does not return competitor transcript text; do not assume download rights. 2026 policy changes gate derived metrics, sentiment and extended storage behind the required approval.
- **Meta Ad Library:** public interface for active Australian commercial creatives (the API covers political/issue ads globally and EU/UK delivery). Ad longevity is a hypothesis signal, not ROAS.
- **TikTok:** the Research API excludes commercial users; Creative Center Top Ads are advertiser-authorised and threshold-selected (selection bias), and its retention chart is indexed 0–100, not raw retention.
- **LinkedIn:** no unauthorised crawlers or automation; use approved APIs for granted organisations or client exports.
- **Websites and RSS:** manual review or permitted fetches only; public does not mean free to republish or train on. Public personal information is still protected (OAIC): minimise and redact.
- Never bypass logins, CAPTCHAs or rate limits.

## Output

A teardown sheet (schema above) plus one page: the three strongest recurring differences between winners and matched non-winners, each turned into a pre-registered test for **our own** real content (real job photos and footage only). Promote a pattern to a playbook atom only after independent replication.
