# ccw-w4-d1-am: Drying inside the cavity

| Field             | Value                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Monday 30/11/2026, 07:00 AEST                                                                                                               |
| Funnel stage      | consideration                                                                                                                               |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                         |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                   |
| Call to action    | Ask CCW which pack suits you                                                                                                                |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w4-d1-am |
| Calendar slot key | 2026-12-07-ccw-video-1                                                                                                                      |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                             |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 75 words, 30 seconds.

1. (0 to 3 s) Some of the water is behind the wall
2. (3 to 7 s) and under the floor, out of reach of room air.
3. (7 to 11 s) Injectidry systems move air into wall cavities and under floor coverings.
4. (11 to 15 s) The air travels through hoses and panels.
5. (15 to 19 s) CCW stocks floor drying packs and injection systems for walls.
6. (19 to 23 s) Floor, wall or ceiling work each calls for a different pack.
7. (23 to 26.5 s) Choose the pack for the job before the water arrives.
8. (26.5 to 30 s) Ask CCW which pack suits you. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words              | Shot                                                                                      | Source                                                                                                                                                       |
| --- | ---------- | -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 0 to 3     | "Some of the water"        | Margot to camera in a bright CCW-style warehouse aisle, morning light                     | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                        |
| 2   | 3 to 7     | "and under the floor"      | Vac-it 8 point panel laid on a timber floor in a bright living room, slow push-in         | `generateImage` grounded on `water-damage-restoration/ccw-injectidry-vac-it-8-point-panel-36inch-x-30inch-each`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "Injectidry systems"       | Adaptidry 5 port system set up in a bright room, hoses running to the base of a wall      | `generateImage` grounded on `water-damage-restoration/ccw-adaptidry-ad5-injection-drying-system`, then `submitGenerativeVideo` image-to-video                |
| 4   | 11 to 15   | "hoses and panels"         | Close-up of hose connections feeding the Vac-it panel                                     | `generateImage` grounded on `water-damage-restoration/ccw-injectidry-vac-it-8-point-panel-36inch-x-30inch-each`, then `submitGenerativeVideo` image-to-video |
| 5   | 15 to 19   | "floor drying packs"       | Injectidry HP-PLUS floor drying pack laid out on a clean warehouse floor                  | `generateImage` grounded on `water-damage-restoration/ccw-injectidry-hp-plus-floor-drying-pack`, then `submitGenerativeVideo` image-to-video                 |
| 6   | 19 to 23   | "Floor, wall or ceiling"   | Adaptidry hoses and fittings at a wall, side-on, daylight from a window                   | `generateImage` grounded on `water-damage-restoration/ccw-adaptidry-ad5-injection-drying-system`, then `submitGenerativeVideo` image-to-video                |
| 7   | 23 to 26.5 | "before the water arrives" | HP-PLUS pack packed and ready beside a clean, dry timber floor, morning sun               | `generateImage` grounded on `water-damage-restoration/ccw-injectidry-hp-plus-floor-drying-pack`, then `submitGenerativeVideo` image-to-video                 |
| 8   | 26.5 to 30 | "Ask CCW"                  | Margot beside the pack display; approved CCW logo file composited on the wall in the edit | HeyGen avatar from Margot's voice (`heygen-director`); approved CCW logo file composited in the edit                                                         |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Captions: Margot's words, burned in, CCW colours.
- Shot 6: "Floor / Wall / Ceiling" set into the scene as a Blender insert (`blender_title.py`), 4 s, composited in the edit, not generated.
- No full-frame text cards.

## Post caption

Some of the water sits behind the wall and under the floor. Injectidry systems move air into wall cavities and under floor coverings through hoses and panels. Ask CCW which pack suits floor, wall or ceiling work: link in bio.

## Claims and sources

| Claim                                                                                                    | Source                                                                                             | Status              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
| Air is moved into wall cavities and under floor coverings through hoses and panels by Injectidry systems | Row message; how Injectidry works is not on the verified source list: `[TOBY TO CONFIRM]`          | Pending Toby        |
| CCW range includes the Adaptidry 5 Port, HP-PLUS Floor Drying Package and Vac-it 8 point panel           | CCW product pages (named in the calendar row): `[TOBY TO CONFIRM]` the pack is current and stocked | Pending Toby        |
| Which pack suits floor, wall or ceiling work is a matter to ask CCW                                      | Contact page: https://ccwonline.com.au/pages/contact-us                                            | Verified 08/11/2026 |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                              |
| --------------------------------- | ------- | ----------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                            |
| S2 Hook in 2 s                    | PASS    | Row hook is line 1; statement, no question                        |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                           |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                       |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished outcome                       |
| S6 Owned references only          | PASS    | Every footage shot names a reference subject from this row        |
| S7 Side-by-side equipment check   | PENDING | At render                                                         |
| S8 No invented claims             | PASS    | Injectidry mechanics marked for Toby                              |
| S9 AS-IICRC procedure claims      | PASS    | No standards procedure claim; product explanation marked for Toby |
| S10 AU English, metric, no emoji  | PASS    |                                                                   |
| S11 One CTA with UTM link         | PASS    | Landing link copied from the calendar row                         |
| S12 CCW brand only                | PASS    | No other brand or competitor                                      |
