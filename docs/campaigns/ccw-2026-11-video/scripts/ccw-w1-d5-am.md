# ccw-w1-d5-am: Count units per vehicle

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Friday 13/11/2026, 07:00 AEST                                                                                                                    |
| Funnel stage      | consideration                                                                                                                                    |
| Length            | 26.5 s, 1080x1920, type in the world                                                                                                             |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the air movers                                                                                                                               |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d5-am |
| Calendar slot key | 2026-11-13-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

Status: PREVIEW. Rewritten 08/11/2026. Every line now quotes CCW's air movers collection page or the X-600AC
product page. The draft hook "The air mover that fits in the van is the one that dries the house" is cut: no CCW or
XPOWER sentence says it (the collection page's nearest line says low profile units often dry a house faster, a
different claim). "Count units per vehicle, not horsepower" and "Stackability and footprint decide how many jobs a
crew covers in a day" are kept: both are CCW's own sentences on the collection page. The draft's "More units on board
means more rooms covered" (marked for Toby) and "Check how many of each will load on your van" are cut as unsourced.

Products. The XPOWER X-600AC with clamp stays. The XPOWER X-800 Multi Drying Kit is replaced by the XPOWER X-800 Air
Mover with Carpet Clamp: the owned kit photo is byte-identical to the X-400 kit photo, so it cannot be shown as the
X-800 kit, and the kit's page says nothing about stacking, footprint or units per vehicle. The X-600AC page compares
the two units on stacking, which is this video's point.

Picture of the van. The hook and the "stackability" shot use CCW's catalogue photo of Dri-Eaz Velo units stacked in
a van, named on a floor slip ("Pictured: Dri-Eaz Velo") so it never reads as the XPOWER units. CCW's collection
lists the Dri-Eaz Velo low profile airmover. No XPOWER unit shares a frame with the Velo units.

The lines that say what not to buy ("not horsepower", "will not nest", "costs more than its wattage gains") sit on
bare floor with no unit, so no product is made the one that does not nest. No wattage is stated for any unit.

The draft's HeyGen avatar and generated shots are dropped: real owned photos only, no paid render.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 63 words; voiced 08/11/2026 (26.1 s), no pauses trimmed.
Concept A "The van count" (blind pick 40/60 against 28 and 27, 08/11/2026). Each line quotes a source (see Claims).

1. (0 to 2.8 s) Count units per vehicle, not horsepower.
2. (3.6 to 7.9 s) Stackability and footprint decide how many jobs a crew covers in a day.
3. (8.3 to 12.1 s) A unit that will not nest costs you more than its wattage gains.
4. (12.7 to 18.7 s) The X-600AC: stackable up to 4 units, 40 by 40 by 42 centimetres.
5. (19.1 to 23.2 s) The X-800 moves more air, but stacks 3 high rather than 4.
6. (23.8 to 26.1 s) See the air movers at CCW.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no paid render).
The X-600AC and X-800 are cut from their white catalogue photos by the border flood fill (no AI) and stand flat on
the carpet with a contact shadow from their first frame; neither is mirrored (both carry print). Plan:
`lib/remotion/ccw/shot-plans.ts`; render: `scripts/render-ccw-shortform.ts`.

| #   | Time         | Trigger words        | Shot                                                                                         | Source photos                        |
| --- | ------------ | -------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 0 to 1.6     | "Count units"        | Hook: the van stacked five high; "COUNT UNITS / PER VEHICLE" slams onto its floor; Velo slip | Velo van photo 29703296135           |
| 2   | 1.6 to 3.5   | "not horsepower"     | Bare carpet, no unit; "NOT / HORSEPOWER"                                                     | carpet-cleaning-grooming-01          |
| 3   | 3.5 to 5.4   | "Stackability"       | Tighter on one stacked column in the van; "STACKABILITY / AND FOOTPRINT"; Velo slip          | Velo van photo 29703296135 (crop)    |
| 4   | 5.4 to 8.2   | "how many jobs"      | A rotary machine at work in a job room; "HOW MANY JOBS / A CREW COVERS / IN A DAY"           | carpet-cleaning-rotary-02            |
| 5   | 8.2 to 9.6   | "A unit that"        | The turn: "WILL NOT / NEST" alone on an empty floor, and it breaks up                        | carpet-cleaning-result-02            |
| 6   | 9.6 to 12.7  | "costs you more"     | Empty carpet by the skirting; "COSTS MORE THAN / ITS WATTAGE GAINS"                          | carpet-cleaning-result-01            |
| 7   | 12.7 to 16.2 | "The X-600AC"        | The X-600AC on the carpet; "X-600AC / STACKABLE UP TO 4"                                     | carpet-cleaning-rotary-02; X-600AC   |
| 8   | 16.2 to 19.0 | "40 by 40"           | The X-600AC, larger, in a new room; "40 X 40 X 42 CM"                                        | carpet-cleaning-rotary-03; X-600AC   |
| 9   | 19.0 to 20.9 | "The X-800"          | The X-800 front on; "X-800 / MOVES MORE AIR"                                                 | carpet-cleaning-extraction-03; X-800 |
| 10  | 20.9 to 23.8 | "but stacks"         | The X-800 three-quarter; "X-800 / STACKS 3 HIGH"                                             | carpet-cleaning-extraction-02; X-800 |
| 11  | 23.8 to 26.5 | "See the air movers" | Scene end card: CCW logo plate, "See the air movers", web address                            | carpet-cleaning-rotary-04, CCW logo  |

No photo is in more than two shots; the longest hold is 3.5 s (shot 7). Catalogue IDs: X-600AC 20568724865177; X-800
20568158994585 (front) and 20568160796825 (three-quarter); Dri-Eaz Velo van 29703296135.

## On-screen text

- Floor type: "COUNT UNITS / PER VEHICLE", "NOT / HORSEPOWER", "STACKABILITY / AND FOOTPRINT", "HOW MANY JOBS / A CREW
  COVERS / IN A DAY", "WILL NOT / NEST", "COSTS MORE THAN / ITS WATTAGE GAINS", "X-600AC / STACKABLE UP TO 4", "40 X 40 X 42
  CM", "X-800 / MOVES MORE AIR", "X-800 / STACKS 3 HIGH".
- Slip: "Pictured: Dri-Eaz Velo" (floor, shots 1 and 3).
- Captions: none burned in; every shot carries its words as floor type.
- End card: CCW logo, "See the air movers", ccwonline.com.au.
- No full-frame text cards.

## Post caption

Count units per vehicle, not horsepower. Stackability and footprint decide how many jobs a crew covers in a day. The XPOWER X-600AC is stackable up to 4 units at 40 x 40 x 42 cm; the X-800 moves more air but stacks 3 high rather than 4. See the air movers: link in bio.

## Claims and sources

Web pages read 08/11/2026 through the Exa page reader (direct fetches of ccwonline.com.au return HTTP 429). Each
claim quotes the source sentence it rests on.

| Claim                                                                                                                                               | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Status              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Count units per vehicle, not horsepower. On screen: COUNT UNITS PER VEHICLE; NOT HORSEPOWER                                                         | CCW Airmovers collection, How to choose: "Count units per vehicle, not horsepower." https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                                                                                                                                                                                                                                                                                              | Verified 08/11/2026 |
| Stackability and footprint decide how many jobs a crew covers in a day. On screen: STACKABILITY AND FOOTPRINT; HOW MANY JOBS A CREW COVERS IN A DAY | CCW Airmovers collection, How to choose: "Stackability and footprint decide how many jobs a crew covers in a day." https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                                                                                                                                                                                                                                                               | Verified 08/11/2026 |
| A unit that will not nest costs you more than its wattage gains. On screen: WILL NOT NEST; COSTS MORE THAN ITS WATTAGE GAINS                        | CCW Airmovers collection, How to choose: "A unit that will not nest costs you more than its wattage gains." https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026). Shown on bare floor, with no unit.                                                                                                                                                                                                                                                                  | Verified 08/11/2026 |
| The X-600AC is stackable up to 4 units. On screen: X-600AC STACKABLE UP TO 4 (units)                                                                | CCW XPOWER X-600AC page, title "XPOWER X-600AC Air Mover 3/4 hp with Carpet Clamp"; Features: "Stackable up to 4 units"; Specifications: "Stacking: Up to 4 units". https://www.ccwonline.com.au/products/xpower-airmover-x600ac-3-4hp-inc-clamp (accessed 08/11/2026)                                                                                                                                                                                                                | Verified 08/11/2026 |
| The X-600AC measures 40 by 40 by 42 centimetres. On screen: 40 X 40 X 42 CM                                                                         | CCW XPOWER X-600AC page, Specifications: "Unit size: 40 x 40 x 42 cm (L x W x H)". https://www.ccwonline.com.au/products/xpower-airmover-x600ac-3-4hp-inc-clamp (accessed 08/11/2026)                                                                                                                                                                                                                                                                                                 | Verified 08/11/2026 |
| The X-800 moves more air, but stacks 3 high rather than 4. On screen: X-800 MOVES MORE AIR; X-800 STACKS 3 HIGH                                     | CCW XPOWER X-600AC page, FAQ "X-600AC or X-800?": "The X-800 moves more air (3200 vs 2400 CFM) but weighs more (11.2 vs 8.6 kg) and stacks 3 high rather than 4." https://www.ccwonline.com.au/products/xpower-airmover-x600ac-3-4hp-inc-clamp (accessed 08/11/2026). The voiceover drops the weight clause for length; the airflow and stacking clauses keep the page's wording. The X-800 photos are the owned catalogue photos of "XPOWER X-800 Air Mover 1 hp with Carpet Clamp". | Verified 08/11/2026 |
| The van units are Dri-Eaz Velo. On screen: slip "Pictured: Dri-Eaz Velo"                                                                            | CCW Airmovers collection: "the Dri-Eaz Velo low profile airmover" (range paragraph) and the listing "Dri-Eaz Velo Low Profile Airmover 230V". https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026). The photo is CCW's catalogue photo for that product (manifest subject ccw-dri-eaz-velo-low-profile-air-mover).                                                                                                                                                    | Verified 08/11/2026 |
| See the air movers: the landing link is CCW's Airmovers collection, which lists both units                                                          | CCW Airmovers collection lists "XPOWER X-600AC Air Mover 3/4 hp with Carpet Clamp" and "XPOWER X-800 Air Mover 1 hp with Carpet Clamp". https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                                                                                                                                                                                                                                          | Verified 08/11/2026 |

Held back:

- "The air mover that fits in the van is the one that dries the house." No source. The collection page's "low profile
  units often dry a house faster than more powerful ones aimed across it" is about low profile units, not van fit.
- "More units on board means more rooms covered on every job" and "Check how many of each will load on your van". No
  source.
- XPOWER X-800 Multi Drying Kit. Its owned photo is byte-identical to the X-400 kit photo (same md5), and its page has
  no stacking or footprint line. Not shown.
- Airflow figures in CFM (imperial) and every wattage. The collection page lists the PL-700A at 2400 W while its
  product listing says 240 W; no wattage is stated for any unit.
- "Clamps are not an accessory on directed drying. The X600 and X800 ship with clamps..." Sourced; cut for length.

## Rule score

Self-score on the cut, 08/11/2026 (see `03-rule-score.md`). The file is labelled PREVIEW.

Blind judges scored the delivered cuts on 1 fps frames only: the first cut 38/60 (the stack lines were small slips on
the units: moved into the floor type), the final cut 31/60 by a second judge. Both name the same gaps: the middle
(2 to 12 s) is bare floor under the "not horsepower", "will not nest" and "wattage" lines, and no XPOWER unit is ever
shown stacked. Their suggested fix of putting "WILL NOT NEST" or "NOT HORSEPOWER" over an X-800 is refused: it would
say that unit does not nest, which its own page contradicts. What closes the gap is photos we do not own. Photo
request for Toby: an X-600AC stack of 4, an X-800 stack of 3, XPOWER units loaded in a CCW or customer van, and the
real X-800 Multi Drying Kit.

| Rule                              | Result  | Note                                                                 |
| --------------------------------- | ------- | -------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                               |
| S2 Hook in 2 s                    | PASS    | "COUNT UNITS / PER VEHICLE" slams down at 0.3 s on the stacked van   |
| S3 Picture every ~4 s, no repeats | PASS    | 11 shots, longest hold 3.5 s; no photo in more than two shots        |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | All job or product photos; Margot is voice only                      |
| S5 Bright, moving, outcome        | PARTIAL | Daylight rooms; no owned photo of an XPOWER unit stacked or in a van |
| S6 Owned references only          | PASS    | Every shot names its owned manifest subjects                         |
| S7 Side-by-side equipment check   | PASS    | The cut-outs are the catalogue photos themselves, not mirrored       |
| S8 No invented claims             | PASS    | Every line quoted; the draft hook and the drying kit held back       |
| S9 Procedure claims               | PASS    | None made                                                            |
| S10 AU English, metric, no emoji  | PASS    | cm only; no CFM                                                      |
| S11 One CTA with UTM link         | PASS    | CTA matches the Airmovers collection it links to                     |
| S12 CCW brand only                | PASS    | XPOWER and Dri-Eaz are CCW-listed brands; no competitor named        |
