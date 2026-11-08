# ccw-w3-d4-am: A water softener in the van

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Thursday 03/12/2026, 07:00 AEST                                                                                                                  |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Ask CCW about water softeners                                                                                                                    |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w3-d4-am |
| Calendar slot key | 2026-12-03-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 65 words, 30 seconds.

1. (0.0 to 3.0 s) Hard water leaves its mark
2. (3.0 to 7.0 s) inside your machine, where it is hard to see.
3. (7.0 to 11.0 s) A self-contained automatic water softener treats the water first.
4. (11.0 to 15.0 s) How hard your water is depends on your area.
5. (15.0 to 19.0 s) CCW can tell you whether your machine needs a softener.
6. (19.0 to 23.0 s) Treating the water first helps protect the parts inside the machine.
7. (23.0 to 26.5 s) Describe your machine and where you work.
8. (26.5 to 30.0 s) Ask CCW about water softeners.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time         | Trigger words                   | Shot                                                                                                   | Source                                                                                                                                                                                                      |
| --- | ------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0.0 to 3.0   | "Hard water leaves its"         | Margot to camera in a bright CCW-style workshop, morning light                                         | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                                       |
| 2   | 3.0 to 7.0   | "inside your machine"           | A truckmount with its service panel open in a sunny driveway, a hand pointing at the water inlet       | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                                   |
| 3   | 7.0 to 11.0  | "self-contained automatic"      | A self-contained automatic water softener on a clean workshop bench, daylight                          | `generateImage` grounded on `carpet-cleaning/ccw-self-contained-automatic-water-softener`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                  |
| 4   | 11.0 to 15.0 | "depends on your area"          | A truckmount parked on a bright suburban street outside a home, hose ready                             | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                                   |
| 5   | 15.0 to 19.0 | "CCW can tell you"              | The softener standing beside a truckmount in a tidy bright workshop                                    | `generateImage` grounded on `carpet-cleaning/ccw-self-contained-automatic-water-softener` and `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s |
| 6   | 19.0 to 23.0 | "Treating the water first"      | Hands connecting a hose to the water softener in full sun                                              | `generateImage` grounded on `carpet-cleaning/ccw-self-contained-automatic-water-softener`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                  |
| 7   | 23.0 to 26.5 | "Describe your machine"         | Hands holding a phone beside a truckmount in a bright driveway                                         | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 3.5 s                                                                 |
| 8   | 26.5 to 30.0 | "Ask CCW about water softeners" | Margot to camera beside the product line-up; approved CCW logo file composited on the wall in the edit | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                                                |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Final shot: lower-third "Ask CCW about water softeners" with the CCW logo, composited in the edit. No other type.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Hard water leaves its mark inside your machine. A self-contained automatic water softener treats the water before it reaches the machine. Whether your area and your machine need one is a question for CCW: link in bio.

## Claims and sources

| Claim                                                                                                                        | Source                                           | Status            |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------- |
| Product names used: Self-contained Automatic Water Softener. No specification claimed                                        | Names as in calendar.json for this row           | Per calendar.json |
| Hard water leaves deposits inside a carpet cleaning machine                                                                  | No CCW source read for this. `[TOBY TO CONFIRM]` | Pending Toby      |
| A self-contained automatic water softener treats the water before it reaches the machine, and helps protect the parts inside | No CCW source read for this. `[TOBY TO CONFIRM]` | Pending Toby      |
| Water hardness depends on the area; whether a machine needs a softener is for CCW to advise                                  | No CCW source read for this. `[TOBY TO CONFIRM]` | Pending Toby      |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                                        |
| --------------------------------- | ------- | --------------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang, no rhetorical question                              |
| S2 Hook in 2 s                    | PASS    | Row hook opens the voiceover; no question                                   |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s, no shot repeated                                   |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                                 |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; image-to-video motion; ends on a finished or ready outcome |
| S6 Owned references only          | PASS    | Every shot names its reference subject from this row                        |
| S7 Side-by-side equipment check   | PENDING | At render                                                                   |
| S8 No invented claims             | PASS    | Only verified CCW facts used; unverified lines marked `[TOBY TO CONFIRM]`   |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim made; care steps are general and marked for Toby         |
| S10 AU English, metric, no emoji  | PASS    | No emoji; metric and DD/MM/YYYY only                                        |
| S11 One CTA with UTM link         | PASS    | Row cta and landing link                                                    |
| S12 CCW brand only                | PASS    | No other brand or competitor in words or frame                              |
