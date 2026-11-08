# ccw-w1-d4-am: Not all water is the same

| Field             | Value                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Thursday 12/11/2026, 07:00 AEST                                                                                                       |
| Funnel stage      | awareness                                                                                                                             |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                             |
| Call to action    | Read CCW's guides                                                                                                                     |
| Landing link      | https://ccwonline.com.au/blogs/news?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d4-am |
| Calendar slot key | 2026-11-19-ccw-video-1                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 73 words, 30 seconds.

1. (0 to 3 s) Clean water, grey water and sewage
2. (3 to 7 s) are three different jobs, and each needs its own plan.
3. (7 to 11 s) The water damage standard sorts water into Category 1, 2 and 3.
4. (11 to 15 s) Category 1 is a sanitary source. Category 2 is significantly contaminated.
5. (15 to 19 s) Category 3 is grossly contaminated, such as sewage.
6. (19 to 23 s) Time and temperature can move water from one category to a worse one.
7. (23 to 26.5 s) The category decides the method and the protection.
8. (26.5 to 30 s) Read CCW's guides. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words               | Shot                                                                                                         | Source                                                                                                                                                                    |
| --- | ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Clean water"               | Margot to camera in a bright CCW-style warehouse aisle, morning light                                        | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                     |
| 2   | 3 to 7     | "three different jobs"      | Hydro Shark moisture probe reading a clean carpet in a bright room, slow push-in                             | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video                                        |
| 3   | 7 to 11    | "Category 1, 2 and 3"       | Whiteboard reads "Category 1 / 2 / 3" behind the moisture probe (text composited in the edit, not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 4   | 11 to 15   | "sanitary source"           | Moisture probe held against a clean skirting in daylight, close-up                                           | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video                                        |
| 5   | 15 to 19   | "grossly contaminated"      | Razorback MaxxGuard 550 air scrubber set up in a bright hallway, ready for work                              | `generateImage` grounded on `water-damage-restoration/ccw-razorback-maxxguard-550-cfm-air-scrubber`, then `submitGenerativeVideo` image-to-video                          |
| 6   | 19 to 23   | "Time and temperature"      | Sunlit window and warm room with the moisture probe on a carpet edge                                         | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video                                        |
| 7   | 23 to 26.5 | "method and the protection" | MaxxGuard 550 running in a clean, dry room, the outcome                                                      | `generateImage` grounded on `water-damage-restoration/ccw-razorback-maxxguard-550-cfm-air-scrubber`, then `submitGenerativeVideo` image-to-video                          |
| 8   | 26.5 to 30 | "CCW's guides"              | Margot beside the Razorback range; CCW logo composited on the wall                                           | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                              |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: "Category 1 / 2 / 3" in the world (whiteboard), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Clean water, grey water and sewage are three different jobs. The water damage standard sorts water into Category 1, 2 and 3, and time and temperature can move it to a worse category. The category decides the method and the protection. CCW's guides: link in bio.

## Claims and sources

| Claim                                                                                                                                                                               | Source                                               | Status              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------- |
| Water is sorted into Category 1 (sanitary source), 2 (significant contamination) and 3 (grossly contaminated, e.g. sewage); time and temperature can move water to a worse category | Standards register R33: water damage standard (S500) | Verified 08/11/2026 |
| The category decides the method and the protection                                                                                                                                  | Calendar row ccw-w1-d4-am                            | Verified 08/11/2026 |

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
| S8 No invented claims             | PASS    | All claims sourced                                           |
| S9 AS-IICRC procedure claims      | PASS    | R33 only                                                     |
| S10 AU English, metric, no emoji  | PASS    |                                                              |
| S11 One CTA with UTM link         | PASS    |                                                              |
| S12 CCW brand only                | PASS    | No other brand or competitor named                           |
