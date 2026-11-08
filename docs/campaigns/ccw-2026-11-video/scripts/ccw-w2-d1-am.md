# ccw-w2-d1-am: Encapsulation or extraction

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Monday 23/11/2026, 07:00 AEST                                                                                                                         |
| Funnel stage      | consideration                                                                                                                                         |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                             |
| Call to action    | See the Razorback range                                                                                                                               |
| Landing link      | https://ccwonline.com.au/collections/razorback?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w2-d1-am |
| Calendar slot key | 2026-11-23-ccw-video-1                                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 74 words, 30 seconds.

1. (0 to 3 s) Selling encapsulation as a restorative clean
2. (3 to 7 s) is where commercial contracts go wrong.
3. (7 to 11 s) Encapsulation suits interim commercial maintenance, where downtime is short.
4. (11 to 15 s) Extraction with a prespray and a rinse is the restorative clean.
5. (15 to 19 s) That means a prespray before the pass, and a rinse after it.
6. (19 to 23 s) So pick the method by the maintenance cycle, not by the machine you already own.
7. (23 to 26.5 s) Then name the method in the quote.
8. (26.5 to 30 s) The link is below. See the Razorback range.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                            | Shot                                                                                                               | Source                                                                                                                                                                 |
| --- | ---------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Selling encapsulation as a"             | Margot to camera in a bright CCW-style warehouse aisle, morning light                                              | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                  |
| 2   | 3 to 7     | "is where commercial contracts"          | Polystar 15 inch orbital encapsulation scrubber working across an open-plan office floor in daylight, slow push-in | `generateImage` grounded on `carpet-cleaning/ccw-cleanstar-ploystar-15inch-orbital-encapsulation-scrubber-floor-polisher`, then `submitGenerativeVideo` image-to-video |
| 3   | 7 to 11    | "Encapsulation suits interim commercial" | Polystar in a bright commercial corridor, finished floor behind it, slow side track                                | `generateImage` grounded on `carpet-cleaning/ccw-cleanstar-ploystar-15inch-orbital-encapsulation-scrubber-floor-polisher`, then `submitGenerativeVideo` image-to-video |
| 4   | 11 to 15   | "Extraction with a prespray"             | Extraction pass on a bright carpet, clean stripes left behind, low angle                                           | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-extraction`, then `submitGenerativeVideo` image-to-video                                                  |
| 5   | 15 to 19   | "That means a prespray"                  | Razorback CRB-15 counter-rotating brush machine on carpet in a sunlit room, three-quarter view                     | `generateImage` grounded on `carpet-cleaning/ccw-razorback-crb-15-counter-rotating-brush-machine-15-inch-230v-50hz-new`, then `submitGenerativeVideo` image-to-video   |
| 6   | 19 to 23   | "So pick the method"                     | Clean, even commercial carpet in morning sun, the outcome, slow drift                                              | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-extraction`, then `submitGenerativeVideo` image-to-video                                                  |
| 7   | 23 to 26.5 | "Then name the method"                   | Razorback CRB-15 parked at the end of a finished office aisle, daylight through windows                            | `generateImage` grounded on `carpet-cleaning/ccw-razorback-crb-15-counter-rotating-brush-machine-15-inch-230v-50hz-new`, then `submitGenerativeVideo` image-to-video   |
| 8   | 26.5 to 30 | "The link is below"                      | Margot beside the machines; approved CCW logo file composited on the wall in the edit                              | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                  |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- No in-world type in this video.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Encapsulation suits interim commercial maintenance where downtime is short. Extraction with a prespray and rinse is the restorative clean. Pick by the maintenance cycle and name the method in the quote. The Razorback range: link in bio.

## Claims and sources

| Claim                                                                                                                                     | Source                                                                            | Status               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| Encapsulation suits interim commercial maintenance where downtime is limited; extraction with prespray and rinse is the restorative clean | CCW Razorback page: https://ccwonline.com.au/collections/razorback                | Verified 08/11/2026  |
| Polystar 15 inch is an orbital encapsulation scrubber                                                                                     | Product name in the CCW catalogue reference; how it works is not described on air | Verified (name only) |
| Pick by maintenance cycle; name the method in the quote                                                                                   | Advice drawn from the row message, not a standard: `[TOBY TO CONFIRM]`            | Pending Toby         |

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
