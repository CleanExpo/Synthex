# ccw-w2-d5-am: Rotary extraction, explained

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Friday 27/11/2026, 07:00 AEST                                                                                                                    |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Ask CCW which suits you                                                                                                                          |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w2-d5-am |
| Calendar slot key | 2026-11-27-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 65 words, 30 seconds.

1. (0 to 3 s) A rotary extractor scrubs
2. (3 to 7 s) and extracts in one pass.
3. (7 to 11 s) Rotary extraction tools such as the HydraMaster RX20
4. (11 to 15 s) and the cordless Hydro-Force CX-15 agitate while they extract.
5. (15 to 19 s) That is the point of rotary extraction: agitation and pickup together.
6. (19 to 23 s) Which one suits depends on your jobs and your machine.
7. (23 to 26.5 s) Tell CCW the jobs you do and the machine you run.
8. (26.5 to 30 s) Link below. Ask CCW which suits you.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                  | Shot                                                                                       | Source                                                                                                                                            |
| --- | ---------- | ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "A rotary extractor scrubs"    | Margot to camera in a bright CCW-style warehouse aisle, morning light                      | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                             |
| 2   | 3 to 7     | "and extracts in one"          | HydraMaster RX20 NEXTGEN rotary extractor tool on a clean carpet in daylight, slow push-in | `generateImage` grounded on `carpet-cleaning/ccw-hydramaster-rx20-nxg-220v50hg-with-orig-style-head`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "Rotary extraction tools such" | RX20 close on the head, soft window light                                                  | `generateImage` grounded on `carpet-cleaning/ccw-hydramaster-rx20-nxg-220v50hg-with-orig-style-head`, then `submitGenerativeVideo` image-to-video |
| 4   | 11 to 15   | "and the cordless Hydro-Force" | Hydro-Force CX-15 cordless rotary extraction tool on a bright stair carpet                 | `generateImage` grounded on `carpet-cleaning/ccw-hydroforce-cx-15-cordless-rotary-extraction-tool`, then `submitGenerativeVideo` image-to-video   |
| 5   | 15 to 19   | "That is the point"            | CX-15 mid-pass on a sunlit carpet, clean stripe behind it                                  | `generateImage` grounded on `carpet-cleaning/ccw-hydroforce-cx-15-cordless-rotary-extraction-tool`, then `submitGenerativeVideo` image-to-video   |
| 6   | 19 to 23   | "Which one suits depends"      | RX20 working along a hallway carpet, bright light, low angle                               | `generateImage` grounded on `carpet-cleaning/ccw-hydramaster-rx20-nxg-220v50hg-with-orig-style-head`, then `submitGenerativeVideo` image-to-video |
| 7   | 23 to 26.5 | "Tell CCW the jobs"            | Clean, even carpet in a lounge, the outcome, slow drift                                    | `generateImage` grounded on `carpet-cleaning/ccw-hydroforce-cx-15-cordless-rotary-extraction-tool`, then `submitGenerativeVideo` image-to-video   |
| 8   | 26.5 to 30 | "Link below. Ask CCW"          | Margot beside the two tools; approved CCW logo file composited on the wall in the edit     | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                             |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- No in-world type in this video.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

A rotary extractor scrubs and extracts in one pass. The HydraMaster RX20 and the cordless Hydro-Force CX-15 agitate while they extract. Tell CCW the jobs you do and the machine you run, and ask which suits you: link in bio.

## Claims and sources

| Claim                                                                                                          | Source                                                                  | Status                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| Rotary extraction tools such as the HydraMaster RX20 and cordless Hydro-Force CX-15 agitate while they extract | Calendar row message; maker specifications: `[TOBY TO CONFIRM]`         | Pending Toby          |
| CX-15 is cordless; RX20 is a NEXTGEN rotary extractor                                                          | Product names in the CCW catalogue references                           | Verified (names only) |
| Suitability depends on jobs and machine; ask CCW                                                               | Calendar row message and CTA: https://ccwonline.com.au/pages/contact-us | Verified 08/11/2026   |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                          |
| --------------------------------- | ------- | ------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                        |
| S2 Hook in 2 s                    | PASS    | Statement hook from the calendar row, no question             |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                       |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                   |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished result                    |
| S6 Owned references only          | PASS    | Every non-Margot shot names a reference subject from this row |
| S7 Side-by-side equipment check   | PENDING | At render                                                     |
| S8 No invented claims             | PENDING | How the tools work awaits Toby                                |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim beyond CCW page wording                    |
| S10 AU English, metric, no emoji  | PASS    |                                                               |
| S11 One CTA with UTM link         | PASS    |                                                               |
| S12 CCW brand only                | PASS    | No other brand or competitor                                  |
