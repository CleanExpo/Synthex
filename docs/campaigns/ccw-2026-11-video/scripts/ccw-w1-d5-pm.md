# ccw-w1-d5-pm: Diagnosed over the phone

| Field             | Value                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Friday 13/11/2026, 17:30 AEST                                                                                                               |
| Funnel stage      | conversion                                                                                                                                  |
| Length            | 25.2 s, 1080x1920, type in the world                                                                                                        |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                   |
| Call to action    | Call CCW on 1800 686 869                                                                                                                    |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d5-pm |
| Calendar slot key | 2026-11-13-ccw-video-2                                                                                                                      |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                             |

Status: PREVIEW. Rewritten 08/11/2026. Every line now quotes a CCW page: the "Parts and Servicing" paragraph of CCW's
about page, the contact page, the XPOWER X-800 page or the Dri-Eaz BD2500 page. The title "Book a storm-ready check"
is retired: no CCW page offers a check to book. The draft hook "Find the fault now, not on the first wet morning" is
cut (no CCW page says it); the hook is CCW's own sentence "Malfunctioning tools and equipment are a liability, not an
asset". The draft's "diagnose most problems over the phone" and "stocked parts go out the same day" are replaced by
the words CCW's page uses: "diagnose 99% of problems ... over the phone" and "we have the part that you need in
stock, and dispatch it on the same day". There is no forecast line and no season line.

Products. All three stay. The Razorback MaxxGuard 550UV product page could not be read on 08/11/2026 (the page reader
returned "not found" for both URL forms), so no line is quoted from it: the unit is named only, by its CCW listing
name, and stands under the parts lines. The X-800 and BD2500 each carry one care line quoted from their own CCW page,
worded as what to do, so no unit is shown as faulty.

The draft's HeyGen avatar and generated shots are dropped: real owned photos only, no paid render.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 62 words; voiced 08/11/2026 (25.1 s), then three pauses between
sentences shortened to 0.4 s (0.35 s removed in all; the d4-am trim script). The phone number is written out in
words so Margot reads it digit by digit. Concept B "Over the phone first" (blind pick 37/60, tied with A at 37 and
ahead of C at 34, 08/11/2026). Each line quotes a source (see Claims).

1. (0 to 4.0 s) Malfunctioning tools and equipment are a liability, not an asset.
2. (4.4 to 9.8 s) CCW's technicians are able to diagnose 99% of problems over the phone.
3. (10.2 to 15.0 s) CCW has the part that you need in stock, and dispatches it on the same day.
4. (15.5 to 16.9 s) Keep the inlet grille clear.
5. (17.3 to 19.6 s) Check the filter at every equipment swap.
6. (19.9 to 24.8 s) Call CCW on one eight hundred, six eight six, eight six nine.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no paid render).
The MaxxGuard 550UV, X-800 and BD2500 are cut from their white catalogue photos by the border flood fill (no AI) and
stand flat on the carpet with a contact shadow from their first frame; none is mirrored (all carry print). The
550UV cut-outs are clipped to their own outline (convex hull of the red housing and black panels, measured from
the owned photo) to drop the grey floor plate baked into the catalogue render. Plan:
`lib/remotion/ccw/shot-plans.ts`; render: `scripts/render-ccw-shortform.ts`.

| #   | Time         | Trigger words       | Shot                                                                                       | Source photos                       |
| --- | ------------ | ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | 0 to 3.0     | "Malfunctioning"    | Hook: the hose reel at the open van, driveway behind; "A LIABILITY," slams onto the ground | solution-01 (reel crop)             |
| 2   | 3.0 to 4.3   | "not an asset"      | Close on a floor machine on carpet; "NOT AN / ASSET" lands and breaks up                   | rotary-01                           |
| 3   | 4.3 to 7.4   | "CCW's technicians" | The turn: the BD2500 on carpet; "CCW'S TECHNICIANS / DIAGNOSE"                             | grooming-01; BD2500                 |
| 4   | 7.4 to 10.1  | "99%"               | The X-800 three-quarter on carpet; "99% OF PROBLEMS / OVER THE PHONE"                      | extraction-03; X-800 20568160796825 |
| 5   | 10.1 to 13.2 | "CCW has the part"  | The MaxxGuard 550UV, inlet open, UV-C lamp in view; "THE PART YOU NEED / IN STOCK"; slip   | rotary-02; 550UV 31894804922521     |
| 6   | 13.2 to 15.4 | "and dispatches"    | The 550UV from above, in a new room; "DISPATCHED ON / THE SAME DAY"                        | result-01; 550UV 31894804988057     |
| 7   | 15.4 to 17.3 | "Keep the inlet"    | The X-800 front on, inlet grille to camera; "KEEP THE INLET / GRILLE CLEAR"; slip          | extraction-02; X-800 20568158994585 |
| 8   | 17.3 to 19.8 | "Check the filter"  | The BD2500 in a second room; "CHECK THE FILTER / AT EVERY SWAP"; slip                      | rotary-03; BD2500                   |
| 9   | 19.8 to 22.2 | "Call CCW"          | The 550UV side on, switch panel in view, in a new room; "CALL CCW ON / 1800 686 869"       | result-02; 550UV 31894804955289     |
| 10  | 22.2 to 25.2 | "six eight six"     | Scene end card: CCW logo plate, "Call CCW on 1800 686 869", web address                    | rotary-04, CCW logo                 |

No photo is in more than two shots; the longest hold is 3.1 s (shot 3). Catalogue IDs: MaxxGuard 550UV 31894804922521
(inlet open), 31894804988057 (from above) and 31894804955289 (side); X-800 20568158994585 (front) and 20568160796825 (three-quarter); BD2500 40568829935829. The 550UV photo 31895709417625 is an SAA mark, not the unit, and is not used.

## On-screen text

- Floor type, shot by shot: "A LIABILITY," / "NOT AN ASSET" / "CCW'S TECHNICIANS DIAGNOSE" / "99% OF PROBLEMS OVER
  THE PHONE" / "THE PART YOU NEED IN STOCK" / "DISPATCHED ON THE SAME DAY" / "KEEP THE INLET GRILLE CLEAR" / "CHECK
  THE FILTER AT EVERY SWAP" / "CALL CCW ON 1800 686 869".
- Slips on the units: "MaxxGuard 550UV", "XPOWER X-800", "Dri-Eaz BD2500".
- End card: CCW logo, "Call CCW on 1800 686 869", "ccwonline.com.au".
- No captions (the floor type carries the words); no full-frame text cards.

## Post caption

Malfunctioning tools and equipment are a liability, not an asset. CCW's technicians are able to diagnose 99% of
problems over the phone, and CCW has the part that you need in stock and dispatches it on the same day. Call CCW on
1800 686 869. Contact page: link in bio.

## Claims and sources

| Claim                                                                                                                                                       | Source                                                                                                                                                                                                                                                                                                                                                                                      | Status              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Malfunctioning tools and equipment are a liability, not an asset. On screen: "A LIABILITY," then "NOT AN ASSET"                                             | CCW about page, Parts and Servicing: "Malfunctioning tools and equipment are a liability, not an asset, and must be repaired as soon as possible." https://ccwonline.com.au/pages/about-us (accessed 08/11/2026). The voiceover drops the last clause for length.                                                                                                                           | Verified 08/11/2026 |
| CCW's technicians are able to diagnose 99% of problems over the phone. On screen: "CCW'S TECHNICIANS DIAGNOSE" then "99% OF PROBLEMS OVER THE PHONE"        | CCW about page, Parts and Servicing: "Our technicians are able to diagnose 99% of problems for just about any brand of equipment over the phone, we have the part that you need in stock, and dispatch it on the same day." https://ccwonline.com.au/pages/about-us (accessed 08/11/2026). "Our" becomes "CCW's"; the clause "for just about any brand of equipment" is dropped for length. | Verified 08/11/2026 |
| CCW has the part that you need in stock, and dispatches it on the same day. On screen: "THE PART YOU NEED IN STOCK" then "DISPATCHED ON THE SAME DAY"       | Same sentence: "we have the part that you need in stock, and dispatch it on the same day." https://ccwonline.com.au/pages/about-us (accessed 08/11/2026). "We have" becomes "CCW has"; the screen drops "that".                                                                                                                                                                             | Verified 08/11/2026 |
| Keep the inlet grille clear. On screen: "KEEP THE INLET GRILLE CLEAR" over the X-800; slip "XPOWER X-800"                                                   | CCW X-800 page, Care: "Keep the inlet grille clear of lint and debris — a blocked inlet cuts airflow and makes the motor run hot." Product title "XPOWER X-800 Air Mover 1 hp with Carpet Clamp". https://www.ccwonline.com.au/products/xpower-airmover-x800-1hp-w-clamp (accessed 08/11/2026)                                                                                              | Verified 08/11/2026 |
| Check the filter at every equipment swap. On screen: "CHECK THE FILTER AT EVERY SWAP" over the BD2500; slips "Dri-Eaz BD2500" and, in shot 3, the same unit | CCW BD2500 page, Filters: "Check the filter at every equipment swap; a loaded filter cuts airflow over the coil and water removal falls with it." Product title "Dri-Eaz BD2500 LGR Dehumidifier 230V". https://www.ccwonline.com.au/products/dri-eaz-lgr-dehumidifier-bd2500-230volt (accessed 08/11/2026)                                                                                 | Verified 08/11/2026 |
| The red unit is the MaxxGuard 550UV. On screen: slip "MaxxGuard 550UV"                                                                                      | CCW Razorback equipment listing: "Razorback MaxxGuard 550UV Air Scrubber with UV-C 50HZ/230V/AU". https://ccwonline.com.au/collections/equipment/razorback (accessed 08/11/2026). Air Scrubbers collection: "The range covers the Razorback MaxxGuard 550 and the 550UV with UV-C". https://ccwonline.com.au/collections/air-scrubbers (accessed 08/11/2026)                                | Verified 08/11/2026 |
| Call CCW on 1800 686 869. On screen: "CALL CCW ON 1800 686 869" and the end card                                                                            | CCW contact page, the landing page: "PHONE: 1800 686 869". https://ccwonline.com.au/pages/contact-us (accessed 08/11/2026). The about page prints the same number as "1800 68 68 69".                                                                                                                                                                                                       | Verified 08/11/2026 |

Held back:

- "Find the fault now, not on the first wet morning." No CCW page says it.
- "CCW's technicians diagnose most problems over the phone" and "stocked parts go out the same day". Paraphrases;
  CCW's page says "99% of problems" and "we have the part that you need in stock, and dispatch it on the same day".
  Both are used in CCW's wording. These are CCW's own claims, from an older page: Toby to confirm they still stand.
- "Tell them about the air scrubber, the air movers and the dehumidifier." No source; the products are shown instead.
- "A fault found now is one fewer on a job site." No source (it was marked for Toby).
- "Cyclone season runs to the end of April." Cut: no forecast or season line in this video, and the ABC article it
  cited is headed as a quiet-season forecast, which this campaign must not imply for Queensland.
- "CCW supplies spare parts to keep existing machines in service." Sourced (the MaxxGuard 550 and 550UV parts
  pages); cut for length.
- "Book a storm-ready check". No CCW page offers a check to book; the title is now "Diagnosed over the phone".

## Rule score

Self-score on the cut, 08/11/2026 (see `03-rule-score.md`). The file is labelled PREVIEW.

Render, 08/11/2026: master 25.2 s, H.264 delivery copy 7,291,810 bytes, SSIM 0.9906 against the master, attempt 1.
Loudness: master and copy both -16.6 LUFS (the script levels with single-pass loudnorm to -16, true peak -1.5;
this voiceover lands 0.6 LU under the target, and a peak limiter or input gain before loudnorm did not move it). The
copy matches the master to 0.0 LU. No background softening (no sceneBlur).

A blind judge scored the delivered cut 24/60 on 1 fps frames: hook 3, turn 4, type matches picture 3, bright and
moving 4, products 4, CTA 6. The judge's main point: the parts and servicing lines ("over the phone", "in stock",
"dispatched on the same day", "check the filter") sit on the units they are about, not on a phone, a parts shelf, a
courier or a filter, because no owned photo shows any of those. The hook reel and the 3 s floor-machine close-up
read as dim and vague. Photo request for Toby: a CCW technician on the phone at the service desk, the parts shelves,
a parts parcel going out, the X-800 inlet grille being cleared, a BD2500 filter (4-PRO F583) being changed, and a
crew's kit in a van in daylight.

| Rule                              | Result  | Note                                                                     |
| --------------------------------- | ------- | ------------------------------------------------------------------------ |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                                   |
| S2 Hook in 2 s                    | PARTIAL | "A LIABILITY," slams down at 0.3 s; judge scored the hook 3/10           |
| S3 Picture every ~4 s, no repeats | PASS    | 10 shots, longest hold 3.1 s; no photo in more than two shots            |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | All job or product photos; Margot is voice only                          |
| S5 Bright, moving, outcome        | PARTIAL | Daylight rooms; no owned photo shows the phone, parts or dispatch        |
| S6 Owned references only          | PASS    | Every shot names its owned manifest subjects                             |
| S7 Side-by-side equipment check   | PASS    | The cut-outs are the catalogue photos themselves, not mirrored           |
| S8 No invented claims             | PASS    | Every line quoted; the draft hook, paraphrases and season line held back |
| S9 Procedure claims               | PASS    | Two care lines, each quoted from the unit's own CCW page                 |
| S10 AU English, metric, no emoji  | PASS    | No units of measure stated                                               |
| S11 One CTA with UTM link         | PASS    | The number is printed on the contact page the link opens                 |
| S12 CCW brand only                | PASS    | Razorback, XPOWER and Dri-Eaz are CCW-listed brands                      |
