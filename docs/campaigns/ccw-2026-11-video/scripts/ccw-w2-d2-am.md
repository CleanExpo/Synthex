# ccw-w2-d2-am: Match prespray to soil, then fibre

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Tuesday 24/11/2026, 07:00 AEST                                                                                                                        |
| Funnel stage      | consideration                                                                                                                                         |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                             |
| Call to action    | See Razorback chemistry                                                                                                                               |
| Landing link      | https://ccwonline.com.au/collections/razorback?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w2-d2-am |
| Calendar slot key | 2026-11-24-ccw-video-1                                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 66 words, 30 seconds.

1. (0 to 3 s) The prespray choice starts with the soil,
2. (3 to 7 s) not the bottle you used last time.
3. (7 to 11 s) Match the prespray to the soil type first, then to the fibre.
4. (11 to 15 s) Enzyme prespray suits protein and organic soil.
5. (15 to 19 s) Every prespray needs the right rinse behind it.
6. (19 to 23 s) CCW carries the prespray chemistry and a 39 litre portable foamer.
7. (23 to 26.5 s) Soil first, then fibre, then the rinse behind it.
8. (26.5 to 30 s) Link below. See Razorback chemistry.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                   | Shot                                                                                        | Source                                                                                                                           |
| --- | ---------- | ------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "The prespray choice starts"    | Margot to camera in a bright CCW-style warehouse aisle, morning light                       | HeyGen avatar from Margot's voice (`heygen-director`)                                                                            |
| 2   | 3 to 7     | "not the bottle you"            | Prespray bottles and containers lined up on a bright shelf, labels facing out, slow push-in | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-solution`, then `submitGenerativeVideo` image-to-video              |
| 3   | 7 to 11    | "Match the prespray to"         | Prespray being applied to a lightly soiled carpet panel in a sunlit room                    | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-solution`, then `submitGenerativeVideo` image-to-video              |
| 4   | 11 to 15   | "Enzyme prespray suits protein" | Close view of carpet fibres and a soil mark at the edge of a doorway, daylight              | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-solution`, then `submitGenerativeVideo` image-to-video              |
| 5   | 15 to 19   | "Every prespray needs the"      | Rinse pass over carpet, clean water lines visible, low angle                                | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-solution`, then `submitGenerativeVideo` image-to-video              |
| 6   | 19 to 23   | "CCW carries the prespray"      | 39 litre High Volume Portable Foamer on a clean floor beside a prespray container, daylight | `generateImage` grounded on `carpet-cleaning/ccw-high-volume-portable-foamer-39ltr`, then `submitGenerativeVideo` image-to-video |
| 7   | 23 to 26.5 | "Soil first, then fibre"        | Bright, even clean carpet in a lounge, the outcome, slow drift                              | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-solution`, then `submitGenerativeVideo` image-to-video              |
| 8   | 26.5 to 30 | "Link below. See Razorback"     | Margot beside the foamer; approved CCW logo file composited on the wall in the edit         | HeyGen avatar from Margot's voice (`heygen-director`)                                                                            |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- No in-world type in this video.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Start with the soil, then the fibre. Enzyme prespray suits protein and organic soil, and every prespray needs the right rinse behind it. Razorback chemistry: link in bio.

## Claims and sources

| Claim                                                                                                            | Source                                                             | Status               |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------- |
| Match prespray to soil type, then fibre; enzyme powder suits protein and organic soil; both need the right rinse | CCW Razorback page: https://ccwonline.com.au/collections/razorback | Verified 08/11/2026  |
| High Volume Portable Foamer is 39 litre                                                                          | Product name in the CCW catalogue reference                        | Verified (name only) |
| CCW carries the prespray chemistry and the foamer                                                                | Calendar row products; stock status `[TOBY TO CONFIRM]`            | Pending Toby         |

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
| S8 No invented claims             | PASS    | Unsourced items marked for Toby                               |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim beyond CCW page wording                    |
| S10 AU English, metric, no emoji  | PASS    |                                                               |
| S11 One CTA with UTM link         | PASS    |                                                               |
| S12 CCW brand only                | PASS    | No other brand or competitor                                  |
