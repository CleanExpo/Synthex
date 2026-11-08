# ccw-w1-d2-pm: Low profile goes where standard cannot

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Tuesday 10/11/2026, 17:30 AEST                                                                                                                   |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the low-profile units                                                                                                                        |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d2-pm |
| Calendar slot key | 2026-11-17-ccw-video-2                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 73 words, 30 seconds.

1. (0 to 3 s) Most of the wet area in a furnished home is under something.
2. (3 to 7 s) Under a bed, against a skirting,
3. (7 to 11 s) beneath a vanity. A standard unit cannot reach those places.
4. (11 to 15 s) A low-profile air mover can.
5. (15 to 19 s) The Dri-Eaz Velo and the XPOWER PL700A are both low-profile units.
6. (19 to 23 s) They let air move across the floor where furniture blocks it.
7. (23 to 26.5 s) The aim is a floor dry all the way underneath.
8. (26.5 to 30 s) See the low-profile units at CCW. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words           | Shot                                                                                   | Source                                                                                                                                     |
| --- | ---------- | ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 0 to 3     | "Most of the wet area"  | Margot to camera in a bright CCW-style warehouse aisle, morning light                  | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                      |
| 2   | 3 to 7     | "Under a bed"           | Velo low-profile air mover sitting under a bed frame on carpet, daylight from a window | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-velo-low-profile-air-mover`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "against a skirting"    | XPOWER low-profile air mover tight against a skirting board along a bedroom wall       | `generateImage` grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then `submitGenerativeVideo` image-to-video        |
| 4   | 11 to 15   | "beneath a vanity"      | Velo low-profile air mover reaching under a bathroom vanity, bright tiled room         | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-velo-low-profile-air-mover`, then `submitGenerativeVideo` image-to-video |
| 5   | 15 to 19   | "Dri-Eaz Velo"          | Velo and PL700A side by side on a clean workshop floor, slow push-in                   | `generateImage` grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then `submitGenerativeVideo` image-to-video        |
| 6   | 19 to 23   | "move across the floor" | Low-profile unit moving air across a carpeted room past a sofa, sunlit                 | `generateImage` grounded on `water-damage-restoration/ccw-xpower-low-profile-airmover`, then `submitGenerativeVideo` image-to-video        |
| 7   | 23 to 26.5 | "dry all the way"       | Dry, clean carpet under a bed frame in morning sun, the outcome                        | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-velo-low-profile-air-mover`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "at CCW"                | Margot beside the low-profile air movers; CCW logo composited on the wall              | HeyGen avatar; approved CCW logo file composited in the edit                                                                               |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Most of the wet area in a furnished home is under something: a bed, a skirting, a vanity. Low-profile air movers reach places a standard unit cannot. See the low-profile units: link in bio.

## Claims and sources

| Claim                                                                                                                      | Source                                                              | Status              |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------- |
| Most of the wet area in a furnished home is under something; a low-profile air mover reaches places a standard unit cannot | Calendar row ccw-w1-d2-pm                                           | Verified 08/11/2026 |
| Dri-Eaz Velo and XPOWER PL700A are low-profile units                                                                       | CCW air movers page: https://ccwonline.com.au/collections/airmovers | Verified 08/11/2026 |
| Low-profile units move air across the floor where furniture blocks it                                                      | General product description: `[TOBY TO CONFIRM]`                    | Pending Toby        |

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
| S9 AS-IICRC procedure claims      | PASS    | No standard cited                                            |
| S10 AU English, metric, no emoji  | PASS    |                                                              |
| S11 One CTA with UTM link         | PASS    |                                                              |
| S12 CCW brand only                | PASS    | No other brand or competitor named                           |
