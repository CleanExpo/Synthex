# ccw-w1-d3-am: Check the plug and the frequency

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Wednesday 18/11/2026, 07:00 AEST                                                                                                                      |
| Funnel stage      | awareness                                                                                                                                             |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                             |
| Call to action    | Check the specs on the product page                                                                                                                   |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w1-d3-am |
| Calendar slot key | 2026-11-18-ccw-video-1                                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 73 words, 30 seconds.

1. (0 to 3 s) Two machines can look the same
2. (3 to 7 s) and still not be the same machine.
3. (7 to 11 s) Equipment built for Australia is specified at 50 Hz with an Australian plug.
4. (11 to 15 s) An imported 60 Hz unit is not the same machine.
5. (15 to 19 s) The Maxforce ventilator is 50 Hz with an AU plug. The BD2500 is 230 volt.
6. (19 to 23 s) Check the plate before you buy.
7. (23 to 26.5 s) Plug, frequency and voltage are on it.
8. (26.5 to 30 s) Check the specs on the product page at CCW.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                   | Shot                                                                                                    | Source                                                                                                                                                                                       |
| --- | ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Two machines"                  | Margot to camera in a bright CCW-style warehouse aisle, morning light                                   | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                        |
| 2   | 3 to 7     | "look the same"                 | Maxforce ventilator on a clean warehouse floor beside a second, similar unit out of focus, slow push-in | `generateImage` grounded on `water-damage-restoration/ccw-dry-air-maxforce-ventilator-50hz-220v-au-plug`, then `submitGenerativeVideo` image-to-video                                        |
| 3   | 7 to 11    | "50 Hz with an Australian plug" | Maxforce ventilator data plate area with "50 Hz" on it (text composited in the edit, not generated)     | `generateImage` plate grounded on `water-damage-restoration/ccw-dry-air-maxforce-ventilator-50hz-220v-au-plug`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 4   | 11 to 15   | "imported 60 Hz"                | Hands turning the Maxforce ventilator to read its plate, workshop daylight                              | `generateImage` grounded on `water-damage-restoration/ccw-dry-air-maxforce-ventilator-50hz-220v-au-plug`, then `submitGenerativeVideo` image-to-video                                        |
| 5   | 15 to 19   | "The BD2500"                    | BD2500 dehumidifier running in a bright laundry, filter panel closed                                    | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-lgr-dehumidifier-bd2500-230volt`, then `submitGenerativeVideo` image-to-video                                              |
| 6   | 19 to 23   | "Check the plate"               | Close-up of hands reading the BD2500 rating plate at the back of the unit                               | `generateImage` grounded on `water-damage-restoration/ccw-dri-eaz-lgr-dehumidifier-bd2500-230volt`, then `submitGenerativeVideo` image-to-video                                              |
| 7   | 23 to 26.5 | "Plug, frequency and voltage"   | Dry, bright room with the Maxforce ventilator running quietly in the corner, the outcome                | `generateImage` grounded on `water-damage-restoration/ccw-dry-air-maxforce-ventilator-50hz-220v-au-plug`, then `submitGenerativeVideo` image-to-video                                        |
| 8   | 26.5 to 30 | "at CCW"                        | Margot beside the drying range; CCW logo composited on the wall                                         | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                                 |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 3: "50 Hz" on the plate (composited), 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Two machines can look the same and still not be the same machine. Equipment built for Australia is specified at 50 Hz with an AU plug. Check the plate before you buy. Specs are on each product page: link in bio.

## Claims and sources

| Claim                                                                                                                                               | Source                                                                                                                              | Status              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Equipment built for Australia is specified at 50 Hz with an AU plug; an imported 60 Hz unit is not the same machine; check the plate before you buy | Calendar row ccw-w1-d3-am; CCW air movers page: https://ccwonline.com.au/collections/airmovers ("check the plug and the frequency") | Verified 08/11/2026 |
| Maxforce ventilator is 50 Hz with an AU plug; BD2500 dehumidifier is 230 volt                                                                       | Product names on the calendar row ("50 Hz AU plug", "230 V"); confirm against current product pages: `[TOBY TO CONFIRM]`            | Pending Toby        |
| Plug, frequency and voltage are printed on the plate                                                                                                | General equipment practice: `[TOBY TO CONFIRM]`                                                                                     | Pending Toby        |

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
