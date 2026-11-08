# ccw-w1-d5-am: Count units per vehicle

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Friday 13/11/2026, 07:00 AEST                                                                                                                    |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the air movers                                                                                                                               |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d5-am |
| Calendar slot key | 2026-11-20-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 74 words, 30 seconds.

1. (0 to 3 s) The air mover that fits in the van
2. (3 to 7 s) is the one that dries the house.
3. (7 to 11 s) Stackability and footprint decide how many jobs a crew covers in a day.
4. (11 to 15 s) So count units per vehicle, not horsepower.
5. (15 to 19 s) Look at the X-600AC and the X-800 multi drying kit.
6. (19 to 23 s) Check how many of each will load on your van.
7. (23 to 26.5 s) More units on board means more rooms covered on every job.
8. (26.5 to 30 s) See the air movers at CCW. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                | Shot                                                                                                         | Source                                                                                                                                                                                |
| --- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "fits in the van"            | Margot to camera in a bright CCW-style warehouse aisle, morning light                                        | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                 |
| 2   | 3 to 7     | "is the one"                 | X-600AC air movers stacked neatly on a clean warehouse floor, slow push-in                                   | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x600ac-3-4hp-inc-clamp`, then `submitGenerativeVideo` image-to-video                                        |
| 3   | 7 to 11    | "Stackability and footprint" | Stack of X-800 multi drying kit units loaded into an open van bay, bright daylight                           | `generateImage` grounded on `water-damage-restoration/ccw-xpower-air-mover-800-multi-drying-kit-x-800-mdk`, then `submitGenerativeVideo` image-to-video                               |
| 4   | 11 to 15   | "count units per vehicle"    | Whiteboard reads "Units per vehicle" beside a stacked air mover (text composited in the edit, not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-xpower-airmover-x600ac-3-4hp-inc-clamp`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 5   | 15 to 19   | "X-600AC"                    | X-600AC air mover with its clamp, close-up on a workshop bench                                               | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x600ac-3-4hp-inc-clamp`, then `submitGenerativeVideo` image-to-video                                        |
| 6   | 19 to 23   | "X-800 multi drying kit"     | X-800 multi drying kit set out ready to load, morning light                                                  | `generateImage` grounded on `water-damage-restoration/ccw-xpower-air-mover-800-multi-drying-kit-x-800-mdk`, then `submitGenerativeVideo` image-to-video                               |
| 7   | 23 to 26.5 | "rooms covered"              | Dry, bright living room with X-800 units finished and in place, the outcome                                  | `generateImage` grounded on `water-damage-restoration/ccw-xpower-air-mover-800-multi-drying-kit-x-800-mdk`, then `submitGenerativeVideo` image-to-video                               |
| 8   | 26.5 to 30 | "at CCW"                     | Margot beside the air mover line-up; CCW logo composited on the wall                                         | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                          |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 4: "Units per vehicle" in the world (whiteboard), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

The air mover that fits in the van is the one that dries the house. Count units per vehicle, not horsepower. The air movers: link in bio.

## Claims and sources

| Claim                                                                                                           | Source                                                                                         | Status              |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------- |
| Stackability and footprint decide how many jobs a crew covers in a day; count units per vehicle, not horsepower | Calendar row ccw-w1-d5-am; CCW air movers page: https://ccwonline.com.au/collections/airmovers | Verified 08/11/2026 |
| More units on board means more rooms covered per job                                                            | Inference from the row, not a CCW claim: `[TOBY TO CONFIRM]`                                   | Pending Toby        |

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
