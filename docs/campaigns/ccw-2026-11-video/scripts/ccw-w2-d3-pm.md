# ccw-w2-d3-pm: The clear-view upholstery tool

| Field             | Value                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Wednesday 18/11/2026, 17:30 AEST                                                                                                                             |
| Funnel stage      | consideration                                                                                                                                                |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                          |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                                    |
| Call to action    | See the Upholstery Pro                                                                                                                                       |
| Landing link      | https://ccwonline.com.au/collections/sapphire-scientific-1?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w2-d3-pm |
| Calendar slot key | 2026-11-25-ccw-video-2                                                                                                                                       |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                              |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 67 words, 30 seconds.

1. (0 to 3 s) Seeing the water you pull out
2. (3 to 7 s) is how you stop over-wetting a lounge.
3. (7 to 11 s) The Sapphire Clear-View Upholstery Pro has a clear head,
4. (11 to 15 s) so you can watch the extraction as you work.
5. (15 to 19 s) Its flow control lets you set the solution for the fabric.
6. (19 to 23 s) You see how much water is coming out, so you know when to stop.
7. (23 to 26.5 s) The model is the AW59.
8. (26.5 to 30 s) Link below. See the Upholstery Pro.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                        | Shot                                                                                       | Source                                                                                                                                      |
| --- | ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Seeing the water you"               | Margot to camera in a bright CCW-style warehouse aisle, morning light                      | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                       |
| 2   | 3 to 7     | "is how you stop"                    | Clear-View Upholstery Pro AW59 working on a fabric lounge arm in a sunlit living room      | `generateImage` grounded on `upholstery-cleaning/ccw-sapphire-scientific-upholstery-pro-clear`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "The Sapphire Clear-View Upholstery" | Clear-View Upholstery Pro AW59 close on the clear head against fabric, daylight            | `generateImage` grounded on `upholstery-cleaning/ccw-sapphire-scientific-upholstery-pro-clear`, then `submitGenerativeVideo` image-to-video |
| 4   | 11 to 15   | "so you can watch"                   | Clear head with water visible moving through it, over a lounge cushion, bright room        | `generateImage` grounded on `upholstery-cleaning/ccw-sapphire-scientific-upholstery-pro-clear`, then `submitGenerativeVideo` image-to-video |
| 5   | 15 to 19   | "Its flow control lets"              | Hand adjusting the flow control on the Upholstery Pro, soft window light                   | `generateImage` grounded on `upholstery-cleaning/ccw-sapphire-scientific-upholstery-pro-clear`, then `submitGenerativeVideo` image-to-video |
| 6   | 19 to 23   | "You see how much"                   | Professional upholstery hand tool beside the Upholstery Pro on a clean lounge, daylight    | `generateImage` grounded on `upholstery-cleaning/upholstery-hand-tool`, then `submitGenerativeVideo` image-to-video                         |
| 7   | 23 to 26.5 | "The model is the"                   | Dry, clean fabric lounge, the outcome, slow drift                                          | `generateImage` grounded on `upholstery-cleaning/ccw-sapphire-scientific-upholstery-pro-clear`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "Link below. See the"                | Margot beside a finished lounge; approved CCW logo file composited on the wall in the edit | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                       |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- No in-world type in this video.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Seeing the water you pull out is how you stop over-wetting a lounge. The Sapphire Clear-View Upholstery Pro AW59 has a clear head so you can watch the extraction as you work, with flow control to set the solution for the fabric. See the Upholstery Pro: link in bio.

## Claims and sources

| Claim                                                                   | Source                                                                    | Status              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| Sapphire Clear-View Upholstery Pro AW59 is listed in the Sapphire range | Sapphire page: https://ccwonline.com.au/collections/sapphire-scientific-1 | Verified 08/11/2026 |
| Clear head lets the user watch the extraction                           | Calendar row message; product page wording: `[TOBY TO CONFIRM]`           | Pending Toby        |
| Flow control sets the solution for the fabric                           | Calendar row message; maker specification: `[TOBY TO CONFIRM]`            | Pending Toby        |
| Watching the water helps stop over-wetting                              | Calendar row hook: `[TOBY TO CONFIRM]`                                    | Pending Toby        |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                          |
| --------------------------------- | ------- | ------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                        |
| S2 Hook in 2 s                    | PASS    | Statement hook from the calendar row, no question             |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                       |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                   |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished result                    |
| S6 Owned references only          | PASS    | Every non-Margot shot names a reference subject from this row |
| S7 Side-by-side equipment check   | PENDING | At render                                                     |
| S8 No invented claims             | PENDING | Tool features await Toby against the product page             |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim beyond CCW page wording                    |
| S10 AU English, metric, no emoji  | PASS    |                                                               |
| S11 One CTA with UTM link         | PASS    |                                                               |
| S12 CCW brand only                | PASS    | No other brand or competitor                                  |
