# ccw-w1-d4-pm: The pre-filter protects the HEPA

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Thursday 12/11/2026, 17:30 AEST                                                                                                                  |
| Funnel stage      | retention                                                                                                                                        |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See Razorback filters and spares                                                                                                                 |
| Landing link      | https://ccwonline.com.au/collections/razorback?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d4-pm |
| Calendar slot key | 2026-11-19-ccw-video-2                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 69 words, 30 seconds.

1. (0 to 3 s) The cheapest filter in an air scrubber
2. (3 to 7 s) protects the most expensive one.
3. (7 to 11 s) Air scrubber filters are staged.
4. (11 to 15 s) The pre-filter protects the HEPA, and that is its whole job.
5. (15 to 19 s) Run without it, or past its life,
6. (19 to 23 s) and a cheap filter change turns into an expensive one.
7. (23 to 26.5 s) Keep spare pre-filters on the shelf and change them on schedule, before the HEPA pays for it.
8. (26.5 to 30 s) See Razorback filters and spares at CCW.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words         | Shot                                                                                                           | Source                                                                                                                                                                                      |
| --- | ---------- | --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "The cheapest filter" | Margot to camera in a bright CCW-style warehouse aisle, morning light                                          | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                       |
| 2   | 3 to 7     | "most expensive one"  | Razorback MaxxGuard 550 air scrubber on a clean warehouse floor, slow push-in                                  | `generateImage` grounded on `water-damage-restoration/ccw-razorback-maxxguard-550-cfm-air-scrubber`, then `submitGenerativeVideo` image-to-video                                            |
| 3   | 7 to 11    | "filters are staged"  | Pre-filter pack opened on a workshop bench beside the HEPA filter, daylight                                    | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-pre-filter-velo-hepa-20-pack`, then `submitGenerativeVideo` image-to-video                                                |
| 4   | 11 to 15   | "pre-filter protects" | Pre-filter being slid into the front of the air scrubber, close-up                                             | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-pre-filter-velo-hepa-20-pack`, then `submitGenerativeVideo` image-to-video                                                |
| 5   | 15 to 19   | "the HEPA"            | Clean Velo HEPA primary filter held up to window light                                                         | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-velo-hepa-primary-filter-replacement`, then `submitGenerativeVideo` image-to-video                                        |
| 6   | 19 to 23   | "expensive one"       | Whiteboard reads "Pre-filter then HEPA" beside the primary filter (text composited in the edit, not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-dri-eaz-velo-hepa-primary-filter-replacement`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 7   | 23 to 26.5 | "on the shelf"        | Spare pre-filter packs on a bright parts shelf, row of boxes, morning light                                    | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-pre-filter-velo-hepa-20-pack`, then `submitGenerativeVideo` image-to-video                                                |
| 8   | 26.5 to 30 | "at CCW"              | Margot beside the MaxxGuard 550; CCW logo composited on the wall                                               | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                                |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 6: "Pre-filter then HEPA" in the world (whiteboard), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

The cheapest filter in an air scrubber protects the most expensive one. The pre-filter protects the HEPA, so change it on schedule. Razorback filters and spares: link in bio.

## Claims and sources

| Claim                                                                                      | Source                                                                                        | Status              |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------- |
| Air scrubber filters are staged; the pre-filter protects the HEPA                          | CCW Razorback page: https://ccwonline.com.au/collections/razorback; calendar row ccw-w1-d4-pm | Verified 08/11/2026 |
| Running without the pre-filter or past its life turns a cheap change into an expensive one | Calendar row ccw-w1-d4-pm: `[TOBY TO CONFIRM]`                                                | Pending Toby        |
| Keep spare pre-filters and change on schedule                                              | General equipment care: `[TOBY TO CONFIRM]`                                                   | Pending Toby        |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                         |
| --------------------------------- | ------- | ------------------------------------------------------------ |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                       |
| S2 Hook in 2 s                    | PASS    | Row hook opens line 1; no question                           |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                      |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                  |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on the result or the range             |
| S6 Owned references only          | PASS    | Every non-Margot shot names a reference subject from the row |
| S7 Side-by-side equipment check   | PENDING | At render                                                    |
| S8 No invented claims             | PASS    | Unsourced lines marked `[TOBY TO CONFIRM]`                   |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim made                                      |
| S10 AU English, metric, no emoji  | PASS    |                                                              |
| S11 One CTA with UTM link         | PASS    |                                                              |
| S12 CCW brand only                | PASS    | No other brand or competitor named                           |
