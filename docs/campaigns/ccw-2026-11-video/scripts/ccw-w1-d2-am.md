# ccw-w1-d2-am: Four placed beat two powerful

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Tuesday 10/11/2026, 07:00 AEST                                                                                                                   |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 20.8 s, 1080x1920, type in the world                                                                                                             |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Read the buying guide on the air movers page                                                                                                     |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d2-am |
| Calendar slot key | 2026-11-17-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 55 words; 20.3 s of voice, 20.7 s in all.
Concept A "Two in the middle" (blind judge pick, 08/11/2026). We own no photo of air movers running in a wet
room, so the story is product-led: owned catalogue photos of the units, cut from white, stand in owned photos
of empty carpeted rooms. The two placement lines marked `[TOBY TO CONFIRM]` below stay out of the voiceover.

1. (0 to 5.1 s) Four air movers in the right places will beat two big ones aimed at the middle of the room.
2. (5.2 to 7.9 s) Evaporation is a surface-area problem.
3. (8.5 to 10.6 s) Spread the airflow across the wet area.
4. (11.1 to 16.0 s) That is why unit count often matters more than any one unit's rating.
5. (16.6 to 20.3 s) Read the buying guide on the air movers page at CCW.

Held back until Toby confirms: "Each size covers a different part of the floor." and "Place them along the
wet edges."

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no
paid render). Products are cut from their white catalogue backgrounds by a border flood fill (no AI) and stand
on the floor with a contact shadow. Plan: `lib/remotion/ccw/shot-plans.ts`; render:
`scripts/render-ccw-shortform.ts`.

| #   | Trigger words           | Shot                                                                                                                 | Source photos                                                                  |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | "Four air movers"       | Hook: empty room; two units already at the back wall, two land in front by 0.7 s; "4 PLACED BEAT 2 BIG" on the floor | carpet-cleaning-rotary-04; X-400, XPOWER low-profile, Velo, P-230AT            |
| 2   | "two big ones"          | Two XPOWER X-800s face each other in the middle of the room; "THE MIDDLE" on the carpet                              | carpet-cleaning-rotary-03; X-800 (side view)                                   |
| 3   | "Evaporation"           | The turn: floor-level carpet, "SURFACE AREA" lies on it and a ripple runs through it                                 | carpet-cleaning-extraction-02                                                  |
| 4   | "Spread the airflow"    | Four units spread across the floor at different depths; "SPREAD IT OUT" on the carpet                                | carpet-cleaning-rotary-02; Velo stack, XPOWER low-profile, Gale Force, P-230AT |
| 5   | "That is why"           | Real photo of a van packed with Velo units, slow push; "Unit count." as kinetic type                                 | Dri-Eaz Velo catalogue photo (van)                                             |
| 6   | "any one"               | One X-800 alone on the carpet by the hose; "ONE RATING" on the floor                                                 | carpet-cleaning-extraction-04; X-800 (front view)                              |
| 7   | "Read the buying guide" | Callback to the hook room, four units placed; "BUYING GUIDE" on the floor                                            | carpet-cleaning-rotary-04; same four unit photos as shot 1                     |
| 8   | "page at CCW"           | Scene end card, under 3 s: real CCW logo plate over the room, "Read the buying guide", web address                   | carpet-cleaning-rotary-02, CCW logo                                            |

## On-screen text

- Floor type (shots 1 to 4, 6, 7): "4 PLACED BEAT 2 BIG", "THE MIDDLE", "SURFACE AREA", "SPREAD IT OUT",
  "ONE RATING", "BUYING GUIDE". No caption boxes on those shots.
- Kinetic type, shot 5: "Unit count." Captions: none burned in on this cut; every beat carries its words as floor or kinetic type (judge round 1 found the van captions read as fragments).
- End card: CCW logo, "Read the buying guide", ccwonline.com.au.
- No full-frame text cards.

## Post caption

Four air movers in the right places will beat two big ones aimed at the middle of the room. Evaporation is a surface-area problem, so spread the airflow across the wet area: unit count often matters more than any one unit's rating. The buying guide is on the air movers page: link in bio.

## Claims and sources

| Claim                                                                                                                                                     | Source                                                                                                                                                     | Status              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Four placed air movers beat two big ones aimed at the middle; evaporation is a surface-area problem; unit count often matters more than one unit's rating | Calendar row ccw-w1-d2-am; CCW air movers page: https://ccwonline.com.au/collections/airmovers ("four correctly placed units will beat two powerful ones") | Verified 08/11/2026 |
| Mini, mid-size and low-profile units each cover a different part of the floor; place along the wet edges                                                  | General placement advice, not a standard: `[TOBY TO CONFIRM]`. Not in the voiceover or on screen                                                           | Pending Toby        |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result | Note                                                                       |
| --------------------------------- | ------ | -------------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS   | Margot named; no slang                                                     |
| S2 Hook in 2 s                    | PASS   | Units land and "4 PLACED BEAT 2 BIG" settles inside 0.4 s                  |
| S3 Picture every ~4 s, no repeats | PASS   | 8 shots, longest hold 3.3 s; no photo in more than two shots               |
| S4 Footage 75%+, Margot 10 to 28% | PASS   | All job or product photos; Margot is voice only                            |
| S5 Bright, moving, outcome        | PASS   | Daylight rooms; ends on the four placed units and the range                |
| S6 Owned references only          | PASS   | Every shot names its owned manifest subjects                               |
| S7 Side-by-side equipment check   | PASS   | Cut-outs are the catalogue photos themselves, unaltered apart from the cut |
| S8 No invented claims             | PASS   | Unsourced placement lines held back for Toby                               |
| S9 AS-IICRC procedure claims      | PASS   | No standard cited                                                          |
| S10 AU English, metric, no emoji  | PASS   |                                                                            |
| S11 One CTA with UTM link         | PASS   |                                                                            |
| S12 CCW brand only                | PASS   | Product brands appear only on CCW's own catalogue photos                   |
