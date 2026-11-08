# ccw-w1-d1-am: Cyclone season is open

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Monday 16/11/2026, 07:00 AEST                                                                                                                         |
| Funnel stage      | awareness                                                                                                                                             |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                             |
| Call to action    | See the drying range                                                                                                                                  |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w1-d1-am |
| Calendar slot key | 2026-11-16-ccw-video-1                                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 70 words, 30 seconds.

1. (0.0 to 3.0 s) Cyclone season opened on the first of November.
2. (3.0 to 7.0 s) Your drying kit has until the first call to be ready.
3. (7.0 to 11.0 s) The season runs right through to the end of April.
4. (11.0 to 15.0 s) Check your air movers now: cords, guards, clamps.
5. (15.0 to 19.0 s) Run every dehumidifier. Check the filter and drain.
6. (19.0 to 23.0 s) Fit a fresh pre-filter on your air scrubber.
7. (23.0 to 26.5 s) If something needs a part, find it this week.
8. (26.5 to 30.0 s) See the drying range at CCW.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time         | Trigger words                     | Shot                                                                                                                                | Source                                                                                                                                                       |
| --- | ------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 0.0 to 3.0   | "Cyclone season"                  | Margot to camera in a bright CCW-style warehouse aisle, morning light                                                               | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                        |
| 2   | 3.0 to 7.0   | "Your drying kit"                 | XPOWER X-800 air movers lined up on a clean warehouse floor, slow push-in                                                           | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s |
| 3   | 7.0 to 11.0  | "through to the end of April"     | Calendar type set into the scene: "01/11 to 30/04" printed on a whiteboard behind the units (composited in the edit, not generated) | Blender insert (`blender_title.py`), CCW colours, composited over shot 2's plate                                                                             |
| 4   | 11.0 to 15.0 | "check your air movers"           | Close-up: hands checking the cord and clamp on the X-800                                                                            | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp` (clamp detail), image-to-video                                   |
| 5   | 15.0 to 19.0 | "every dehumidifier"              | Dri-Eaz LGR 7000XLi running in a bright laundry, filter panel open                                                                  | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-dehumidifier-lgr-7000xl-230volt`, image-to-video                                           |
| 6   | 19.0 to 23.0 | "pre-filter on your air scrubber" | Razorback MaxxGuard 550 with the pre-filter being slid out                                                                          | `generateImage` grounded on `water-damage-restoration/ccw-razorback-maxxguard-550-cfm-air-scrubber`, image-to-video                                          |
| 7   | 23.0 to 26.5 | "find it this week"               | Dry, clean living-room carpet in morning sun, the outcome                                                                           | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-result`, image-to-video slow drift                                                              |
| 8   | 26.5 to 30.0 | "at CCW"                          | Margot beside the air mover line-up; CCW logo composited on the wall                                                                | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                 |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: "01/11 to 30/04" in the world (whiteboard), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Cyclone season opened on 01/11 and runs to 30/04. Check air movers, dehumidifiers and air scrubbers
now, while there is time to fix or replace them. The full drying range: link in bio.

## Claims and sources

| Claim                                                               | Source                                                                                                              | Status              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Season runs 1 November to 30 April                                  | ABC News, 01/11/2026: https://www.abc.net.au/news/2026-11-01/bom-australia-cyclone-season-predicted-quiet/107329238 | Verified 08/11/2026 |
| Air scrubber pre-filter protects the HEPA                           | CCW Razorback page: https://ccwonline.com.au/collections/razorback                                                  | Verified 08/11/2026 |
| Check cords, guards and clamps; check dehumidifier filter and drain | General equipment care, not a standard. Wording matches the makers' manuals: `[TOBY TO CONFIRM]`                    | Pending Toby        |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                        |
| --------------------------------- | ------- | ------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                      |
| S2 Hook in 2 s                    | PASS    | Date fact, no question                      |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                     |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render |
| S5 Bright, moving, outcome        | PASS    | Morning light; ends on a dry room           |
| S6 Owned references only          | PASS    | Every shot names its reference subject      |
| S7 Side-by-side equipment check   | PENDING | At render                                   |
| S8 No invented claims             | PASS    | Care line marked for Toby                   |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim made                     |
| S10 AU English, metric, no emoji  | PASS    |                                             |
| S11 One CTA with UTM link         | PASS    |                                             |
| S12 CCW brand only                | PASS    | No other brand or competitor                |
