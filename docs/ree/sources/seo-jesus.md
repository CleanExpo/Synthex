# SEO Jesus (Stewart Vickers) — methods, contradictions and what REE adopts

Source ledger for [`../REE-SPEC.md`](../REE-SPEC.md) §7. Channel: [youtube.com/@seojesus](https://www.youtube.com/@seojesus).

**Corpus.** 180 videos were selected: the newest 125 plus older search, AI and agency topics. All 180 public transcripts were processed in full on 16/10/2026: 578,618 words, read in chunks. No members-only material was accessed.

**Evidence tags:**

- His explanations, numbers and case stories are practitioner leads: `[UNCONFIRMED]`.
- Google, Bing and vendor documentation the coordinator re-opened on 16/10/2026 is `[VERIFIED]`.
- Synthex design decisions are `[INFERENCE]`.

## Worldview

`[UNCONFIRMED]`:

- **Who he is.** An SEO agency owner, affiliate, speaker and prolific experimenter. He values cash flow, high-ticket local services, cheap bets and investing in what wins. "AI cannot fix a roof" is why he keeps returning to real service businesses.
- **How AI search works, in his model.** Two channels: what the model has learned about a brand, and live retrieval. Brands become legible through repeated associations: services, places, comparisons, videos, communities. He tests the consumer interface because API answers differ.
- **How his focus shifted:**
  - **2024:** Google first; AI search not yet urgent.
  - **2025:** Reddit, YouTube, PR and AI recommendations join up; conversions over raw traffic. "SEO in 2026 is 2010 again" means exploitable simplicity, not compliance.
  - **2026:** Claude Code becomes his operating layer for site batches, client workflows and search-data agents.
- **He publishes his failures.** He reports agent breakdowns ([Claude Code Broke My $100k/Month Agency](https://youtu.be/65C3Ur6Jxvo)), weak avatar economics ([208 videos, honest numbers](https://youtu.be/FnAQlmdSQxg)) and exploits that decay within hours.

## Methods REE can use

Each method below is a safe reconstruction of what he demonstrates. **S** = SAFE, **C** = CAUTION.

| #   | Method                                                                                                                                                                                                                         | Class | REE atom / role                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | -------------------------------------- |
| 1   | Commercial keyword selection: buyer intent, CPC and margin; serve the intent the business can actually satisfy                                                                                                                 | S     | Analyst                                |
| 2   | **Search Console opportunity agent**: export queries → cluster by intent → separate synonyms from a missing service → reviewed brief → publish → measure clicks _and_ qualified leads ([source](https://youtu.be/hVEj3DzeuTQ)) | S     | Collector → Analyst → Editor; A06, A08 |
| 3   | On-page coverage of real customer questions with original evidence; tool scores are diagnostics                                                                                                                                | S     | Editor; A08                            |
| 4   | Fixed AI prompt panel by service, locality and buying stage; record engine, interface, time and country; mention ≠ citation ≠ referral                                                                                         | C     | A10                                    |
| 5   | Update response: dated baseline → official notice → segment by page, query, device, country → check indexing, releases and logs → targeted reversible fix                                                                      | S     | Collector (Sentinel) + Analyst         |
| 6   | Conditional-GET check: a valid unchanged page returns 304; a changed one returns 200                                                                                                                                           | S     | A04/A05                                |
| 7   | Crawler/WAF diagnosis: correlate verified crawler identities with 403s; narrowest justified exception, human-approved ([source](https://youtu.be/Fx_ir8W2_bg))                                                                 | C     | A04                                    |
| 8   | Reporting resilience: keep first-party GSC data; paginate properly; treat a vendor outage as missing data, not a ranking loss                                                                                                  | S     | Collector; evidence states             |
| 9   | Digital PR from a real development or study, with an approved expert quote; syndication is distribution, not endorsement                                                                                                       | S     | A11 (later)                            |
| 10  | Reddit: answer existing customer questions openly, from an accountable identity, within community rules                                                                                                                        | C     | Later                                  |
| 11  | Claude Code discovery before building: map inputs, APIs, triggers and exceptions; separate deterministic work from judgement; stage reversibly                                                                                 | S     | How REE itself is built                |
| 12  | Agent operating pattern: route by complexity; compact context; bounded retries with escalation; deterministic API code behind one integration layer; idempotent jobs only                                                      | S     | §9 and §10 of the spec                 |
| 13  | Microsoft Audience Ads audit: screenshot settings, matched pre/post periods, one reversible change at a time                                                                                                                   | C     | Paid search (deferred)                 |

## His claims checked

| Claim                                                                      | Verdict                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "#1 in 7 hours with a $12 domain"                                          | Not durable: his own follow-up describes it falling to #2. Google says its exact-match-domain system treats domain words as "one of many factors" `[VERIFIED: ranking-systems guide]`                                                          |
| "This Claude Code SEO agent DOUBLED my traffic in days"                    | The narrated metric was impressions (about 300 → 700–750), not clicks or leads `[UNCONFIRMED]`                                                                                                                                                 |
| "One prompt" built a fully optimised site                                  | Depends on prior SOPs, credentials and orchestration; he narrates about 440k tokens and further stages `[UNCONFIRMED]`                                                                                                                         |
| AI-built sites fail because Googlebot can't read JavaScript                | Contradicted as a blanket claim: "Google Search runs JavaScript with an evergreen version of Chromium" `[VERIFIED: JavaScript SEO basics]`. Render and form defects remain real                                                                |
| Cloudflare "blocks Googlebot" for every site; rankings die by 15 September | Blanket and deadline unverified. Cloudflare's presets separate "Search" crawlers from training and agent use `[VERIFIED: Cloudflare block-AI-bots doc]`. The underlying risk, a WAF serving 403s to verified crawlers, is real and is atom A04 |
| GSC API returns 50,000 rows per query                                      | Contradicted: requests page through results 25,000 rows at a time `[VERIFIED: GSC API all-your-data doc]`                                                                                                                                      |
| AI Overviews cut clicks                                                    | Direction supported: Ahrefs reports "AI Overviews Reduce Clicks by 58%" (observational, position one) `[VERIFIED: Ahrefs study]`                                                                                                               |
| 20–30 listicles or mentions secure AI inclusion                            | Threshold unverified; the Ahrefs data is correlational in established brands `[VERIFIED study / UNCONFIRMED threshold]`                                                                                                                        |
| "Resurrection" of old PR caused AI Overview citations                      | Causation unverified, by his own account                                                                                                                                                                                                       |
| Parasite "loophole", $100/day                                              | Contradicted as a durable business: he reports the pages decaying within hours                                                                                                                                                                 |
| iGaming domain "inherits DR92"; canonical-domain cohort                    | His own later video corrects the inheritance and reports a cohort falling 45 → 1 → 0                                                                                                                                                           |
| 208 avatar videos for about $3,000                                         | Most videos under 50 views: a useful negative result for volume-over-quality                                                                                                                                                                   |

## Risk register: faithfully recorded, never executed

Policy references: Google [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) (updated 28/08/2026) and the Maps [contribution policy](https://support.google.com/contributionpolicy/answer/7400114). Legitimate third-party publishing, syndication, domain purchases, affiliate work and AI assistance are **not** spam in themselves. Purpose, deception and execution decide.

| #   | Method he shows                                                                                                     | Why REE refuses it                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| R1  | Mass offer pages on a trusted host (the Apps Script "parasite") with geo-routing and differing crawler/user content | Scaled content, user-generated spam, cloaking and sneaky redirects where those elements occur                      |
| R2  | Press-release and publisher placements disguising affiliate destinations                                            | Site reputation abuse, sneaky redirects, link spam, depending on execution                                         |
| R3  | Automated tiered backlinks, PBNs, link swaps, plugin link networks                                                  | Link spam. A second tier does not cure intent                                                                      |
| R4  | Auction and expired domains repurposed for their links; canonical churn across burner domains                       | Expired-domain abuse and policy circumvention where history is repurposed to manipulate                            |
| R5  | Listicles that insert the client among invented "independent" recommendations                                       | Scaled fabricated consensus. Honest, disclosed comparisons remain fine                                             |
| R6  | Click-bombs, CTR bots, paid searches, autosuggest inflation                                                         | Machine-generated traffic and artificial promotion                                                                 |
| R7  | Reddit astroturfing with bought aged accounts and seeded comments                                                   | User-generated spam and link schemes                                                                               |
| R8  | Bought reviews and simulated directions or calls                                                                    | Maps fake engagement. Synthex also forbids artificial profiles                                                     |
| R9  | Portfolios of near-identical one-page sites                                                                         | Doorway and scaled content abuse                                                                                   |
| R10 | AI-invented first-person "testing" experience                                                                       | Contradicts Google's people-first guidance on invented creators and credentials `[VERIFIED: helpful-content page]` |
| R11 | Fraudulent DMCA attacks on competitors (reported in iGaming, not shown as his practice)                             | Deceptive external abuse; legitimate notices go to humans                                                          |

## What REE adopts

`[INFERENCE]`:

1. **The tempo.** Cheap, fast, reversible experiments, killed when their window expires. His decaying exploits are the evidence for REE's "keep only what survives replication" rule.
2. **The GSC opportunity agent** as the Analyst's first real job: intent gaps from first-party data, reviewed briefs, measured by leads as well as impressions.
3. **Agent operations done right.** Discovery before building; deterministic API code; bounded retries; escalation; idempotency. These are his lessons from "Claude Code broke my agency", built into REE's Collector and Executor.
4. **Alerting on infrastructure, not just algorithms.** CDN 403s on crawlers, conditional-GET health and rank-tracker breakage feed atoms A04/A05 and the evidence states.
5. **Honest numbers.** Negative and inconclusive results are kept.

REE rejects R1–R11 outright, and treats every headline speed or income claim as unproven until a controlled, durable result exists.
