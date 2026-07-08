# CARSI H5 Launch — Source Register

Every factual or operational claim in this campaign maps to a source below. The
machine-readable ledger is `evidence-manifest.json`.

## Verified claim boundaries

- The campaign reflects the Australian Government position: calm, official-source
  led, not fear-based.
- All DAFF status wording is attributed to DAFF and dated to the 5 July 2026
  update; readers are pointed to current DAFF advice.
- What the course teaches is grounded in the live readiness hub's stated 7-module
  pathway and the binding campaign brief.
- IICRC is omitted entirely from this pack to stay clear of the licence-critical
  terminology boundary (no "IICRC Accredited" without "CEC"; no certification
  implication).
- No product is claimed to kill H5N1. Dry fogging / Halo / Halosil / NeoSan are
  only ever described as label-led, SDS-led and legally compliant, and never as a
  substitute for official biosecurity response.
- The only phone number used in marketing is the government hotline
  **1800 675 888**. CARSI enquiries route to the Margot chat on carsi.com.au.

## Sources

- `guardrail-campaign-brief` — CARSI Avian Influenza Readiness 30-day ecosystem
  brief (Do-say / Do-not-say, calm tone, hotline, SOP, dry-fog language). CARSI
  repo: `docs/campaigns/2026-07-04-avian-influenza-readiness-30-day-ecosystem.md`.
- `carsi-h5-hub` — CARSI H5 readiness hub (heading, 7-module pathway, learning
  outcomes, DAFF status wording, hotline): https://carsi.com.au/avian-influenza-readiness
  — live; re-fetched 2026-07-08.
- `carsi-h5-course` — CARSI H5 course page:
  https://carsi.com.au/courses/avian-influenza-awareness-restoration-iaq-facilities
  — **UNCONFIRMED at 2026-07-08 fetch** (returned "Course Not Found"; pre-go-live
  or SPA render). Going live today. **Verify HTTP 200 + real content before
  publishing course-live claims or links.**
- `daff-birdflu-campaign` — Australian Government bird flu campaign:
  https://www.agriculture.gov.au/campaigns/birdflu
- `daff-h5-update` — DAFF H5 bird flu update, 4 July 2026:
  https://www.agriculture.gov.au/about/news/h5-bird-flu-update
- `daff-testing-update` — DAFF H5 bird flu testing update, 4 July 2026:
  https://www.agriculture.gov.au/about/news/h5-bird-flu-testing-update
- `acdc-guidance` — Australian Centre for Disease Control bird flu guidance:
  https://www.cdc.gov.au/diseases/bird-flu-avian-influenza
- `daff-report` — DAFF report suspected bird flu guidance:
  https://www.agriculture.gov.au/biosecurity-trade/pests-diseases-weeds/animal/avian-influenza/report

## Verified assets (Cloudinary)

- `asset-infographic` — Reporting-pathway infographic (SVG), HTTP 200 verified:
  https://res.cloudinary.com/dmaulkthb/image/upload/v1783511574/carsi/infographics/avian-influenza-reporting-pathway.svg
- `asset-hero` — Course hero image (PNG), HTTP 200 verified:
  https://res.cloudinary.com/dmaulkthb/image/upload/v1783511591/carsi/admin-courses/6642e5e7-cf59-4e4c-9cff-a83c2fe5393a.png
- `asset-audio` — Course audio overview (2-voice, ~6 min, MP3), HTTP 200 verified:
  https://res.cloudinary.com/dmaulkthb/video/upload/v1783511771/carsi/course-audio-overview/4edda90b-4276-4ffc-b49f-3000b33cf95a.mp3
- `asset-video` — Narrated video overview — **PENDING** (rendering; URL not yet
  available). Placeholder slot reserved at LI-12 (`mediaPending`).

## Open verification before publish

1. `carsi-h5-course` returns HTTP 200 with real course content.
2. `asset-video` URL confirmed HTTP 200 before scheduling LI-12.
3. Final human review of owned media (blog + 2 emails) per the CARSI review
   checklist.
