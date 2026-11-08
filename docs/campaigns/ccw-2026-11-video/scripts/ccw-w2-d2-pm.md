# ccw-w2-d2-pm: UV light and pet urine

| Field             | Value                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Tuesday 24/11/2026, 17:30 AEST                                                                                                             |
| Funnel stage      | retention                                                                                                                                  |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                        |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                  |
| Call to action    | Read Toby's UV guide                                                                                                                       |
| Landing link      | https://ccwonline.com.au/blogs/news?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w2-d2-pm |
| Calendar slot key | 2026-11-24-ccw-video-2                                                                                                                     |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                            |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 65 words, 30 seconds.

1. (0 to 3 s) A blacklight shows more than urine,
2. (3 to 7 s) and that can mislead a quote.
3. (7 to 11 s) Other things fluoresce under UV too, not only urine.
4. (11 to 15 s) A 365 nanometre light and a 395 nanometre light behave differently.
5. (15 to 19 s) So inspect the room before you quote it.
6. (19 to 23 s) Toby Bredhauer's guide on the CCW blog explains how to inspect.
7. (23 to 26.5 s) It was published on the twenty-ninth of July.
8. (26.5 to 30 s) Link below. Read Toby's UV guide.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                  | Shot                                                                                                      | Source                                                                                                                             |
| --- | ---------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "A blacklight shows more"      | Margot to camera in a bright CCW-style warehouse aisle, morning light                                     | HeyGen avatar from Margot's voice (`heygen-director`)                                                                              |
| 2   | 3 to 7     | "and that can mislead"         | LED UV flashlight held in a hand over a carpet edge in a bright room, beam visible on the pile            | `generateImage` grounded on `water-damage-restoration/ccw-led-uv-flash-light-51-leds`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "Other things fluoresce under" | SOS UV black light kit open on a clean work surface in daylight                                           | `generateImage` grounded on `water-damage-restoration/ccw-sos-uv-black-light-kit`, then `submitGenerativeVideo` image-to-video     |
| 4   | 11 to 15   | "A 365 nanometre light"        | Two UV lights side by side on a table in a bright room; text '365 nm' and '395 nm' composited in the edit | `generateImage` grounded on `water-damage-restoration/ccw-sos-uv-black-light-kit`, then `submitGenerativeVideo` image-to-video     |
| 5   | 15 to 19   | "So inspect the room"          | Technician crouched at a room doorway inspecting carpet with a UV light in daylight                       | `generateImage` grounded on `water-damage-restoration/ccw-led-uv-flash-light-51-leds`, then `submitGenerativeVideo` image-to-video |
| 6   | 19 to 23   | "Toby Bredhauer's guide on"    | LED UV flashlight 51 LEDs close on the lamp head, soft window light                                       | `generateImage` grounded on `water-damage-restoration/ccw-led-uv-flash-light-51-leds`, then `submitGenerativeVideo` image-to-video |
| 7   | 23 to 26.5 | "It was published on"          | SOS UV kit case closed on a bench beside a notepad, bright morning light                                  | `generateImage` grounded on `water-damage-restoration/ccw-sos-uv-black-light-kit`, then `submitGenerativeVideo` image-to-video     |
| 8   | 26.5 to 30 | "Link below. Read Toby's"      | Margot beside the UV kit; approved CCW logo file composited on the wall in the edit                       | HeyGen avatar from Margot's voice (`heygen-director`)                                                                              |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 4: '365 nm' and '395 nm' as type composited in the edit (Blender insert), 4 s. Not generated.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

A blacklight shows more than urine. Other things fluoresce under UV, and 365 nm and 395 nm lights behave differently. Toby Bredhauer's guide on the CCW blog covers how to inspect a room before you quote: link in bio.

## Claims and sources

| Claim                                                                                                           | Source                                                                                       | Status              |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| Other things fluoresce under UV and can mislead; 365 nm and 395 nm behave differently; inspect before you quote | CCW blog, Toby Bredhauer UV pet-urine guide, 29/07/2026: https://ccwonline.com.au/blogs/news | Verified 08/11/2026 |
| Guide was published 29/07/2026                                                                                  | CCW blog listing: https://ccwonline.com.au/blogs/news                                        | Verified 08/11/2026 |

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
| S8 No invented claims             | PASS    | All claims sourced                                            |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim beyond CCW page wording                    |
| S10 AU English, metric, no emoji  | PASS    |                                                               |
| S11 One CTA with UTM link         | PASS    |                                                               |
| S12 CCW brand only                | PASS    | No other brand or competitor                                  |
