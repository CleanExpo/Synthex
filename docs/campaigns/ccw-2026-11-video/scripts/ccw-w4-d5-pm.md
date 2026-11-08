# ccw-w4-d5-pm: Five checks before the wet

| Field             | Value                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Friday 11/12/2026, 17:30 AEST                                                                                                              |
| Funnel stage      | retention                                                                                                                                  |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                        |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                  |
| Call to action    | Read more on the CCW blog                                                                                                                  |
| Landing link      | https://ccwonline.com.au/blogs/news?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w4-d5-pm |
| Calendar slot key | 2026-12-11-ccw-video-2                                                                                                                     |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                            |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 69 words, 30 seconds.

1. (0 to 3 s) Save this. Five checks to run
2. (3 to 7 s) before the next storm. One, filters.
3. (7 to 11 s) Two, glides. Check they are clean and not worn.
4. (11 to 15 s) Three, hoses. Look for cuts, kinks and loose fittings.
5. (15 to 19 s) Four, cords. Look for damage along the full length.
6. (19 to 23 s) Five, a phone call to CCW for anything that does not sound right.
7. (23 to 26.5 s) Then follow CCW for the rest of the season.
8. (26.5 to 30 s) Read more on the CCW blog. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words        | Shot                                                                                                 | Source                                                                                                                                   |
| --- | ---------- | -------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Save this"          | Margot to camera in a bright CCW-style warehouse aisle, morning light                                | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                    |
| 2   | 3 to 7     | "One, filters"       | Sapphire 12 titanium wand inlet area, clean bench, bright daylight, slow push-in                     | `generateImage` grounded on `carpet-cleaning/ccw-sapphire-12-titanium-carpet-cleaning-wand`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "Two, glides"        | Underside of the wand head showing the glide, close-up                                               | `generateImage` grounded on `carpet-cleaning/ccw-sapphire-12-titanium-carpet-cleaning-wand`, then `submitGenerativeVideo` image-to-video |
| 4   | 11 to 15   | "Three, hoses"       | Hose connection at the wand, hands checking the fitting                                              | `generateImage` grounded on `carpet-cleaning/ccw-sapphire-12-titanium-carpet-cleaning-wand`, then `submitGenerativeVideo` image-to-video |
| 5   | 15 to 19   | "Four, cords"        | Carpet grooming pass on a clean carpet, power lead coiled neatly to one side                         | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-grooming`, then `submitGenerativeVideo` image-to-video                      |
| 6   | 19 to 23   | "Five, a phone call" | Freshly cleaned carpet in a bright living room, sun across the pile, the outcome                     | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-result`, then `submitGenerativeVideo` image-to-video                        |
| 7   | 23 to 26.5 | "follow CCW"         | Groomed carpet pile in even lines, camera drifting low across the room                               | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-grooming`, then `submitGenerativeVideo` image-to-video                      |
| 8   | 26.5 to 30 | "Read more"          | Margot beside the carpet-cleaning display; approved CCW logo file composited on the wall in the edit | HeyGen avatar from Margot's voice (`heygen-director`); approved CCW logo file composited in the edit                                     |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shots 2 to 5: the check number ("1" to "4") set into the scene as a Blender insert (`blender_title.py`), composited in the edit, not generated.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Save this. Five checks before the next storm: filters, glides, hoses, cords, and a phone call to CCW for anything that does not sound right. Follow CCW for the rest of the season, and read more on the CCW blog: link in bio.

## Claims and sources

| Claim                                                        | Source                                                                       | Status              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------- |
| Check filters, glides, hoses and cords before the next storm | General equipment care, not on the verified source list: `[TOBY TO CONFIRM]` | Pending Toby        |
| Ring CCW for anything that does not sound right              | Contact page: https://ccwonline.com.au/pages/contact-us                      | Verified 08/11/2026 |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                                |
| --------------------------------- | ------- | ------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                              |
| S2 Hook in 2 s                    | PASS    | Row hook is line 1; statement, no question                          |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                             |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                         |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished outcome                         |
| S6 Owned references only          | PASS    | Every footage shot names a reference subject from this row          |
| S7 Side-by-side equipment check   | PENDING | At render                                                           |
| S8 No invented claims             | PASS    | Care checks marked for Toby                                         |
| S9 AS-IICRC procedure claims      | PASS    | No standards procedure claim; equipment-care checks marked for Toby |
| S10 AU English, metric, no emoji  | PASS    |                                                                     |
| S11 One CTA with UTM link         | PASS    | Landing link copied from the calendar row                           |
| S12 CCW brand only                | PASS    | No other brand or competitor                                        |
