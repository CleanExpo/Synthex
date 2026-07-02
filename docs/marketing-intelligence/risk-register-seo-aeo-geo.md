# SEO / AEO / GEO Risk Register

> Status: ✅ `VERIFIED` — these are real, documented failure modes. The `risk_score` column feeds the
> denominator of the Confidence-Adjusted Action Score (math model §12): a high-risk action must clear
> a much higher impact bar before it reaches the top of the backlog.

## How risk gates the system

```
confidence_adjusted_action = (impact · confidence) / max(risk, ε)
```

Any tactic with `risk_score ≥ 0.7` is **blocked from autonomous execution** and routed to a human
gate (see [human-approval-gates.md](human-approval-gates.md)), regardless of impact.

## Register

| ID | Risk | Trigger | Effect | risk_score | Mitigation |
|----|------|---------|--------|-----------:|------------|
| R-SEO-01 | **Thin programmatic suburb pages** | Auto-generating "[service] [suburb]" pages with only the suburb swapped | Helpful-content classifier demotion across the site | 0.85 | Each suburb page needs unique intro + local detail + genuine testimonial (enforced by `local-seo-agent`). Human gate before bulk publish. |
| R-SEO-02 | **Fake freshness edits** | Bumping `dateModified` with trivial changes to chase QDF | Pattern detection; wasted crawl budget; no ranking gain | 0.6 | Only set `dateModified` on *meaningful* updates (decay-score-driven). |
| R-SEO-03 | **Keyword stuffing / over-optimisation** | LLM-written copy repeating the target keyword | Negative Twiddler / spam classifier | 0.7 | Brand-voice + readability gate; keyword density is not a target. |
| R-SEO-04 | **Unnatural link building** | Buying links / link schemes to fix R-A4 sandbox faster | SpamBrain manual-action risk | 0.95 | **Never.** Only earned links (Tier 1–3 in `local-seo-agent`). Hard no-go. |
| R-SEO-05 | **AI mass-content publishing** | Publishing AI drafts without human review | Scaled-content-abuse policy (Mar 2024) | 0.8 | All AI content → `Outcomes/synthex-content/` → human approval gate before live. |
| R-SEO-06 | **Cannibalisation** | Two pages targeting the same query | Both pages suppressed; diluted authority | 0.5 | Keyword→URL map; one target per page (math model §7 catches mismatches). |
| R-AEO-01 | **Over-investing in unproven GEO tactics** | Treating AI-Overview "optimisation" as `CONFIRMED` | Wasted effort on `SPECULATIVE` advice | 0.4 | All GEO actions are `HYPOTHESIS_FOR_TESTING` with kill thresholds. |
| R-AEO-02 | **Schema that misrepresents content** | Adding FAQ/HowTo schema not matching visible content | Structured-data manual action | 0.75 | Schema must mirror on-page content (the `sql-hardener`/`local-seo-geo-veteran` discipline). |
| R-DATA-01 | **Acting on placeholder scores** | Treating a `DATA_REQUIRED` score as a measurement | Wrong prioritisation, wasted spend | 0.9 | `ScoreResult.dataStatus` forces `confidence ≤ 0.1`; backlog hides such items from auto-execution. |
| R-DATA-02 | **Hallucinated metrics in client reports** | Reporting invented traffic/CTR | Trust + compliance failure | 1.0 | Hard no-go. Reports render only real GSC/GBP data or say `DATA_REQUIRED`. |
| R-AU-01 | **US tactics applied blind to AU service-area businesses** | Copying Neil-Patel-style US e-com advice | Irrelevant/ineffective work | 0.5 | AU + service-area-business re-test gate (see assumption challenges). |
| R-YMYL-01 | **Unqualified claims on YMYL pages** | RestoreAssist/CARSI/DR pages making medical/insurance/safety claims without credentials | E-E-A-T demotion; real-world liability | 0.85 | Compliance/legal approval gate per pitch-03 §6 matrix (`content:publish_legal_or_compliance_claim`). |

## Hard no-gos (never autonomous, never at any impact)

- Link buying / PBNs / link schemes (R-SEO-04).
- Reporting any metric not received from a real source (R-DATA-02).
- Publishing legal/medical/insurance/safety claims without human + (if requested) legal sign-off (R-YMYL-01).
- Cloaking, doorway pages, hidden text, or any deceptive technique.
