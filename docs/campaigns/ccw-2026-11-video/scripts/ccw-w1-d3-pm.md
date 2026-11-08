# ccw-w1-d3-pm: The first 24 to 48 hours

| Field             | Value                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Wednesday 18/11/2026, 17:30 AEST                                                                                                                      |
| Funnel stage      | awareness                                                                                                                                             |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                                   |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                             |
| Call to action    | See the drying range                                                                                                                                  |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w1-d3-pm |
| Calendar slot key | 2026-11-18-ccw-video-2                                                                                                                                |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                       |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 74 words, 30 seconds.

1. (0 to 3 s) On a water job, the clock starts when the water stops.
2. (3 to 7 s) Australian workplace guidance says clean up wet areas within 24 to 48 hours.
3. (7 to 11 s) The water damage standard says start mitigation as soon as safely possible.
4. (11 to 15 s) So load the gear before the call comes.
5. (15 to 19 s) Water Claw and SOS Pro tools for extraction.
6. (19 to 23 s) X-800 air movers to start drying.
7. (23 to 26.5 s) Water out first, then air across the floor.
8. (26.5 to 30 s) See the drying range at CCW. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words                | Shot                                                                                                                                                    | Source                                                                                                                                                                          |
| --- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "On a water job"             | Margot to camera in a bright CCW-style warehouse aisle, morning light                                                                                   | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                           |
| 2   | 3 to 7     | "24 to 48 hours"             | Wall clock and a wet carpet corner in a bright room, with a Water Claw resting beside it; "24 to 48 hours" composited as an insert (text not generated) | `generateImage` plate grounded on `water-damage-restoration/ccw-waterclaw-med-dlx-with-injection`, then Blender insert (`blender_title.py`) composited in the edit, CCW colours |
| 3   | 7 to 11    | "as soon as safely possible" | Water Claw Medium Deluxe being set onto a wet carpet by a technician in daylight                                                                        | `generateImage` grounded on `water-damage-restoration/ccw-waterclaw-med-dlx-with-injection`, then `submitGenerativeVideo` image-to-video                                        |
| 4   | 11 to 15   | "load the gear"              | Open van bay in morning light with gear racked and ready, SOS Pro tool at the front                                                                     | `generateImage` grounded on `water-damage-restoration/ccw-sos-pro-sub-surface-extraction-tool`, then `submitGenerativeVideo` image-to-video                                     |
| 5   | 15 to 19   | "SOS Pro tools"              | SOS Pro sub surface extraction tool drawn across a carpet edge, close-up                                                                                | `generateImage` grounded on `water-damage-restoration/ccw-sos-pro-sub-surface-extraction-tool`, then `submitGenerativeVideo` image-to-video                                     |
| 6   | 19 to 23   | "X-800 air movers"           | XPOWER X-800 air movers lined up on a clean floor, slow push-in                                                                                         | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                        |
| 7   | 23 to 26.5 | "Water out first"            | Dry, clean living-room carpet with X-800 air movers running at the edge, the outcome                                                                    | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                        |
| 8   | 26.5 to 30 | "at CCW"                     | Margot beside the air mover line-up; CCW logo composited on the wall                                                                                    | HeyGen avatar; approved CCW logo file composited in the edit                                                                                                                    |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 2: "24 to 48 hours" as an insert, 4 s.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

On a water job, the clock starts when the water stops. Australian workplace guidance (SafeWork NSW) and the US EPA say to clean up wet areas within 24 to 48 hours, and the water damage standard says to start mitigation as soon as it is safe. Have the gear ready to load: link in bio.

## Claims and sources

| Claim                                         | Source                                                                              | Status              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------- |
| Clean up wet areas within 24 to 48 hours      | Standards register R29: Australian workplace guidance (SafeWork NSW) and the US EPA | Verified 08/11/2026 |
| Start mitigation as soon as safely possible   | Standards register R34: water damage standard (S500)                                | Verified 08/11/2026 |
| Extract water first, then dry with air movers | General sequence, not quoted from a standard: `[TOBY TO CONFIRM]`                   | Pending Toby        |

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
| S9 AS-IICRC procedure claims      | PASS    | R29 and R34 only; sequence line marked for Toby              |
| S10 AU English, metric, no emoji  | PASS    |                                                              |
| S11 One CTA with UTM link         | PASS    |                                                              |
| S12 CCW brand only                | PASS    | No other brand or competitor named                           |
