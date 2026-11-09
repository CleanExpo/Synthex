# ccw-w3-d4-pm: Automatic wastewater pump-out

| Field             | Value                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Thursday 26/11/2026, 17:30 AEST                                                                                                             |
| Funnel stage      | consideration                                                                                                                               |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                         |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                   |
| Call to action    | Ask CCW about AWDS                                                                                                                          |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w3-d4-pm |
| Calendar slot key | 2026-12-03-ccw-video-2                                                                                                                      |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                             |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 69 words, 30 seconds.

1. (0.0 to 3.0 s) A full recovery tank
2. (3.0 to 7.0 s) stops a job halfway through a room.
3. (7.0 to 11.0 s) An automatic wastewater disposal kit pumps the tank out as you work.
4. (11.0 to 15.0 s) You keep cleaning while the pump empties the tank for you.
5. (15.0 to 19.0 s) CCW lists the Automatic Wastewater Disposal System, or AWDS, kit.
6. (19.0 to 23.0 s) Always dispose of wastewater the way your local council requires.
7. (23.0 to 26.5 s) Tell CCW which truckmount you run, and which kit suits it.
8. (26.5 to 30.0 s) Ask CCW about AWDS.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time         | Trigger words                          | Shot                                                                                                        | Source                                                                                                                                                                                                                       |
| --- | ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0.0 to 3.0   | "A full recovery tank"                 | Margot to camera in a bright CCW-style workshop, morning light                                              | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                                                                        |
| 2   | 3.0 to 7.0   | "stops a job"                          | Top-down close-up of a truckmount recovery tank area, bright daylight, a full-tank moment before work stops | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                                                    |
| 3   | 7.0 to 11.0  | "pumps the tank out"                   | An AWDS auto pump-out kit fitted at the side of a truckmount, bright driveway                               | `generateImage` grounded on `carpet-cleaning/ccw-kit-awds-universal-auto-pump-out-ac12e-ss68-158s-comet` and `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s   |
| 4   | 11.0 to 15.0 | "keep cleaning"                        | A truckmount at the kerb with its hose run through a front door to a bright living room, work continuing    | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                                                    |
| 5   | 15.0 to 19.0 | "Automatic Wastewater Disposal System" | The AWDS kit laid out on a clean bench in daylight, slow orbit                                              | `generateImage` grounded on `carpet-cleaning/ccw-kit-awds-universal-auto-pump-out-ac12e-ss68-158s-comet`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                    |
| 6   | 19.0 to 23.0 | "local council requires"               | A tidy hose connection from the pump-out kit on a truckmount, neat and secured, bright light                | `generateImage` grounded on `carpet-cleaning/ccw-kit-awds-universal-auto-pump-out-ac12e-ss68-158s-comet`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 4 s                                                    |
| 7   | 23.0 to 26.5 | "which truckmount you run"             | A truckmount with the kit fitted, side view in a sunny driveway, ready for work                             | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-truckmount` and `carpet-cleaning/ccw-kit-awds-universal-auto-pump-out-ac12e-ss68-158s-comet`, then `submitGenerativeVideo` image-to-video 6 s, trimmed to 3.5 s |
| 8   | 26.5 to 30.0 | "Ask CCW about AWDS"                   | Margot to camera beside the product line-up; approved CCW logo file composited on the wall in the edit      | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                                                                 |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Final shot: lower-third "Ask CCW about AWDS" with the CCW logo, composited in the edit. No other type, and no disposal location is shown anywhere.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

A full recovery tank stops a job halfway through a room. An automatic wastewater disposal kit pumps the tank out as you work. Always dispose of wastewater the way your local council requires. Ask CCW about AWDS: link in bio.

## Claims and sources

| Claim                                                                                                       | Source                                                             | Status            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------- |
| Product names used: Automatic Wastewater Disposal System (AWDS) Kit. No specification claimed               | Names as in calendar.json for this row                             | Per calendar.json |
| An AWDS kit pumps the recovery tank out as you work; which kit suits which truckmount                       | No CCW source read for this. `[TOBY TO CONFIRM]`                   | Pending Toby      |
| Dispose of wastewater the way the local council requires. No disposal method or location is stated or shown | Wording per brief; council rules vary by area. `[TOBY TO CONFIRM]` | Pending Toby      |

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
