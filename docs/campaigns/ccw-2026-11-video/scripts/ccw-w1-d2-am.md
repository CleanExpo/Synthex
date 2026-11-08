# ccw-w1-d2-am: Four placed beat two powerful

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Tuesday 10/11/2026, 07:00 AEST                                                                                                                   |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Read the buying guide on the air movers page                                                                                                     |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d2-am |
| Calendar slot key | 2026-11-17-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 70 words, 30 seconds.

1. (0 to 3 s) Four air movers in the right places will beat two big ones
2. (3 to 7 s) aimed at the middle of the room.
3. (7 to 11 s) Evaporation is a surface-area problem.
4. (11 to 15 s) Spread the airflow across the wet area.
5. (15 to 19 s) That is why unit count often matters more than any one unit's rating.
6. (19 to 23 s) Each size covers a different part of the floor.
7. (23 to 26.5 s) Place them along the wet edges.
8. (26.5 to 30 s) Read the buying guide on the air movers page at CCW.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words          | Shot                                                                                                                     | Source                                                                                                                                                                     |
| --- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Four air movers"      | Margot to camera in a bright CCW-style warehouse aisle, morning light                                                    | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                      |
| 2   | 3 to 7     | "aimed at the middle"  | One XPOWER X-400 pointed at the centre of an empty living room, slow push-in                                             | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x400-1-2hp`, then `submitGenerativeVideo` image-to-video                                         |
| 3   | 7 to 11    | "surface-area problem" | Whiteboard reads "Surface area" beside a mini air mover on a workshop bench (text composited in the edit, not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-airmover-mini-p-230at-1-4hp`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 4   | 11 to 15   | "Spread the airflow"   | Four X-400 air movers placed around the edges of a bright room, high angle, slow drift                                   | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x400-1-2hp`, then `submitGenerativeVideo` image-to-video                                         |
| 5   | 15 to 19   | "unit count"           | A row of Velo low-profile air movers along a clean warehouse floor                                                       | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-velo-low-profile-air-mover`, then `submitGenerativeVideo` image-to-video                                 |
| 6   | 19 to 23   | "Each size"            | P-230AT mini air mover tucked into a corner of a bright hallway                                                          | `generateImage` grounded on `water-damage-restoration/ccw-airmover-mini-p-230at-1-4hp`, then `submitGenerativeVideo` image-to-video                                        |
| 7   | 23 to 26.5 | "wet edges"            | Dry, evenly finished carpet in morning sun with air movers placed round the edges, the outcome                           | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x400-1-2hp`, then `submitGenerativeVideo` image-to-video                                         |
| 8   | 26.5 to 30 | "at CCW"               | Margot beside the air mover line-up; CCW logo composited on the wall                                                     | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                               |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: "Surface area" in the world (whiteboard), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Four air movers in the right places will beat two big ones aimed at the middle of the room. Evaporation is a surface-area problem, so spread the airflow across the wet area. The buying guide is on the air movers page: link in bio.

## Claims and sources

| Claim                                                                                                                                                     | Source                                                                                                                                                     | Status              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Four placed air movers beat two big ones aimed at the middle; evaporation is a surface-area problem; unit count often matters more than one unit's rating | Calendar row ccw-w1-d2-am; CCW air movers page: https://ccwonline.com.au/collections/airmovers ("four correctly placed units will beat two powerful ones") | Verified 08/11/2026 |
| Mini, mid-size and low-profile units each cover a different part of the floor; place along the wet edges                                                  | General placement advice, not a standard: `[TOBY TO CONFIRM]`                                                                                              | Pending Toby        |

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
| S9 AS-IICRC procedure claims      | PASS    | No standard cited; placement advice marked for Toby          |
| S10 AU English, metric, no emoji  | PASS    |                                                              |
| S11 One CTA with UTM link         | PASS    |                                                              |
| S12 CCW brand only                | PASS    | No other brand or competitor named                           |
