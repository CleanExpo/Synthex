# ccw-w2-d4-pm: What 1:32 actually means

| Field             | Value                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Thursday 26/11/2026, 17:30 AEST                                                                                                            |
| Funnel stage      | retention                                                                                                                                  |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                        |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                  |
| Call to action    | Use the dilution calculator                                                                                                                |
| Landing link      | https://ccwonline.com.au/blogs/news?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w2-d4-pm |
| Calendar slot key | 2026-11-26-ccw-video-2                                                                                                                     |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                            |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 65 words, 30 seconds.

1. (0 to 3 s) One to thirty-two is about 31 mL
2. (3 to 7 s) of concentrate for every litre of water.
3. (7 to 11 s) Getting dilution wrong costs chemistry or results.
4. (11 to 15 s) A sprayer or a bucket needs the number in millilitres.
5. (15 to 19 s) CCW's free calculator turns any ratio into millilitres.
6. (19 to 23 s) It also explains what 1 to 32 and 32 to 1 mean.
7. (23 to 26.5 s) Check which way round your ratio is written.
8. (26.5 to 30 s) Link below. Use the dilution calculator.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                  | Shot                                                                                                                                                | Source                                                                                                                       |
| --- | ---------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "One to thirty-two is"         | Margot to camera in a bright CCW-style warehouse aisle, morning light                                                                               | HeyGen avatar from Margot's voice (`heygen-director`)                                                                        |
| 2   | 3 to 7     | "of concentrate for every"     | Double pump-up sprayer holder with two sprayers on a workshop wall in daylight, slow push-in; text '1000 mL / 32 = 31.25 mL' composited in the edit | `generateImage` grounded on `carpet-cleaning/ccw-holder-double-pump-up-sprayer`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "Getting dilution wrong costs" | Sprayer being filled with water at a utility sink, morning light                                                                                    | `generateImage` grounded on `carpet-cleaning/ccw-holder-double-pump-up-sprayer`, then `submitGenerativeVideo` image-to-video |
| 4   | 11 to 15   | "A sprayer or a"               | Hydro-Force sprayer wall mount holding a sprayer on a bright wall, side view                                                                        | `generateImage` grounded on `carpet-cleaning/ccw-hf-holder-wall-mount`, then `submitGenerativeVideo` image-to-video          |
| 5   | 15 to 19   | "CCW's free calculator turns"  | Two sprayers in the double holder, caps facing out, close, soft window light                                                                        | `generateImage` grounded on `carpet-cleaning/ccw-holder-double-pump-up-sprayer`, then `submitGenerativeVideo` image-to-video |
| 6   | 19 to 23   | "It also explains what"        | Wall mount close on the bracket and sprayer, daylight                                                                                               | `generateImage` grounded on `carpet-cleaning/ccw-hf-holder-wall-mount`, then `submitGenerativeVideo` image-to-video          |
| 7   | 23 to 26.5 | "Check which way round"        | Neat, bright cleaning store with sprayers racked and ready, wide shot, slow drift                                                                   | `generateImage` grounded on `carpet-cleaning/ccw-holder-double-pump-up-sprayer`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "Link below. Use the"          | Margot beside the sprayer holder; approved CCW logo file composited on the wall in the edit                                                         | HeyGen avatar from Margot's voice (`heygen-director`)                                                                        |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 2: '1000 mL / 32 = 31.25 mL' as type composited in the edit (Blender insert), 4 s. Not generated.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

1:32 means about 31 mL of concentrate for every litre of water: 1000 mL divided by 32 is 31.25 mL. CCW's free dilution calculator turns any ratio into millilitres for a sprayer or a bucket: link in bio.

## Claims and sources

| Claim                                                                                            | Source                                                                                | Status              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------- |
| 1:32 is about 31 mL of concentrate per litre of water (1000 mL / 32 = 31.25 mL)                  | Arithmetic from the row. Ratio convention for the products shown: `[TOBY TO CONFIRM]` | Pending Toby        |
| CCW publishes a free dilution calculator and posts on what 1:32 or 32:1 means in mL (15/10/2026) | CCW blog: https://ccwonline.com.au/blogs/news                                         | Verified 08/11/2026 |
| Wrong dilution costs chemistry or results                                                        | Calendar row message: `[TOBY TO CONFIRM]`                                             | Pending Toby        |

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
| S8 No invented claims             | PASS    | Unsourced items marked for Toby                               |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim beyond CCW page wording                    |
| S10 AU English, metric, no emoji  | PASS    |                                                               |
| S11 One CTA with UTM link         | PASS    |                                                               |
| S12 CCW brand only                | PASS    | No other brand or competitor                                  |
