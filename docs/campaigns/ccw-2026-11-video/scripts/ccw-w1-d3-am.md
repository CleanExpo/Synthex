# ccw-w1-d3-am: Check the plug and the frequency

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Wednesday 11/11/2026, 07:00 AEST                                                                                                                 |
| Funnel stage      | awareness                                                                                                                                        |
| Length            | about 24.6 s, 1080x1920, type in the world                                                                                                       |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | See the air mover range                                                                                                                          |
| Landing link      | https://ccwonline.com.au/collections/airmovers?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d3-am |
| Calendar slot key | 2026-11-11-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

The call to action was "Check the specs on the product page"; the landing link is CCW's air movers collection,
so it now reads "See the air mover range" (orchestrator, 08/11/2026, rule 6b). Link and UTM unchanged. The
Max Force is on that collection; the BD2500 is a dehumidifier and is not, so the call to action does not name it.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 56 words; 23.7 s of voice.
Concept A "The twin" (blind pick 39/60, 08/11/2026). The red Max Force stands on the carpet beside a flat,
dark outline of itself. The outline is the US model, labelled on the floor as Dry Air's US listing, citing
CCW's Max Force page. No plug, rating plate or second photo is drawn or implied. Every line is quoted from
CCW's own pages (see Claims).

1. (0 to 1.4 s) Two machines can look the same
2. (1.5 to 3.1 s) and still not be the same machine.
3. (4.1 to 9.7 s) Dry Air Technology lists the US Max Force at 115 volts.
4. (10.4 to 13.7 s) This is the 220 volt, 50 hertz version,
5. (13.8 to 15.1 s) with an Australian plug.
6. (15.8 to 19.2 s) The BD2500 is the 230 volt version.
7. (19.8 to 21.4 s) Check the plug and the frequency.
8. (21.6 to 23.7 s) See the air mover range at CCW.

Held back: "Check the plate before you buy" and "Plug, frequency and voltage are on it" (no source; CCW's
pages do not say what the plate shows, and we own no photo of a plate that shows a voltage or frequency).
No electrical safety advice of our own; the video quotes specifications only.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no
paid render). Products are cut from their white catalogue backgrounds by a border flood fill (no AI) and stand
on the floor with a contact shadow from their first frame (`place`). The outline twin is the same cut-out drawn
as a flat, half-transparent dark shape with a pale rim (`outline`), so it cannot read as a photo of a second machine. Plan:
`lib/remotion/ccw/shot-plans.ts`; render: `scripts/render-ccw-shortform.ts`.

| #   | Trigger words             | Shot                                                                                                            | Source photos                                                     |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | "Two machines"            | Hook: the red Max Force on the carpet of an empty room; its flat outline twin cuts in beside it at 0.3 s        | carpet-cleaning-rotary-04; Max Force front                        |
| 2   | "and still not"           | Same room, the camera swings in on the twin; "NOT THE SAME MACHINE" on the carpet                               | carpet-cleaning-rotary-04; Max Force front                        |
| 3   | "Dry Air Technology"      | The twin alone by a door jamb; "DRY AIR'S US LISTING" on the carpet, slip "Source: CCW's Max Force page"        | carpet-cleaning-result-01; Max Force side (outline)               |
| 4   | "Max Force at"            | A new room at floor height: the twin beside the real unit; "US MODEL: 115 V" on the carpet in front of the twin | carpet-cleaning-extraction-02; Max Force side (outline and photo) |
| 5   | "This is the 220"         | The real unit from behind on open carpet; "THE 220 V / 50 HZ VERSION", slip "From CCW's Max Force listing"      | carpet-cleaning-rotary-03; Max Force rear                         |
| 6   | "with an Australian"      | Same unit, the camera tracks round and in; "WITH AN AUSTRALIAN PLUG" on the carpet                              | carpet-cleaning-rotary-03; Max Force rear                         |
| 7   | "BD2500 is"               | The BD2500 on carpet by a tiled step; "BD2500: THE 230 V VERSION", slip "From CCW's BD2500 listing"             | carpet-cleaning-extraction-04; Dri-Eaz BD2500                     |
| 8   | "Check the plug"          | The BD2500 again, in a doorway room; "CHECK THE PLUG AND THE FREQUENCY" on the carpet                           | carpet-cleaning-extraction-03; Dri-Eaz BD2500                     |
| 9   | "See the air mover range" | Scene end card: CCW logo plate over the carpet edge, "See the air mover range", web address                     | carpet-cleaning-result-02, CCW logo                               |

No photo is in more than two shots. Type sits on the carpet, clear of the maker's plate on the rear view.

## On-screen text

- Kinetic type (hook): "Two machines can look the same".
- Floor type: "NOT THE SAME MACHINE", "DRY AIR'S US LISTING", "US MODEL: 115 V", "THE 220 V / 50 HZ VERSION",
  "WITH AN AUSTRALIAN PLUG", "BD2500: THE 230 V VERSION", "CHECK THE PLUG AND THE FREQUENCY".
- Source slips on the floor: "Source: CCW's Max Force page", "From CCW's Max Force listing", "From CCW's BD2500 listing".
- Captions: none burned in; every shot carries its words as floor or kinetic type.
- End card: CCW logo, "See the air mover range", ccwonline.com.au.
- No full-frame text cards.

## Post caption

Two machines can look the same and still not be the same machine. Dry Air Technology lists the US Max Force at 115 V; the one CCW sells is the 220 V / 50 Hz version with an Australian plug, and the BD2500 is the 230 V version. Check the plug and the frequency. See the air mover range: link in bio.

## Claims and sources

All three pages read 08/11/2026 through the Exa page reader (direct fetches return HTTP 429). Each claim
quotes the source sentence it rests on.

| Claim                                                                                                             | Source                                                                                                                                                                                                                                                                                  | Status              |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Two machines can look the same and still not be the same machine (approved hook); on screen: not the same machine | CCW air movers page, "How to choose": "Imported units at 60 Hz are not the same machine." https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                                                                                          | Verified 08/11/2026 |
| Dry Air's US listing; US model: 115 V. Voiceover: Dry Air Technology lists the US Max Force at 115 volts          | CCW Max Force page, Specifications note: "Dry Air Technology lists the US 115 V model at 8.6 A and 38 lb (about 17.2 kg); those figures apply to the US model, not this one." https://www.ccwonline.com.au/products/dry-air-maxforce-ventilator-50hz-220v-au-plug (accessed 08/11/2026) | Verified 08/11/2026 |
| This is the 220 V / 50 Hz version with an Australian plug                                                         | CCW Max Force page: "This is the 220 V / 50 Hz version with an Australian plug (Dry Air part AF-01T-E1B20337)." https://www.ccwonline.com.au/products/dry-air-maxforce-ventilator-50hz-220v-au-plug (accessed 08/11/2026)                                                               | Verified 08/11/2026 |
| BD2500: the 230 V version                                                                                         | CCW BD2500 page: "CCW supplies the 230 V version, SKU F413-230V." https://www.ccwonline.com.au/products/dri-eaz-lgr-dehumidifier-bd2500-230volt (accessed 08/11/2026)                                                                                                                   | Verified 08/11/2026 |
| Check the plug and the frequency                                                                                  | CCW air movers page, "How to choose": "Check the plug and the frequency. Anything specified at 50 Hz 220 V with an AU plug is built for this market." https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                              | Verified 08/11/2026 |
| See the air mover range: the landing link is CCW's air movers collection, which lists the Max Force               | CCW air movers page lists "Dry Air Max Force Ventilator Air Mover 220V/50Hz (AU Plug)" https://ccwonline.com.au/collections/airmovers (accessed 08/11/2026)                                                                                                                             | Verified 08/11/2026 |

No standards-register row is needed: the video makes no procedure or safety claim, only product facts quoted
from CCW's pages.

## Rule score

Self-score on the cut, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result | Note                                                                         |
| --------------------------------- | ------ | ---------------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS   | Margot named; no slang                                                       |
| S2 Hook in 2 s                    | PASS   | Kinetic hook from 0.05 s; the twin cuts in at 0.3 s                          |
| S3 Picture every ~4 s, no repeats | PASS   | 9 shots; no photo in more than two shots                                     |
| S4 Footage 75%+, Margot 10 to 28% | PASS   | All job or product photos; Margot is voice only                              |
| S5 Bright, moving, outcome        | PASS   | Daylight rooms; ends on the range                                            |
| S6 Owned references only          | PASS   | Every shot names its owned manifest subjects                                 |
| S7 Side-by-side equipment check   | PASS   | Cut-outs are the catalogue photos themselves; the twin is their flat outline |
| S8 No invented claims             | PASS   | Every line quoted from CCW's pages; the plate lines held back                |
| S9 AS-IICRC procedure claims      | PASS   | No standard cited                                                            |
| S10 AU English, metric, no emoji  | PASS   |                                                                              |
| S11 One CTA with UTM link         | PASS   | CTA matches the collection it links to                                       |
| S12 CCW brand only                | PASS   | Product brands appear only on CCW's own catalogue photos and pages           |
