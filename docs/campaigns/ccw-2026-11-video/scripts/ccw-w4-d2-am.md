# ccw-w4-d2-am: Dry is a reading

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Tuesday 08/12/2026, 07:00 AEST                                                                                                                   |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Ask CCW about moisture detection                                                                                                                 |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w4-d2-am |
| Calendar slot key | 2026-12-08-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 68 words, 30 seconds.

1. (0 to 3 s) Dry is a number on a meter,
2. (3 to 7 s) not a feeling on your hand.
3. (7 to 11 s) Take moisture readings at the start of the job.
4. (11 to 15 s) Take them again on every visit, and record each one.
5. (15 to 19 s) The readings show when the job is finished.
6. (19 to 23 s) They back up your report. CCW stocks the Hydro Shark moisture sensor.
7. (23 to 26.5 s) The air movers run until the meter says dry.
8. (26.5 to 30 s) Ask CCW about moisture detection. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words         | Shot                                                                                                | Source                                                                                                                              |
| --- | ---------- | --------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Dry is a number"     | Margot to camera in a bright CCW-style warehouse aisle, morning light                               | HeyGen avatar from Margot's voice (`heygen-director`)                                                                               |
| 2   | 3 to 7     | "not a feeling"       | Hydro Shark moisture probe held against a skirting board in a bright room, slow push-in             | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video  |
| 3   | 7 to 11    | "moisture readings"   | Close-up of the probe pressed to a wall surface; the reading is a Blender insert, not generated     | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video  |
| 4   | 11 to 15   | "every visit"         | Probe at a second spot on a floor edge, different room corner, daylight                             | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video  |
| 5   | 15 to 19   | "job is finished"     | XPOWER low-profile air mover being switched off at the end of a job in a bright, dry room           | `generateImage` grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then `submitGenerativeVideo` image-to-video |
| 6   | 19 to 23   | "back up your report" | Hydro Shark probe resting on a clean bench in a bright vehicle bay                                  | `generateImage` grounded on `water-damage-restoration/ccw-hydro-shark-moisture-probe`, then `submitGenerativeVideo` image-to-video  |
| 7   | 23 to 26.5 | "air movers run"      | XPOWER low-profile air mover running on a dry carpet edge, morning sun                              | `generateImage` grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "Ask CCW"             | Margot beside the moisture probe display; approved CCW logo file composited on the wall in the edit | HeyGen avatar from Margot's voice (`heygen-director`); approved CCW logo file composited in the edit                                |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: the meter reading is a Blender insert (`blender_title.py`), 4 s, composited in the edit, not generated. The figure shown is a design element, not a measured value.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Dry is a number on a meter, not a feeling on your hand. Take moisture readings at the start and on every visit, and record them: they show when the job is finished and back up your report. Ask CCW about moisture detection: link in bio.

## Claims and sources

| Claim                                                                                                                                  | Source                                                                            | Status       |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| Take moisture readings at the start and on every visit, and record them; readings show when the job is finished and back up the report | Moisture-reading practice is not on the verified source list: `[TOBY TO CONFIRM]` | Pending Toby |
| CCW stocks the Hydro Shark moisture sensor                                                                                             | CCW product page (named in the calendar row): `[TOBY TO CONFIRM]` current range   | Pending Toby |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                       |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                     |
| S2 Hook in 2 s                    | PASS    | Row hook is line 1; statement, no question                 |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                    |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished outcome                |
| S6 Owned references only          | PASS    | Every footage shot names a reference subject from this row |
| S7 Side-by-side equipment check   | PENDING | At render                                                  |
| S8 No invented claims             | PASS    | Reading practice marked for Toby                           |
| S9 AS-IICRC procedure claims      | PENDING | Moisture-reading practice not yet traced to a standard row |
| S10 AU English, metric, no emoji  | PASS    |                                                            |
| S11 One CTA with UTM link         | PASS    | Landing link copied from the calendar row                  |
| S12 CCW brand only                | PASS    | No other brand or competitor                               |
