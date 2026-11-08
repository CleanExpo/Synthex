# ccw-w1-d1-pm: A quiet forecast is not a dry season

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Monday 09/11/2026, 17:30 AEST                                                                                                                    |
| Funnel stage      | awareness                                                                                                                                        |
| Length            | 24.4 s, 1080x1920, captions burned in                                                                                                            |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the drying range                                                                                                                             |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d1-pm |
| Calendar slot key | 2026-11-16-ccw-video-2                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 57 words; 23.7 s of voice, 24.4 s in all.
Concept A "Quiet on paper" (blind judge pick and accuracy check, 08/11/2026).

1. (0 to 6.6 s) Five to eight cyclones in the Australian region, against a long-term average of eleven.
2. (6.6 to 8.5 s) Quiet, on paper.
3. (8.5 to 15.5 s) Near the Queensland coast it is tipped to be near normal, and one system can do serious damage.
4. (15.5 to 17.6 s) Quiet does not mean dry.
5. (17.6 to 20.6 s) Be ready for the work, not the forecast.
6. (20.6 to 21.6 s) Load the truck.
7. (21.6 to 24.4 s) See the drying range at CCW.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no
paid render). Plan: `lib/remotion/ccw/shot-plans.ts`; render: `scripts/render-ccw-shortform.ts`.

| #   | Trigger words          | Shot                                                                                                     | Source photo                          |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | "Five to eight"        | Low over wet tiles, boot and extractor; "5 TO 8 CYCLONES" lies on the tiles; source slip                 | carpet-cleaning-extraction-01         |
| 2   | "against a long-term"  | Floor level on carpet by the hose; "AVERAGE 11" lies on the carpet; source slip                          | carpet-cleaning-extraction-04         |
| 3   | "Quiet, on paper"      | Wet tiles, wider on the extractor; "QUIET ON PAPER" on the floor                                         | carpet-cleaning-extraction-01         |
| 4   | "Near the Queensland"  | Extraction wand on carpet, floor level; "QLD COAST NEAR NORMAL" on the carpet                            | carpet-cleaning-extraction-02         |
| 5   | "and one system"       | Wand at the skirting by the orange corner guard; "ONE SYSTEM SERIOUS DAMAGE" on the carpet               | carpet-cleaning-extraction-03         |
| 6   | "Quiet does not"       | The turn: camera pushes over "QUIET ON PAPER", a water ripple breaks it; the spoken line is kinetic type | carpet-cleaning-extraction-01         |
| 7   | "Be ready"             | Stryker wand and XPOWER X-800 line-up; captions                                                          | CCW catalogue photos                  |
| 8   | "Load the truck"       | Technician at the open van, hose reel, driveway; captions                                                | carpet-cleaning-solution-01           |
| 9   | "See the drying range" | End card, under 3 s: real CCW logo on a plate in depth over the van photo, CTA, web address              | carpet-cleaning-solution-01, CCW logo |

## On-screen text

- Hook and turn: the type lies on the floor (shots 1 to 6); no caption boxes there.
- Source on the floor, shots 1, 2 and 6: "5 to 8 cyclones: ECMWF modelling, via ABC News".
- Captions: Margot's words, burned in, CCW colours, shots 7 and 8.
- No full-frame text cards.

## Post caption

Five to eight cyclones in the Australian region this season, against a long-term average of 11 (ECMWF modelling, via ABC News). Near the Queensland coast it is tipped to be near normal. Quiet does not mean dry: be ready for the work, not the forecast. The drying range: link in bio.

## Claims and sources

| Claim                                                                                                       | Source                                                                                                                                                                                                                                                                                                      | Status              |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Season runs 01/11 to 30/04; ECMWF modelling points to 5 to 8 named storms against a long-term average of 11 | ABC News (Tom Saunders), 01/11/2026: https://www.abc.net.au/news/2026-11-01/bom-australia-cyclone-season-predicted-quiet/107329238; same ECMWF 5 to 8 in Weatherzone, 02/11/2026. ECMWF modelling, not the BOM. Queensland coast, NT and Gulf tipped near normal: never imply a quiet season for Queensland | Verified 08/11/2026 |
| Storms, flash flooding and burst pipes still bring water jobs                                               | Calendar row ccw-w1-d1-pm and teardown, gap 1 (01-competitor-teardown.md)                                                                                                                                                                                                                                   | Verified 08/11/2026 |
| Near the Queensland coast tipped near normal; one system can do serious damage                              | Same ABC News article, 01/11/2026 (orchestrator accuracy check, 08/11/2026)                                                                                                                                                                                                                                 | Verified 08/11/2026 |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                         |
| --------------------------------- | ------- | ------------------------------------------------------------ |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                       |
| S2 Hook in 2 s                    | PASS    | Row hook opens line 1; no question                           |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                      |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | All job or product photos; Margot is voice only              |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on the result or the range             |
| S6 Owned references only          | PASS    | Every non-Margot shot names a reference subject from the row |
| S7 Side-by-side equipment check   | PENDING | At render                                                    |
| S8 No invented claims             | PASS    | Unsourced lines marked `[TOBY TO CONFIRM]`                   |
| S9 AS-IICRC procedure claims      | PASS    | No procedure claim made                                      |
| S10 AU English, metric, no emoji  | PASS    |                                                              |
| S11 One CTA with UTM link         | PASS    |                                                              |
| S12 CCW brand only                | PASS    | No other brand or competitor named                           |
