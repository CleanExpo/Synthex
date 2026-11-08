# ccw-w4-d2-pm: Extract before you dry

| Field             | Value                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Tuesday 08/12/2026, 17:30 AEST                                                                                                   |
| Funnel stage      | consideration                                                                                                                    |
| Length            | 30 s, 1080x1920, captions burned in                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                        |
| Call to action    | See extraction tools                                                                                                             |
| Landing link      | https://ccwonline.com.au/?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w4-d2-pm |
| Calendar slot key | 2026-12-08-ccw-video-2                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 72 words, 30 seconds.

1. (0 to 3 s) Every litre you extract is a litre
2. (3 to 7 s) your air movers do not have to evaporate.
3. (7 to 11 s) Pull standing water out of carpet and underlay first.
4. (11 to 15 s) A flood extraction tool such as the Water Claw does that work.
5. (15 to 19 s) The SOS Pro floor tool comes with a flush kit.
6. (19 to 23 s) The Dri-Eaz Stryker extraction wand is in the range too.
7. (23 to 26.5 s) Once the water is out, set up the drying.
8. (26.5 to 30 s) See extraction tools at CCW. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words             | Shot                                                                                                 | Source                                                                                                                                    |
| --- | ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Every litre you extract" | Margot to camera in a bright CCW-style warehouse aisle, morning light                                | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                     |
| 2   | 3 to 7     | "air movers do not"       | Water-soaked carpet in a bright room with a large extraction tool gliding over it, daylight          | `generateImage` grounded on `water-damage-restoration/ccw-waterclaw-large-deluxe`, then `submitGenerativeVideo` image-to-video            |
| 3   | 7 to 11    | "standing water"          | Water Claw pulling standing water from carpet, low angle, slow push-in                               | `generateImage` grounded on `water-damage-restoration/ccw-waterclaw-large-deluxe`, then `submitGenerativeVideo` image-to-video            |
| 4   | 11 to 15   | "Water Claw"              | Water Claw large flood extraction tool on a damp carpet, detail of the tool head                     | `generateImage` grounded on `water-damage-restoration/ccw-waterclaw-large-deluxe`, then `submitGenerativeVideo` image-to-video            |
| 5   | 15 to 19   | "SOS Pro"                 | SOS Pro floor tool with its flush kit laid on a clean floor, bright garage                           | `generateImage` grounded on `water-damage-restoration/ccw-sos-pro-floor-tool-with-flush-kit`, then `submitGenerativeVideo` image-to-video |
| 6   | 19 to 23   | "Stryker"                 | Dri-Eaz Stryker extraction wand held over carpet, bright room                                        | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-extraction-wand-stryker`, then `submitGenerativeVideo` image-to-video   |
| 7   | 23 to 26.5 | "water is out"            | SOS Pro floor tool at work on a floor that now looks clean and drier, morning sun, the outcome       | `generateImage` grounded on `water-damage-restoration/ccw-sos-pro-floor-tool-with-flush-kit`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "See extraction tools"    | Margot beside the extraction tool display; approved CCW logo file composited on the wall in the edit | HeyGen avatar from Margot's voice (`heygen-director`); approved CCW logo file composited in the edit                                      |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Every litre you extract is a litre your air movers do not have to evaporate. Pull standing water out of carpet and underlay first, then set up drying. See the extraction tools: link in bio.

## Claims and sources

| Claim                                                                                                                                       | Source                                                                                    | Status       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| Extract standing water from carpet and underlay first, then set up drying; extracted water is water the air movers do not have to evaporate | Extraction-before-drying practice is not on the verified source list: `[TOBY TO CONFIRM]` | Pending Toby |
| Water Claw Large, SOS Pro Floor Tool with Flush Kit and Dri-Eaz Stryker extraction wand are in the CCW range                                | CCW product pages (named in the calendar row): `[TOBY TO CONFIRM]` current range          | Pending Toby |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                       |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                     |
| S2 Hook in 2 s                    | PASS    | Row hook is line 1; statement, no question                 |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                    |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished outcome                |
| S6 Owned references only          | PASS    | Every footage shot names a reference subject from this row |
| S7 Side-by-side equipment check   | PENDING | At render                                                  |
| S8 No invented claims             | PASS    | Procedure claim marked for Toby                            |
| S9 AS-IICRC procedure claims      | PENDING | Extraction-before-drying not yet traced to a standard row  |
| S10 AU English, metric, no emoji  | PASS    |                                                            |
| S11 One CTA with UTM link         | PASS    | Landing link copied from the calendar row                  |
| S12 CCW brand only                | PASS    | No other brand or competitor                               |
