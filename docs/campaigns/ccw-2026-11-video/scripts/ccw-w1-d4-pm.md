# ccw-w1-d4-pm: The pre-filter protects the HEPA

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Thursday 12/11/2026, 17:30 AEST                                                                                                                  |
| Funnel stage      | retention                                                                                                                                        |
| Length            | 23.0 s, 1080x1920, type in the world                                                                                                             |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See Razorback filters and spares                                                                                                                 |
| Landing link      | https://ccwonline.com.au/collections/razorback?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d4-pm |
| Calendar slot key | 2026-11-12-ccw-video-2                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

The slot key was 2026-11-19 in the draft; the calendar says 2026-11-12 and this file now matches it.

Product fit (read 08/11/2026). The calendar paired the Razorback MaxxGuard 550 with a "Dri-Eaz Velo HEPA
Pre-Filter". That filter belongs to the Dri-Eaz Velo HEPA add-on kit, not the Razorback unit. CCW sells two
filters for the MaxxGuard 550: the "Pre-filter (5 PACK) for Razorback MaxxGuard 550 & 550UV" (MERV-10) and the
"HEPA/Activated Carbon Filter for Razorback MaxxGuard 550 & MaxxGuard 550UV". The calendar row now names those
two, and its reference subjects drop both Dri-Eaz subjects. We own no photo of either Razorback filter, so no
filter is shown: the type names the stages and the picture is the unit they sit in. No other brand's filter
appears. Photo request for Toby: the MERV-10 pre-filter and the HEPA/activated carbon filter for the MaxxGuard
550, ideally one new and one loaded pre-filter side by side.

HeyGen and generated shots in the draft are dropped. The calendar hook "The cheapest filter in an air scrubber
protects the most expensive one." is not used: no CCW page compares the two prices in those words (and CCW's
listed prices on 08/11/2026 do not make the gap obvious, see Held back). "Change on schedule" is replaced by
CCW's own interval, quoted.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 55 words; 22.6 s of voice (voiced 08/11/2026).
Concept A "The stack" (blind pick 40/60 against 36 and 30, 08/11/2026). Each line quotes a source (see Claims).

1. (0 to 2.0 s) The pre-filter protects the HEPA.
2. (2.5 to 7.2 s) It takes the coarse dust so the expensive HEPA filter behind it does not have to.
3. (8.0 to 14.3 s) Running without it, or past its life, is what turns a cheap filter change into an expensive one.
4. (15.4 to 18.8 s) CCW recommends changing it every two to three months.
5. (19.4 to 22.6 s) See Razorback filters and spares at CCW.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no paid
render). The MaxxGuard 550 is cut from its catalogue render by the border flood fill (no AI), then clipped to its
own outline (`matte`, measured from the photo) so the render's baked grey floor plate is dropped, and stands flat
on dry carpet with a footprint or contact shadow from its first frame. The room photo is softened slightly
(`sceneBlur` 1.2 px); the unit and the type stay sharp. Plan: `lib/remotion/ccw/shot-plans.ts`; render:
`scripts/render-ccw-shortform.ts`.

The winning concept was set in a commercial office; every office photo has a red extraction wand in frame (the
judge's own top risk), so the stack device runs in owned residential job rooms instead.

| #   | Time         | Trigger words        | Shot                                                                                        | Source photos                                     |
| --- | ------------ | -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | 0 to 2.5     | "The pre-filter"     | Hook: the MaxxGuard in an empty room; "THE PRE-FILTER / PROTECTS THE HEPA" slams down       | carpet-cleaning-rotary-04; MaxxGuard 550, photo A |
| 2   | 2.5 to 5.5   | "It takes"           | The unit front-on by the skirting; "FIRST STAGE: / THE PRE-FILTER"                          | carpet-cleaning-extraction-02; photo C            |
| 3   | 5.5 to 7.9   | "behind it"          | The unit from the control-panel side; "HEPA / ACTIVATED / CARBON FILTER"                    | carpet-cleaning-result-01; photo B                |
| 4   | 7.9 to 10.8  | "Running without"    | The turn: no unit, the type alone by a corner guard, and it breaks up: "RUNNING WITHOUT IT" | carpet-cleaning-result-01 (second crop)           |
| 5   | 10.8 to 12.4 | "turns a cheap"      | The unit in a new room; "A CHEAP / FILTER CHANGE"                                           | carpet-cleaning-rotary-02; photo A                |
| 6   | 12.4 to 15.3 | "into an expensive"  | The unit front-on by the rug; "INTO AN / EXPENSIVE ONE"                                     | carpet-cleaning-result-02; photo C                |
| 7   | 15.3 to 17.4 | "CCW recommends"     | The unit on groomed carpet; "MAXXGUARD 550 / PRE-FILTER"                                    | carpet-cleaning-grooming-01; photo B              |
| 8   | 17.4 to 20.2 | "every two"          | Hose by the skirting; "EVERY 2 TO / 3 MONTHS", slip "Source: CCW pre-filter listing"        | carpet-cleaning-extraction-04                     |
| 9   | 20.2 to 23.0 | "filters and spares" | Scene end card: CCW logo plate, "See Razorback filters and spares", web address             | carpet-cleaning-result-02, CCW logo               |

No photo is in more than two shots; the longest hold is 3.0 s. MaxxGuard photos (catalogue IDs): A
31894806921369, B 31894806954137, C 31894806986905. None is mirrored (the units carry printed labels).

## On-screen text

- Floor type: "THE PRE-FILTER PROTECTS THE HEPA", "FIRST STAGE: THE PRE-FILTER", "HEPA / ACTIVATED CARBON
  FILTER", "RUNNING WITHOUT IT", "A CHEAP FILTER CHANGE", "INTO AN EXPENSIVE ONE", "MAXXGUARD 550 PRE-FILTER",
  "EVERY 2 TO 3 MONTHS".
- Source slip on the floor: "Source: CCW pre-filter listing".
- Captions: none burned in; every shot carries its words as floor type.
- End card: CCW logo, "See Razorback filters and spares", ccwonline.com.au.
- No full-frame text cards.

## Post caption

The pre-filter protects the HEPA. It takes the coarse dust so the expensive HEPA/activated carbon filter behind it does not have to, and running without it, or past its life, is what turns a cheap filter change into an expensive one. CCW recommends changing the MaxxGuard 550 pre-filter every 2 to 3 months. See Razorback filters and spares: link in bio.

## Claims and sources

Web pages read 08/11/2026 through the Exa page reader (direct fetches return HTTP 429). Each claim quotes the
source sentence it rests on. The MaxxGuard 550 product page itself could not be read (the reader returned
CRAWL_NOT_FOUND); nothing below rests on it.

| Claim                                                                                                                                                                        | Source                                                                                                                                                                                                                                                                                                                                                                                     | Status              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| The pre-filter protects the HEPA. On screen: THE PRE-FILTER PROTECTS THE HEPA                                                                                                | CCW Razorback collection, How to choose: "Air scrubber filters are staged. The pre-filter protects the HEPA." https://ccwonline.com.au/collections/razorback (accessed 08/11/2026)                                                                                                                                                                                                         | Verified 08/11/2026 |
| It takes the coarse dust so the expensive HEPA filter behind it does not have to. On screen: FIRST STAGE: THE PRE-FILTER                                                     | CCW MaxxGuard pre-filter page: "The pre-filter is the first stage in the machine. It takes the coarse dust so the expensive HEPA/activated carbon filter behind it does not have to." https://ccwonline.com.au/products/pre-filter-g3-mg550-mg550uv-5pack-365mm-x-346mm-x-20mm (accessed 08/11/2026). Spoken as "HEPA filter"; the same page's FAQ calls it "the HEPA filter it protects". | Verified 08/11/2026 |
| On screen: HEPA / ACTIVATED CARBON FILTER, over the MaxxGuard 550                                                                                                            | CCW HEPA filter page title: "HEPA/Activated Carbon Filter for Razorback MaxxGuard 550 & MaxxGuard 550UV" https://ccwonline.com.au/products/hepa-activated-carbon-filter-mg550-mg550uv-sold-as-each-3-per-box-9-per-carton (accessed 08/11/2026)                                                                                                                                            | Verified 08/11/2026 |
| Running without it, or past its life, is what turns a cheap filter change into an expensive one. On screen: RUNNING WITHOUT IT; A CHEAP FILTER CHANGE; INTO AN EXPENSIVE ONE | CCW Razorback collection, How to choose: "Running without it, or past its life, is what turns a cheap filter change into an expensive one." https://ccwonline.com.au/collections/razorback (accessed 08/11/2026)                                                                                                                                                                           | Verified 08/11/2026 |
| CCW recommends changing it every 2 to 3 months. On screen: EVERY 2 TO 3 MONTHS; slip "Source: CCW pre-filter listing"                                                        | CCW MaxxGuard pre-filter page, Changing the filters: "Replace as necessary — we recommend changing every 2–3 months." https://ccwonline.com.au/products/pre-filter-g3-mg550-mg550uv-5pack-365mm-x-346mm-x-20mm (accessed 08/11/2026)                                                                                                                                                       | Verified 08/11/2026 |
| On screen: MAXXGUARD 550 PRE-FILTER (the pre-filter fits this unit)                                                                                                          | CCW MaxxGuard pre-filter page title and fitment: "Pre-filter (5 PACK) for Razorback MaxxGuard 550 & 550UV" https://ccwonline.com.au/products/pre-filter-g3-mg550-mg550uv-5pack-365mm-x-346mm-x-20mm (accessed 08/11/2026)                                                                                                                                                                  | Verified 08/11/2026 |
| See Razorback filters and spares: the landing link is CCW's Razorback collection, which covers the MaxxGuard 550 and its filters                                             | CCW Razorback collection: "Equipment includes the SPOTX 3Gal heated spot extractor with hoses and tools, the MaxxGuard 550 and 550UV air scrubbers with HEPA and activated carbon filters, and the Heat-Mate inline heater." https://ccwonline.com.au/collections/razorback (accessed 08/11/2026)                                                                                          | Verified 08/11/2026 |

Held back: the calendar hook "The cheapest filter in an air scrubber protects the most expensive one" (no page
says "cheapest" or ranks the HEPA as the most expensive part in those words) and "change them on schedule"
(replaced by CCW's quoted 2 to 3 month interval). No price is shown. Risk for Toby: on 08/11/2026 the pre-filter
5 pack listed at $130.68 (about $26 each) and the HEPA/activated carbon filter at $36.96 each, so the "cheap"
versus "expensive" wording is CCW's own copy but its listed prices do not show a large gap; Toby to confirm the
HEPA price (a per-filter price of a 3-box may be what is shown). No IICRC or S500 citation is made.

## Rule score

Self-score on the cut, 08/11/2026 (see `03-rule-score.md`). A blind judge scored the first cut 29/60 on
frames; its fixes applied: the blown-out wall in the turn shot replaced, the 3.9 s hold split (longest hold now
3.0 s), the hook unit enlarged. The judge's main note stands: the turn is said, not shown, because we own no
filter photo. The file is labelled PREVIEW.

| Rule                              | Result  | Note                                                           |
| --------------------------------- | ------- | -------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                         |
| S2 Hook in 2 s                    | PASS    | Floor type slams down at 0.3 s; the line ends at 2.0 s         |
| S3 Picture every ~4 s, no repeats | PASS    | 9 shots, longest hold 3.0 s; no photo in more than two shots   |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | All job or product photos; Margot is voice only                |
| S5 Bright, moving, outcome        | PARTIAL | Daylight rooms; no filter can be shown until Toby sends photos |
| S6 Owned references only          | PASS    | Every shot names its owned manifest subjects                   |
| S7 Side-by-side equipment check   | PASS    | Cut-outs are the catalogue photos themselves, not mirrored     |
| S8 No invented claims             | PASS    | Every line quoted; the calendar hook held back                 |
| S9 AS-IICRC procedure claims      | PASS    | None made                                                      |
| S10 AU English, metric, no emoji  | PASS    |                                                                |
| S11 One CTA with UTM link         | PASS    | CTA matches the Razorback collection it links to               |
| S12 CCW brand only                | PASS    | Razorback is CCW's own range; no other filter brand shown      |
