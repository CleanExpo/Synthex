# ccw-w1-d5-pm: Book a storm-ready check

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Friday 20/11/2026, 17:30 AEST                                                                                                                    |
| Funnel stage      | conversion                                                                                                                                       |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Call CCW on 1800 686 869                                                                                                                         |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w1-d5-pm |
| Calendar slot key | 2026-11-20-ccw-video-2                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 72 words, 30 seconds.

1. (0 to 3 s) Find the fault now, not on the first wet morning.
2. (3 to 7 s) Call CCW and describe how your kit is running.
3. (7 to 11 s) CCW's technicians diagnose most problems over the phone.
4. (11 to 15 s) Parts in stock go out the same day.
5. (15 to 19 s) Tell them about the air scrubber, the air movers and the dehumidifier.
6. (19 to 23 s) A fault found now is one fewer on a job site.
7. (23 to 26.5 s) Cyclone season runs to the end of April.
8. (26.5 to 30 s) Call CCW on 1800 686 869.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words           | Shot                                                                                             | Source                                                                                                                                                                                    |
| --- | ---------- | ----------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Find the fault"        | Margot to camera in a bright CCW-style warehouse aisle, morning light                            | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                     |
| 2   | 3 to 7     | "describe how your kit" | XPOWER X-800 air mover on a workshop bench with its guard off, daylight, close-up                | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                                  |
| 3   | 7 to 11    | "technicians diagnose"  | BD2500 dehumidifier with its filter panel open on a bright workshop bench                        | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-lgr-dehumidifier-bd2500-230volt`, then `submitGenerativeVideo` image-to-video                                           |
| 4   | 11 to 15   | "Parts in stock"        | Razorback MaxxGuard 550UV air scrubber boxed and ready beside a dispatch bench, morning light    | `generateImage` grounded on `water-damage-restoration/ccw-razorback-maxxguard-550-cfm-air-scrubber-with-uv-c-light-sterilization-technology`, then `submitGenerativeVideo` image-to-video |
| 5   | 15 to 19   | "the air scrubber"      | MaxxGuard 550UV running in a bright room                                                         | `generateImage` grounded on `water-damage-restoration/ccw-razorback-maxxguard-550-cfm-air-scrubber-with-uv-c-light-sterilization-technology`, then `submitGenerativeVideo` image-to-video |
| 6   | 19 to 23   | "fewer on a job site"   | Row of X-800 air movers working in a dry, sunlit room                                            | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                                  |
| 7   | 23 to 26.5 | "end of April"          | Whiteboard reads "01/11 to 30/04" behind the BD2500 (text composited in the edit, not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-dri-eaz-lgr-dehumidifier-bd2500-230volt`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours    |
| 8   | 26.5 to 30 | "Call CCW"              | Margot beside the drying range; CCW logo and phone number composited on the wall                 | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                              |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 7: "01/11 to 30/04" in the world (whiteboard), 3.5 s.
- Shot 8: "1800 686 869" lower-third, composited (Blender insert), 3.5 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Find the fault now, not on the first wet morning. Call CCW on 1800 686 869 and describe how your kit is running. CCW's technicians diagnose most problems over the phone, and parts in stock go out the same day. Contact page: link in bio.

## Claims and sources

| Claim                                                                                                       | Source                                                                                                              | Status              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Technicians diagnose most problems over the phone; part in stock dispatched the same day (CCW's own claims) | CCW about page: https://ccwonline.com.au/pages/about-us                                                             | Verified 08/11/2026 |
| Phone 1800 686 869                                                                                          | CCW contact page: https://ccwonline.com.au/pages/contact-us                                                         | Verified 08/11/2026 |
| Season runs to 30/04                                                                                        | ABC News, 01/11/2026: https://www.abc.net.au/news/2026-11-01/bom-australia-cyclone-season-predicted-quiet/107329238 | Verified 08/11/2026 |
| A fault found now is one fewer on a job site                                                                | Inference, not a CCW claim: `[TOBY TO CONFIRM]`                                                                     | Pending Toby        |

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
