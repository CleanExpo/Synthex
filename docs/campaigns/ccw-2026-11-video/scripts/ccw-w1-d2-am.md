# ccw-w1-d2-am: Four placed beat two powerful

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Tuesday 10/11/2026, 07:00 AEST                                                                                                                   |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 21.1 s, 1080x1920, type in the world                                                                                                             |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the air mover range                                                                                                                          |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d2-am |
| Calendar slot key | 2026-11-17-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

CTA changed 08/11/2026 (orchestrator): CCW has no air mover buying guide. The air movers collection page has a
short "How to choose" section, but no guide by that name, so the CTA is now "See the air mover range" with the
same collection link.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 52 words; 20.7 s of voice, 21.1 s in all.
Concept A "Two in the middle" (blind judge pick, 08/11/2026). We own no photo of air movers running in a wet
room, so the story is product-led: owned catalogue photos of the units, cut from white, stand in owned photos
of empty carpeted rooms. Every line is CCW's own wording on the air movers page (see Claims). The two placement
lines marked `[TOBY TO CONFIRM]` below stay out of the voiceover.

1. (0 to 5.2 s) Four air movers in the right places will beat two powerful ones aimed at the middle of the room.
2. (6.0 to 8.4 s) Evaporation is a surface-area problem.
3. (9.0 to 13.7 s) That is why the number of units usually matters more than any one unit's specification.
4. (14.3 to 17.3 s) Placement matters as much as power.
5. (18.3 to 20.7 s) See the air mover range at CCW.

Held back until Toby confirms: "Each size covers a different part of the floor." and "Place them along the
wet edges."

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no
paid render). Products are cut from their white catalogue backgrounds by a border flood fill (no AI) and stand
flat on the floor with a contact shadow from their first frame. The angled Velo stack also casts a dark,
blurred copy of its own outline; the hook X-400 is cropped above its hanging cord (a crop, nothing generated). Plan: `lib/remotion/ccw/shot-plans.ts`; render:
`scripts/render-ccw-shortform.ts`.

| #   | Trigger words             | Shot                                                                                                        | Source photos                                                                  |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | "Four air movers"         | Hook: empty room, four units already placed, two at the back wall, two in front; "4 PLACED BEAT 2 POWERFUL" | carpet-cleaning-rotary-04; X-400, XPOWER low-profile, Velo, P-230AT            |
| 2   | "two powerful ones"       | Two XPOWER X-800s face each other in the middle of the room; "THE MIDDLE" on the carpet                     | carpet-cleaning-rotary-03; X-800 (side view)                                   |
| 3   | "Evaporation"             | The turn (6.0 s): floor-level carpet, "SURFACE AREA" lies on it and a ripple runs through it                | carpet-cleaning-extraction-02                                                  |
| 4   | "That is why"             | Real photo of a van packed with Velo units, slow push; "UNIT COUNT" in the same 3D floor type               | Dri-Eaz Velo catalogue photo (van)                                             |
| 5   | "any one"                 | One X-800 alone on the carpet by the hose; "COUNT OVER SPEC" on the floor                                   | carpet-cleaning-extraction-04; X-800 (front view)                              |
| 6   | "Placement"               | Four units spread across the floor at different depths; "PLACEMENT MATTERS" on the carpet                   | carpet-cleaning-rotary-02; Velo stack, XPOWER low-profile, Gale Force, P-230AT |
| 7   | "See the air mover range" | Scene end card, under 3 s: real CCW logo plate over the room, "See the air mover range", web address        | carpet-cleaning-rotary-04 (hook room), CCW logo                                |

## On-screen text

- Floor type (every shot before the end card): "4 PLACED BEAT 2 POWERFUL", "THE MIDDLE", "SURFACE AREA",
  "UNIT COUNT", "COUNT OVER SPEC", "PLACEMENT MATTERS". No caption boxes and no flat type.
- Captions: none burned in. Every beat carries its words as floor type (judge round 1 found the van captions
  read as fragments; the 08/11/2026 polish round moved "Unit count." from flat type into the floor type).
- End card: CCW logo, "See the air mover range", ccwonline.com.au.
- No full-frame text cards.

## Post caption

Four air movers in the right places will beat two powerful ones aimed at the middle of the room. Evaporation is a surface-area problem, so the number of units usually matters more than any one unit's specification. See the air mover range: link in bio.

## Claims and sources

The standards register (`docs/ree/restoration-video-training/standards-register.md`, origin/main from PR #1112,
read 08/11/2026) has no row on air mover numbers or placement, so every claim here maps to CCW's own page.
Page read 08/11/2026 through the Exa page reader; direct fetches returned HTTP 429.

| Claim (voiceover or screen)                                                                                  | Source: CCW air movers collection page, https://ccwonline.com.au/collections/airmovers, accessed 08/11/2026                                                    | Status              |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Four air movers in the right places beat two powerful ones aimed at the middle ("4 PLACED BEAT 2 POWERFUL")  | "four correctly placed units will beat two powerful ones aimed at the middle of the room every time"                                                           | Verified 08/11/2026 |
| Evaporation is a surface-area problem ("SURFACE AREA")                                                       | "Evaporation is a surface-area problem"                                                                                                                        | Verified 08/11/2026 |
| The number of units usually matters more than any one unit's specification ("UNIT COUNT", "COUNT OVER SPEC") | "the number of air movers usually matters more than the specification of any one of them"; "Count units per vehicle, not horsepower"                           | Verified 08/11/2026 |
| Placement matters as much as power ("PLACEMENT MATTERS")                                                     | Paraphrase of the first quote: placed units beat more powerful ones; also "low profile units often dry a house faster than more powerful ones aimed across it" | Verified 08/11/2026 |
| Mini, mid-size and low-profile units each cover a different part of the floor; place along the wet edges     | General placement advice, not a standard: `[TOBY TO CONFIRM]`. Not in the voiceover or on screen                                                               | Pending Toby        |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result | Note                                                                       |
| --------------------------------- | ------ | -------------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS   | Margot named; no slang                                                     |
| S2 Hook in 2 s                    | PASS   | Four units and "4 PLACED BEAT 2 POWERFUL" on screen from the first frame   |
| S3 Picture every ~4 s, no repeats | PASS   | 7 shots; no photo in more than two shots                                   |
| S4 Footage 75%+, Margot 10 to 28% | PASS   | All job or product photos; Margot is voice only                            |
| S5 Bright, moving, outcome        | PASS   | Daylight rooms; ends on the range                                          |
| S6 Owned references only          | PASS   | Every shot names its owned manifest subjects                               |
| S7 Side-by-side equipment check   | PASS   | Cut-outs are the catalogue photos themselves, unaltered apart from the cut |
| S8 No invented claims             | PASS   | Every line maps to CCW's air movers page; placement lines held for Toby    |
| S9 AS-IICRC procedure claims      | PASS   | No standard cited                                                          |
| S10 AU English, metric, no emoji  | PASS   |                                                                            |
| S11 One CTA with UTM link         | PASS   | "See the air mover range"; no buying-guide promise                         |
| S12 CCW brand only                | PASS   | Product brands appear only on CCW's own catalogue photos                   |
