# ccw-w4-d3-pm: Contain before you remove

| Field             | Value                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Wednesday 02/12/2026, 17:30 AEST                                                                                                            |
| Funnel stage      | consideration                                                                                                                               |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                         |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                   |
| Call to action    | Ask CCW about containment                                                                                                                   |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w4-d3-pm |
| Calendar slot key | 2026-12-09-ccw-video-2                                                                                                                      |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                             |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 66 words, 30 seconds.

1. (0 to 3 s) Mould work starts with plastic on the wall,
2. (3 to 7 s) not a scraper. Containment comes first.
3. (7 to 11 s) Contain the work area before disturbing mould-affected material.
4. (11 to 15 s) Do not touch the contaminated material until containment is up.
5. (15 to 19 s) Poly hangers and containment weights hold the sheeting in place.
6. (19 to 23 s) They hold it without damaging the room.
7. (23 to 26.5 s) CCW stocks Poly-Hanger number 1 and 2 and Phoenix containment weights.
8. (26.5 to 30 s) Ask CCW about containment. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words           | Shot                                                                                             | Source                                                                                                                                                                                   |
| --- | ---------- | ----------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Mould work starts"     | Margot to camera in a bright CCW-style warehouse aisle, morning light                            | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                    |
| 2   | 3 to 7     | "not a scraper"         | Plastic sheeting hung on a bright room wall by Poly-Hanger clips, slow push-in                   | `generateImage` grounded on `water-damage-restoration/ccw-poly-hanger-1-wall`, then `submitGenerativeVideo` image-to-video                                                               |
| 3   | 7 to 11    | "Contain the work area" | Wide shot of a sheeted-off work area in a clean room, doorway sealed, daylight                   | `generateImage` grounded on `water-damage-restoration/ccw-poly-hanger-2-wall`, then `submitGenerativeVideo` image-to-video                                                               |
| 4   | 11 to 15   | "Do not touch"          | Edge of the sheeting held at a wall with a clip, detail, steady frame                            | `generateImage` grounded on `water-damage-restoration/ccw-poly-hanger-2-wall`, then `submitGenerativeVideo` image-to-video                                                               |
| 5   | 15 to 19   | "Poly hangers"          | Phoenix containment weights holding sheeting down on a clean floor, low angle                    | `generateImage` grounded on `water-damage-restoration/ccw-phoenix-containment-weight`, then `submitGenerativeVideo` image-to-video                                                       |
| 6   | 19 to 23   | "without damaging"      | Poly-Hanger clip on a painted wall, showing the wall surface unmarked                            | `generateImage` grounded on `water-damage-restoration/ccw-poly-hanger-1-wall`, then `submitGenerativeVideo` image-to-video                                                               |
| 7   | 23 to 26.5 | "Poly-Hanger number 1"  | Poly-Hanger clips and Phoenix weights laid out together on a clean warehouse floor               | `generateImage` grounded on `water-damage-restoration/ccw-poly-hanger-2-wall` and `water-damage-restoration/ccw-phoenix-containment-weight`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "Ask CCW"               | Margot beside the containment display; approved CCW logo file composited on the wall in the edit | HeyGen avatar from Margot's voice (`heygen-director`); approved CCW logo file composited in the edit                                                                                     |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Mould work starts with plastic on the wall, not a scraper. Contain the work area before disturbing mould-affected material. Poly-Hanger clips and Phoenix containment weights hold sheeting in place. Ask CCW about containment: link in bio.

## Claims and sources

| Claim                                                                                                                              | Source                                                                                   | Status              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| Contain the work area before disturbing mould-affected material; do not disturb contaminated material until containment is erected | EPA; SafeWork NSW; S520:2024 cl 9.3.3 (standards register R1)                            | Verified 08/11/2026 |
| Poly-Hanger clips and Phoenix containment weights hold sheeting in place without damaging the room                                 | Row message; product performance is not on the verified source list: `[TOBY TO CONFIRM]` | Pending Toby        |
| CCW stocks Poly-Hanger #1 and #2 and Phoenix containment weights                                                                   | CCW product pages (named in the calendar row): `[TOBY TO CONFIRM]` current range         | Pending Toby        |

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
| S8 No invented claims             | PASS    | Product-performance line marked for Toby                   |
| S9 AS-IICRC procedure claims      | PASS    | Containment lines match register row (S520:2024 cl 9.3.3)  |
| S10 AU English, metric, no emoji  | PASS    |                                                            |
| S11 One CTA with UTM link         | PASS    | Landing link copied from the calendar row                  |
| S12 CCW brand only                | PASS    | No other brand or competitor                               |
