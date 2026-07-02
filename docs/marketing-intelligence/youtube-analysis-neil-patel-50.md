# YouTube Analysis — Neil Patel (last 50 relevant videos)

> Status: 🟡 `DATA_REQUIRED` — no video data has been pulled. Pulling 50 transcripts reliably
> requires the YouTube Data API (see [youtube-channel-source-list.md](youtube-channel-source-list.md)).
> **Nothing below is fabricated.** This is the extraction template Agent 2 fills once data exists.
> All Neil Patel commentary is classified 💬 `OPINION_SOURCE` until cross-verified by Agent 3.

## Why this is not filled in

Inventing video titles, dates, view counts, or "ranking claims Neil made" would violate the
prime hard rule (*do not fabricate data*). Influencer SEO content is also the **lowest-trust** input
in this system (see the assumption challenges in
[agent-debate-assumption-challenges.md](agent-debate-assumption-challenges.md)) — it must never be
used to justify a site change on its own.

## Extraction template (one block per video)

```yaml
- video_id: <id>
  title: <title>
  published_at: <YYYY-MM-DD>
  url: https://www.youtube.com/watch?v=<id>
  transcript_available: true|false
  claims:
    - claim: "<the specific SEO/AEO/GEO claim>"
      timestamp: "<mm:ss>"
      claim_type: ranking | content | aeo_geo | ai_search | algorithm | tooling | metric
      bucket: evergreen | 2026-specific | speculative | unsupported | tactical | strategic | technical | content | local | ai-search
      tools_mentioned: []
      metrics_mentioned: []          # capture verbatim; never treat as our data
      verification_status: UNVERIFIED_CLAIM   # Agent 3 upgrades this
```

## Bucketing rubric (how Agent 2 sorts each claim)

| Bucket | Definition |
|--------|-----------|
| `evergreen` | Holds across years (e.g. "match search intent") |
| `2026-specific` | Tied to a current feature/update (AI Overviews, a named core update) |
| `speculative` | A prediction about the future of search |
| `unsupported` | Asserted with no evidence, contradicts documentation |
| `tactical` | A specific do-this action |
| `strategic` | A direction/priority, not an action |
| `technical` | Crawl/index/schema/CWV |
| `content` | Content quality/structure |
| `local` | Local pack / GBP / service-area |
| `ai-search` | AI Overviews / answer-engine citation |

## Required handoff to Agent 3

Every extracted claim **must** be cross-checked against ≥4 sources before it can influence a site
recommendation. The claim flows into
[claim-verification-ledger.json](claim-verification-ledger.json) and is gated by the confidence
rules in [verified-ranking-claims.md](verified-ranking-claims.md).

## Suitability caveat (do not skip)

Neil Patel's audience skews US B2B/e-commerce. The portfolio is **Australian service-area
businesses** (restoration, cleaning, training). Tactics must be re-tested for AU local search,
service-area-business (no storefront) constraints, and AU spelling — see the assumption challenges file.
