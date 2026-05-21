# Apify Live Intelligence Pass

## Status

- Date: 2026-05-16
- Command: `npm run --silent marketing-agency:apify-intel`
- Output path used during verification: `/tmp/restoreassist-apify-intel.json`
- Result: blocked from live social/ad dataset scraping because `APIFY_API_TOKEN` is not configured.

## Real Apify API Evidence

An unauthenticated Apify Actor run was attempted against `apify/google-search-scraper`.

- HTTP status: `402`
- Response type: `x402-payment-required`
- Meaning: live Actor runs require authenticated/payment-capable Apify access.

Public Apify Actor metadata was still retrievable through the Apify API. This proves the API path is working, but it does not provide the requested impression, view, or influencer-post datasets.

Observed public actor signals from the verification run:

| Actor | Public status signal |
| --- | --- |
| `apify/google-search-scraper` | Public metadata returned; more than 87M total runs; latest run timestamp observed on 2026-05-16. |
| `apify/facebook-posts-scraper` | Public metadata returned; more than 29M total runs; latest run timestamp observed on 2026-05-16. |
| `apify/linkedin-post-search-scraper` | Public metadata endpoint did not return useful stats in the unauthenticated probe. |
| `apify/tiktok-scraper` | Public metadata endpoint did not return useful stats in the unauthenticated probe. |

## What Was Added

- `scripts/marketing-agency-apify-intelligence.ts`
- `npm run --silent marketing-agency:apify-intel`
- `lib/marketing-agency/research/apify-intelligence.ts`
- `tests/unit/marketing-agency/apify-intelligence.test.ts`

When `APIFY_API_TOKEN` is configured, the command will:

1. Run selected Apify actors for Google, LinkedIn, Facebook, and TikTok research.
2. Normalize actor results into comparable creative records.
3. Rank records by:
   - highest impressions
   - highest views
   - longest watch-time or duration signal
   - highest engagement
4. Map records into governed signal, risk, approval, and opportunity objects.
5. Persist governed signals and opportunities only when `MARKETING_AGENCY_SIGNAL_ORGANIZATION_ID` is configured.
6. Generate deterministic design-team recommendations from those ranked records.

## Design Agents Review

Because live impression/view datasets are not available without the token, the design agents did not claim a highest-impression or longest-view winner. The current review status is:

| Agent | Finding |
| --- | --- |
| Senior Creative Director | Wait for real Apify records before declaring a winning influencer hook. Keep the existing 15-second LinkedIn and Facebook cuts as test controls. |
| Performance Design Lead | The new ranking pipeline is correct: sort by impressions, views, watch signals, and engagement separately because each answers a different creative question. |
| Video Editor | Once real records are available, extract only structure: first frame, pacing, proof beat, caption density, and CTA timing. Do not copy competitor creative. |
| Brand Guardian | Do not import influencer claims, testimonials, or before/after language unless RestoreAssist has matching evidence and usage rights. |
| Senior Project Manager | Next hard gate is credentialed Apify execution, then board review of the ranked records before storyboard edits are marked client-ready. |

## Interim Current-Market Ideas

These are current, web-verified creative ideas to keep using until the Apify dataset is available:

- Keep the 15-second LinkedIn owner cut because LinkedIn guidance and recent B2B video research favour short, captioned, mobile-friendly videos for feed performance.
- Keep expert/operator credibility in LinkedIn cuts because LinkedIn's B2B video research reports stronger dwell-time signals when videos include expert speakers, credentials, human-centred framing, conversational tone, and brand cues.
- Keep Meta/Facebook cuts vertical and problem-first because recent short-form ad analysis keeps pointing to the first three seconds as the decisive hook window.
- Treat comments, saves, and shares as separate design signals once Apify returns records. High views alone can mean broad delivery, not buying intent.
- Require a product screenshot or sample report proof beat before any final render is marked client-ready.

## Required Next Step

Set `APIFY_API_TOKEN` in `.env.local`, then run:

```bash
npm run --silent marketing-agency:apify-intel > /tmp/restoreassist-apify-intel.json
```

To persist governed signals, also set `MARKETING_AGENCY_SIGNAL_ORGANIZATION_ID` and optionally `MARKETING_AGENCY_SIGNAL_CAMPAIGN_ID`. Without the organisation ID, the command remains JSON-only and reports persistence as skipped.

Only after that file contains completed actor runs and ranked governed records should the team update the video scripts based on highest impressions, longest views, or influencer analytics.

## Source Links

- Apify JavaScript client docs: `https://docs.apify.com/api/client/js/docs/getting-started`
- Apify run Actor and retrieve data docs: `https://docs.apify.com/academy/api/run-actor-and-retrieve-data-via-api`
- LinkedIn video ad tips: `https://business.linkedin.com/advertise/ads/sponsored-content/video-ads/tips`
- LinkedIn Art and Science of Video: `https://business.linkedin.com/content/dam/business/marketing-solutions/global/en_US/site/pdf/wp/2025/the-art-and-science-of-video.pdf`
- Meta video ads format page: `https://www.facebook.com/business/ads/video-ad-format`
- Meta Reels ads page: `https://www.facebook.com/business/ads/facebook-instagram-reels-ads`
- SaaS Facebook video ad analysis: `https://aimers.io/blog/facebook-video-ads-examples`
