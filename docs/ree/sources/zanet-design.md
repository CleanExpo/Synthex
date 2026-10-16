# Zanet Design — methods, corrections and what REE adopts

Source ledger for [`../REE-SPEC.md`](../REE-SPEC.md) §7. Channel: [youtube.com/@ZanetDesign](https://www.youtube.com/@ZanetDesign).

**Corpus.** 184 videos were selected: the newest 170 plus every video over 30 minutes. 146 public transcripts were processed in full on 16/10/2026: 457,620 words, read in chunks. The other 38 were unplayable, most likely members-only, and were not accessed.

**Evidence tags:**

- Zanet's explanations, numbers and case stories are practitioner leads: `[UNCONFIRMED]`.
- Google documentation the coordinator re-opened on 16/10/2026 is `[VERIFIED]`.
- Synthex design decisions are `[INFERENCE]`.

The video publication dates were not exposed, and a year in a title is not a date.

## Worldview

Zane is a Bournemouth web designer working since 1999, by his own account. His governing question: **can Google and a new customer recognise, trust and contact the same real business everywhere?** `[UNCONFIRMED]`

- **Google as a suspicious visitor.** It keeps coming back while it finds something new and useful. When a site goes quiet it visits less ("web graveyard"). [What Google Knows About Your Business](https://youtu.be/pBmT8wOfgHs)
- **The profile as the hub of a wheel.** The website, socials, booking, reviews and citations must all corroborate it. Visibility gets someone to the door; speed, proof and clear answers win the enquiry.
- **Owners stay in control.** Set-and-forget profiles, green completion circles, review counts on their own, and agency guarantees all draw his criticism.
- **Durability over tricks.** Copying the #1 competitor misses the "200 other things" it does well. [He Copied His Competitor on Google Maps and Lost Everything](https://youtu.be/LCxy3ggNJTg); [Why Your Google Maps Ranking Fix Won't Last](https://youtu.be/2H8_CiKMYxE) (members-only).
- **He revises his advice openly.** He retracted the ranking value of keyword-loaded review replies. [7 Breakthroughs That Finally Got My Business Seen on Google Maps](https://youtu.be/twvwotqOJOE)

## Named frameworks `[UNCONFIRMED]`

| Framework                           | What it is                                                                                                  | Source                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Google Maps health path             | A diagnostic journey: consistency → the site through a new visitor's eyes → what Google's AI says about you | [These 3 Fixes Stop It Fast](https://youtu.be/vYb_LlKwChA)                   |
| Mirror / trust triangle             | Align profile and website; supply genuine proof; beat the _next_ competitor rather than copying everything  | [The SIMPLE Way To Rank #1 on Google Maps](https://youtu.be/py0CuZHNffs)     |
| Five-stage system                   | Audit → growth engine → trust accelerator → tracking → staying on top                                       | [The EXACT System To Outrank Competitors](https://youtu.be/JwOgGPo53cQ)      |
| TRUST                               | Tidy information · Reviews · Understanding customers · Show evidence · Track outcomes                       | [Are You Losing Customer Trust Because of AI?](https://youtu.be/B2xXyTTwI7o) |
| RAPID                               | Register Google's understanding · Align with expectations · Plugins/speed · Insights · Deal with customers  | [Get a RAPID start](https://youtu.be/5HNUgNg_fX0)                            |
| "4 enemies", "500 profiles checked" | Not verifiable: both videos are members-only                                                                | [The 4 Enemies](https://youtu.be/w_RvI0zNo-s)                                |

## His methods, policy-filtered

The class reflects the method as REE implements it. **S** = SAFE, **C** = CAUTION. A PROHIBITED variant is named where one exists.

| #   | Method                                                                                                     | Class                        | REE atom   | Policy note                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Find and claim the real listing; never duplicate                                                           | S                            | A02        | Artificial or online-only listings prohibited                                                                                                                                                       |
| 2   | Closest specific primary category; additional categories only where the operation and website support them | S, C on changes              | A02        | Editing categories can trigger re-verification `[VERIFIED: support.google.com/business/answer/7249669]`                                                                                             |
| 3   | Real services in customer language, matched to website pages                                               | S                            | A02, A08   | No invented offerings or keyword padding                                                                                                                                                            |
| 4   | Products: real goods only                                                                                  | C                            | A02        | His "sell services as products" is contradicted: the Product Editor is "suitable" for "a local store which sells physical goods" `[VERIFIED: 9124203]`                                              |
| 5   | Service areas: real ones only                                                                              | S                            | A02        | "Up to 20 service areas"; overall area "shouldn't be more than about 2 hours" `[VERIFIED: 9157481]`. Adding towns does not move the business                                                        |
| 6   | Hours, phone, booking and messaging tested on mobile                                                       | S                            | A02, A06   | Fabricated availability prohibited                                                                                                                                                                  |
| 7   | Daily profile habit: notifications, edits, reviews, broken links                                           | S                            | A01, A02   | Automation needs API consent and must never auto-revert Google's edits `[VERIFIED: GBP API policy]`                                                                                                 |
| 8   | Posts from real questions, jobs and offers                                                                 | S                            | A08        | His "posts expire in 7 days" is outdated: "Posts older than 6 months are archived unless a date range is set" `[VERIFIED: 7342169]`                                                                 |
| 9   | Real photos and video of team, premises and work; no stock, no AI images                                   | S                            | A08        | Matches `real-images-only`. Public videos: up to 30 s, 75 MB, 720p+ `[VERIFIED: 6103862]`                                                                                                           |
| 10  | Review invitations after real jobs                                                                         | S, **only after correction** | A07        | His suggested keywords, happiest-customer selection and staff quotas are **PROHIBITED**. Google: merchants should not "request that specific content be included" `[VERIFIED: contribution policy]` |
| 11  | Specific, courteous review replies                                                                         | S                            | A07        | Not SEO text; his own retraction applies                                                                                                                                                            |
| 12  | Recover missing reviews: investigate before acting                                                         | C                            | A07        | No guaranteed restoration                                                                                                                                                                           |
| 13  | Report fake reviews with evidence                                                                          | C                            | —          | No doxxing; a blank avatar proves nothing                                                                                                                                                           |
| 14  | Suspension: reason-specific evidence, one coherent appeal                                                  | C, human-led                 | —          | No replacement profile                                                                                                                                                                              |
| 15  | Video verification: plan a continuous route showing signage, tools and management access                   | S, human capture             | —          | "An unedited, unique, and complete recording with no breaks" `[VERIFIED: 14271705]`                                                                                                                 |
| 16  | Duplicates and moves: pick the canonical profile, merge through Google                                     | C                            | —          | "replies to reviews may be lost" on merge `[VERIFIED: 12756178]`                                                                                                                                    |
| 17  | Mirror the website: same identity, hours, services, areas, contact routes                                  | S                            | A02        | Core REE "truth before tactics" rule                                                                                                                                                                |
| 18  | Cold mobile test of speed and findability by a first-time visitor                                          | S                            | A05, A06   | His "3 seconds" is a heuristic, not a Maps ranking threshold                                                                                                                                        |
| 19  | Research real customer questions; answer with expertise                                                    | S                            | A08        | Scaled doorway pages prohibited; Q&A API discontinued `[VERIFIED: Q&A changelog]`                                                                                                                   |
| 20  | Ask AI Mode about the business; follow the cited sources; fix wrong sources                                | S                            | A03        | Pages must be indexed and snippet-eligible `[VERIFIED: ai-features]`                                                                                                                                |
| 21  | Geo-grid heat maps with fixed settings                                                                     | C                            | A09        | A red grid is not proof of a penalty                                                                                                                                                                |
| 22  | Earn corroboration: Bing Places, trade bodies, suppliers                                                   | S                            | A02, A11   | Bulk citation or PBN packages prohibited                                                                                                                                                            |
| 23  | Link GBP to GA4                                                                                            | S                            | A06        | The link is real; his "15 vs 6 months" history claim is unverified                                                                                                                                  |
| 24  | Study the next stronger competitor and a harder nearby market                                              | C                            | Diff stage | Hypotheses only; matched non-winners required (spec §6)                                                                                                                                             |
| 25  | Owner keeps ownership; delegate the minimum                                                                | S                            | §13        | Keyword-only renaming is a naming-rule breach                                                                                                                                                       |
| 26  | Profile deletion                                                                                           | C, never by an agent         | —          | Not a way to erase legitimate criticism                                                                                                                                                             |

**Demonstrations REE rejects outright:**

- Claiming a fictional place to show the system is gameable. [It sucks, but you can claim ANYTHING On Google Maps](https://youtu.be/-Jo2y61os6M)
- Anything that suppresses genuine criticism.

## Claim checks

| Claim                                                              | Verdict                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site:` shows what Google has indexed                              | Partly. Google: a URL "can show up in search results for site: queries… however it's not guaranteed" `[VERIFIED: site operator doc]`. Use URL Inspection; never infer the last crawl from a `site:` result                       |
| Gemini deleted 240m reviews and closed 900,000 accounts            | Counts supported, mechanism overstated. Google blocked or removed "over 240 million" reviews in 2024 and placed "posting restrictions on more than 900,000 accounts" `[VERIFIED: blog.google, 2025]`. Restrictions, not closures |
| Local ranking is relevance, distance and prominence ("popularity") | Supported `[VERIFIED: 7091]`. His numerical weights, "200+ factors" and "90–97% of owners" are unsupported                                                                                                                       |
| 5,000% visibility gain; "checked 500 profiles"                     | `[UNCONFIRMED]`: no metric, denominator or control; the second video is members-only                                                                                                                                             |
| ~60% of searches are zero-click, and AI "boosts calls"             | First half is older US/EU data (2024); the second half is unproven `[UNCONFIRMED]`                                                                                                                                               |
| Ten reviews as a breakthrough; 4.2–4.6 stars beats 5.0             | Practical targets, not Google thresholds `[UNCONFIRMED]`                                                                                                                                                                         |

## What REE adopts

`[INFERENCE]`:

1. **Diagnose what the engines already believe before changing anything.** REE Capture and atom A03.
2. **Truth and consistency across profile, website and corroborating sources.** Atom A02, the Collector's first capability.
3. **Real proof of real work** in photos, posts and pages. Atom A08, bound by `real-images-only`.
4. **Measure, maintain and revise.** The decay watch and the keep / inconclusive / stop outcomes.
5. **His own corrections take priority over his older advice.** Review replies, post expiry and products.

What REE adds that he does not provide:

- controls and matched non-winners;
- variance-sized windows;
- payload-bound approvals;
- the hard ban on asking for review content.
