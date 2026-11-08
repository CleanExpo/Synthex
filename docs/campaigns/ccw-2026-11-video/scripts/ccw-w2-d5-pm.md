# ccw-w2-d5-pm: Finance through one call

| Field             | Value                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Friday 27/11/2026, 17:30 AEST                                                                                                                        |
| Funnel stage      | conversion                                                                                                                                           |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                  |
| Channels          | LinkedIn, Facebook Reels, Instagram Reels, YouTube Shorts                                                                                            |
| Call to action    | See finance options                                                                                                                                  |
| Landing link      | https://ccwonline.com.au/pages/finance-options?utm_source=linkedin&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w2-d5-pm |
| Calendar slot key | 2026-11-27-ccw-video-2                                                                                                                               |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                      |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 66 words, 30 seconds.

1. (0 to 3 s) One finance broker. More than 20 lenders.
2. (3 to 7 s) CCW works with Equipped Commercial Finance,
3. (7 to 11 s) which is accredited with over 20 financiers.
4. (11 to 15 s) Equipment can be arranged as rental, lease or chattel mortgage through them.
5. (15 to 19 s) That is finance for the equipment your business runs on.
6. (19 to 23 s) Rental, lease and chattel mortgage are the options listed.
7. (23 to 26.5 s) The details are on the CCW finance page.
8. (26.5 to 30 s) The link is below. See finance options.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words               | Shot                                                                                                        | Source                                                                                                                                                               |
| --- | ---------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "One finance broker"        | Margot to camera in a bright CCW-style warehouse aisle, morning light                                       | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                |
| 2   | 3 to 7     | "CCW works with Equipped"   | Truckmount unit on a bright driveway beside a van, morning sun, slow push-in                                | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video                                                |
| 3   | 7 to 11    | "which is accredited with"  | Truckmount hose and wand laid out neatly on a clean floor; text 'Over 20 financiers' composited in the edit | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video                                                |
| 4   | 11 to 15   | "Equipment can be arranged" | Razorback CRB-15 on a sunlit carpet, finished stripe behind it                                              | `generateImage` grounded on `carpet-cleaning/ccw-razorback-crb-15-counter-rotating-brush-machine-15-inch-230v-50hz-new`, then `submitGenerativeVideo` image-to-video |
| 5   | 15 to 19   | "That is finance for"       | Truckmount operator coiling a hose beside a van in daylight                                                 | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video                                                |
| 6   | 19 to 23   | "Rental, lease and chattel" | CRB-15 close on the handle and brush housing, soft window light                                             | `generateImage` grounded on `carpet-cleaning/ccw-razorback-crb-15-counter-rotating-brush-machine-15-inch-230v-50hz-new`, then `submitGenerativeVideo` image-to-video |
| 7   | 23 to 26.5 | "The details are on"        | Clean, even office carpet in morning sun, the outcome, slow drift                                           | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video                                                |
| 8   | 26.5 to 30 | "The link is below"         | Margot beside the CRB-15; approved CCW logo file composited on the wall in the edit                         | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: 'Over 20 financiers' as type composited in the edit (Blender insert), 4 s. Not generated.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

One finance broker, more than 20 lenders. CCW works with Equipped Commercial Finance, accredited with over 20 financiers, for rental, lease or chattel mortgage on equipment. See finance options: link in bio.

## Claims and sources

| Claim                                                                                            | Source                                                                                              | Status              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------- |
| Equipped Commercial Finance, accredited with over 20 financiers; rental, lease, chattel mortgage | CCW finance page: https://ccwonline.com.au/pages/finance-options                                    | Verified 08/11/2026 |
| One finance broker, more than 20 lenders                                                         | Paraphrase of the finance page: Equipped Commercial Finance 'is accredited with over 20 financiers' | Verified 08/11/2026 |
| Pictured equipment is eligible for finance                                                       | Not claimed on air; pictures are illustrative                                                       | n/a                 |

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
| S8 No invented claims             | PASS    | Hook reworded to match the finance page                       |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim beyond CCW page wording                    |
| S10 AU English, metric, no emoji  | PASS    |                                                               |
| S11 One CTA with UTM link         | PASS    |                                                               |
| S12 CCW brand only                | PASS    | No other brand or competitor                                  |
