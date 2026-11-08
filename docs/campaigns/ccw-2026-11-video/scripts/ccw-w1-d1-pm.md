# ccw-w1-d1-pm: A quiet forecast is not a dry season

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Monday 16/11/2026, 17:30 AEST                                                                                                                         |
| Funnel stage      | awareness                                                                                                                                             |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                             |
| Call to action    | See the drying range                                                                                                                                  |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w1-d1-pm |
| Calendar slot key | 2026-11-16-ccw-video-2                                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 73 words, 30 seconds.

1. (0 to 3 s) Forecasters expect five to eight named cyclones this season.
2. (3 to 7 s) The phones still ring after every storm.
3. (7 to 11 s) The long-term average is 11, so this season looks quiet on paper.
4. (11 to 15 s) Storms, flash flooding and burst pipes still bring water jobs.
5. (15 to 19 s) Quiet does not mean dry.
6. (19 to 23 s) So be ready for the work, not the forecast.
7. (23 to 26.5 s) Check extraction tools and air movers, and load the truck.
8. (26.5 to 30 s) See the drying range at CCW. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words             | Shot                                                                                                                                          | Source                                                                                                                                                                     |
| --- | ---------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Forecasters expect"      | Margot to camera in a bright CCW-style warehouse aisle, morning light                                                                         | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                      |
| 2   | 3 to 7     | "The phones still ring"   | Water Claw Large extracting from a wet living-room carpet in daylight, slow push-in                                                           | `generateImage` grounded on `water-damage-restoration/ccw-waterclaw-large-deluxe`, then `submitGenerativeVideo` image-to-video                                             |
| 3   | 7 to 11    | "long-term average is 11" | Whiteboard in a bright workshop reads "5 to 8 storms, average 11" behind a low-profile air mover (text composited in the edit, not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 4   | 11 to 15   | "flash flooding"          | Stryker extraction wand drawn along the edge of a wet hallway carpet, daylight from the doorway                                               | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-extraction-wand-stryker`, then `submitGenerativeVideo` image-to-video                                    |
| 5   | 15 to 19   | "Quiet does not mean dry" | Water Claw Large laid out on a clean workshop bench, morning sun through the roller door                                                      | `generateImage` grounded on `water-damage-restoration/ccw-waterclaw-large-deluxe`, then `submitGenerativeVideo` image-to-video                                             |
| 6   | 19 to 23   | "ready for the work"      | Low-profile air movers set along a bright, dry living-room wall                                                                               | `generateImage` grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then `submitGenerativeVideo` image-to-video                                        |
| 7   | 23 to 26.5 | "load the truck"          | Stryker wand and gear racked in an open van bay, bright daylight, ready to go                                                                 | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-extraction-wand-stryker`, then `submitGenerativeVideo` image-to-video                                    |
| 8   | 26.5 to 30 | "at CCW"                  | Margot beside the drying range; CCW logo composited on the wall                                                                               | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                               |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: "5 to 8 storms, average 11" in the world (whiteboard), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Forecasters expect 5 to 8 named storms this season against a long-term average of 11 (ECMWF modelling, via ABC News). Storms, flash flooding and burst pipes still bring water jobs. Be ready for the work, not the forecast. The drying range: link in bio.

## Claims and sources

| Claim                                                                                                       | Source                                                                                                              | Status              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Season runs 01/11 to 30/04; ECMWF modelling points to 5 to 8 named storms against a long-term average of 11 | ABC News, 01/11/2026: https://www.abc.net.au/news/2026-11-01/bom-australia-cyclone-season-predicted-quiet/107329238 | Verified 08/11/2026 |
| Storms, flash flooding and burst pipes still bring water jobs                                               | Calendar row ccw-w1-d1-pm and teardown, gap 1 (01-competitor-teardown.md)                                           | Verified 08/11/2026 |
| Check extraction tools and air movers, load the truck                                                       | General readiness advice, not a standard: `[TOBY TO CONFIRM]`                                                       | Pending Toby        |

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
