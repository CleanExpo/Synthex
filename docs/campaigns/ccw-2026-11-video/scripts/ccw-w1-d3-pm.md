# ccw-w1-d3-pm: The first 24 to 48 hours

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Wednesday 11/11/2026, 17:30 AEST                                                                                                                 |
| Funnel stage      | awareness                                                                                                                                        |
| Length            | about 26.5 s, 1080x1920, type in the world                                                                                                       |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the air mover range                                                                                                                          |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d3-pm |
| Calendar slot key | 2026-11-11-ccw-video-2                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

The call to action was "See the drying range"; the landing link is CCW's air movers collection, so it now
reads "See the air mover range" (orchestrator, 08/11/2026, rule 6b). Link and UTM unchanged. The collection
lists the "XPOWER X-800 Air Mover 1 hp with Carpet Clamp" (read 08/11/2026). The slot key was corrected to
2026-11-11, matching the calendar.

The calendar hook "On a water job, the clock starts when the water stops." is not used: no source says when
the 24 to 48 hours start. The video opens on the SafeWork NSW sentence itself. "Water out first, then air
across the floor" is dropped (no source); the voiceover names the tools without putting them in an order.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 64 words; 26.1 s of voice.
Concept A "Wet tiles, then the kit" (blind pick 42/60 against 40 and 28, 08/11/2026). Each line quotes a
source (see Claims).

1. (0 to 4.2 s) Clean up water damage promptly, within 24 to 48 hours.
2. (4.7 to 9.7 s) The water damage standard says mitigation should begin as soon as safely possible.
3. (10.3 to 15.0 s) The Water Claw pulls moisture out of carpet and pad without removing them.
4. (15.8 to 18.7 s) The SOS Pro's clear top shows what is coming out.
5. (18.9 to 22.9 s) The X-800 is designed to quickly and effectively dry your floors.
6. (23.3 to 26.1 s) See the air mover range at CCW.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no paid
render). Products are cut from their white catalogue backgrounds by a border flood fill (no AI) and sit flat on
dry carpet with a contact shadow from their first frame (`place`). No unit is shown on the wet tiles or running
in a wet room. Plan: `lib/remotion/ccw/shot-plans.ts`; render: `scripts/render-ccw-shortform.ts`.

| #   | Trigger words               | Shot                                                                                                            | Source photos                                          |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | "Clean up water"            | Hook: low over real wet tiles and work boots; "CLEAN UP PROMPTLY" slams onto the wet floor                      | carpet-cleaning-extraction-01                          |
| 2   | "within 24"                 | Hard cut to carpet, a wand at the skirting; "WITHIN 24 TO 48 HOURS", slip "Source: SafeWork NSW, Mould at work" | carpet-cleaning-extraction-02                          |
| 3   | "The water damage standard" | The turn: the next room's carpet; "BEGIN MITIGATION", slip "Source: IICRC S500 water damage standard"           | carpet-cleaning-extraction-03                          |
| 4   | "as soon as"                | Same room, the camera moves to the doorway; "AS SOON AS SAFELY POSSIBLE"                                        | carpet-cleaning-extraction-03                          |
| 5   | "The Water Claw"            | An operator standing on the Water Claw on dry carpet; "OUT OF CARPET AND PAD"                                   | carpet-cleaning-rotary-04; Water Claw, operator photo  |
| 6   | "without removing"          | The Water Claw upright by the real hose on carpet; "WITHOUT LIFTING THE PAD"                                    | carpet-cleaning-extraction-04; Water Claw, full view   |
| 7   | "The SOS"                   | The SOS Pro and its pack on carpet by the skirting; "SOS PRO: CLEAR TOP"                                        | carpet-cleaning-result-01; SOS Pro, without handle bar |
| 8   | "shows what"                | The SOS Pro from the other side on groomed carpet; "SEE WHAT IS COMING OUT"                                     | carpet-cleaning-grooming-01; SOS Pro, with handle      |
| 9   | "The X-800"                 | The X-800 on carpet in an empty room; "XPOWER X-800"                                                            | carpet-cleaning-rotary-02; X-800, side                 |
| 10  | "dry your floors"           | The X-800 from the front in a second room; "DESIGNED TO DRY YOUR FLOORS"                                        | carpet-cleaning-rotary-03; X-800, front                |
| 11  | "air mover range"           | Scene end card: CCW logo plate over the carpet edge, "See the air mover range", web address                     | carpet-cleaning-result-02, CCW logo                    |

No photo is in more than two shots.

## On-screen text

- Floor type: "CLEAN UP PROMPTLY", "WITHIN 24 TO 48 HOURS", "BEGIN MITIGATION", "AS SOON AS SAFELY POSSIBLE",
  "OUT OF CARPET AND PAD", "WITHOUT LIFTING THE PAD", "SOS PRO: CLEAR TOP", "SEE WHAT IS COMING OUT",
  "XPOWER X-800", "DESIGNED TO DRY YOUR FLOORS".
- Source slips on the floor: "Source: SafeWork NSW, Mould at work", "Source: IICRC S500 water damage standard".
- Captions: none burned in; every shot carries its words as floor type.
- End card: CCW logo, "See the air mover range", ccwonline.com.au.
- No full-frame text cards.

## Post caption

Clean up water damage promptly, within 24 to 48 hours (SafeWork NSW). The water damage standard says mitigation should begin as soon as safely possible. The Water Claw pulls moisture out of carpet and pad without removing them, the SOS Pro's clear top shows what is coming out, and the X-800 is designed to quickly and effectively dry your floors. See the air mover range: link in bio.

## Claims and sources

Web pages read 08/11/2026 through the Exa page reader (direct fetches return HTTP 429). Each claim quotes the
source sentence it rests on.

| Claim                                                                                                                                      | Source                                                                                                                                                                                                                                                                               | Status              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Clean up water damage promptly, within 24 to 48 hours. On screen: CLEAN UP PROMPTLY; WITHIN 24 TO 48 HOURS                                 | SafeWork NSW, "Mould at work", Preventing mould growth: "clean up wet areas and water damage promptly (within 24-48 hours)" https://www.safework.nsw.gov.au/hazards-a-z/mould (accessed 08/11/2026). Standards register R29 (VERIFIED).                                              | Verified 08/11/2026 |
| The water damage standard says mitigation should begin as soon as safely possible. On screen: BEGIN MITIGATION; AS SOON AS SAFELY POSSIBLE | Standards register R34 (VERIFIED), ANSI/IICRC S500:2021 reference guide ch. 2: "mitigation should begin as soon as safely possible, or microbial contaminants can grow and amplify" https://iicrc.org/s500/ (Unite Group's copy; register on main, PR #1112)                         | Verified 08/11/2026 |
| The Water Claw pulls moisture out of carpet and pad without removing them. On screen: OUT OF CARPET AND PAD                                | CCW Water Claw Medium Deluxe with Injection page: "pulling moisture out of carpet and pad without removing them" https://www.ccwonline.com.au/products/waterclaw-med-dlx-with-injection (accessed 08/11/2026)                                                                        | Verified 08/11/2026 |
| On screen: WITHOUT LIFTING THE PAD                                                                                                         | Same page, How Sub-Surface Extraction Works: "The vacuum from your extractor pulls water up through the pad and the carpet together, so the pad does not have to be lifted or removed." https://www.ccwonline.com.au/products/waterclaw-med-dlx-with-injection (accessed 08/11/2026) | Verified 08/11/2026 |
| Picture: an operator standing on the Water Claw                                                                                            | Same page: "The Water Claw sits flat on wet carpet and the operator stands on it." https://www.ccwonline.com.au/products/waterclaw-med-dlx-with-injection (accessed 08/11/2026)                                                                                                      | Verified 08/11/2026 |
| The SOS Pro's clear top shows what is coming out. On screen: SOS PRO: CLEAR TOP; SEE WHAT IS COMING OUT                                    | CCW SOS Pro page, FAQ "SOS PRO or Water Claw?": "the SOS PRO has the clear top so you can see what is coming out." https://www.ccwonline.com.au/products/sos-pro-sub-surface-extraction-tool (accessed 08/11/2026)                                                                   | Verified 08/11/2026 |
| The X-800 is designed to quickly and effectively dry your floors. On screen: XPOWER X-800; DESIGNED TO DRY YOUR FLOORS                     | CCW X-800 page: "Its tough ABS plastic housing is heavy duty, and the unit is designed to quickly and effectively dry your floors." https://www.ccwonline.com.au/products/xpower-airmover-x800-1hp-w-clamp (accessed 08/11/2026)                                                     | Verified 08/11/2026 |
| See the air mover range: the landing link is CCW's air movers collection, which lists the X-800                                            | CCW air movers page lists "XPOWER X-800 Air Mover 1 hp with Carpet Clamp" https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                                                                                                       | Verified 08/11/2026 |

Held back: "On a water job, the clock starts when the water stops" (no source says when the window starts) and
"Water out first, then air across the floor" (no source for the order). No standard is cited beyond R29 and R34.

## Rule score

Self-score on the cut, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result | Note                                                               |
| --------------------------------- | ------ | ------------------------------------------------------------------ |
| S1 Margot, plain English          | PASS   | Margot named; no slang                                             |
| S2 Hook in 2 s                    | PASS   | Floor type slams onto the wet tiles at 0.3 s                       |
| S3 Picture every ~4 s, no repeats | PASS   | 11 shots; no photo in more than two shots                          |
| S4 Footage 75%+, Margot 10 to 28% | PASS   | All job or product photos; Margot is voice only                    |
| S5 Bright, moving, outcome        | PASS   | Daylight rooms; ends on the range                                  |
| S6 Owned references only          | PASS   | Every shot names its owned manifest subjects                       |
| S7 Side-by-side equipment check   | PASS   | Cut-outs are the catalogue photos themselves                       |
| S8 No invented claims             | PASS   | Every line quoted; the calendar hook and the order line held back  |
| S9 AS-IICRC procedure claims      | PASS   | R29 and R34 only, quoted                                           |
| S10 AU English, metric, no emoji  | PASS   |                                                                    |
| S11 One CTA with UTM link         | PASS   | CTA matches the collection it links to                             |
| S12 CCW brand only                | PASS   | Product brands appear only on CCW's own catalogue photos and pages |
