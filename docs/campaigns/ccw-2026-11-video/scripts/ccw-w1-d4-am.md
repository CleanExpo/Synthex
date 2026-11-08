# ccw-w1-d4-am: Flood clean-up hazards for the crew

| Field             | Value                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date and time     | Thursday 12/11/2026, 07:00 AEST                                                                                                                         |
| Funnel stage      | awareness                                                                                                                                               |
| Length            | 27.5 s, 1080x1920, type in the world                                                                                                                    |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                               |
| Call to action    | See the flood extraction tools                                                                                                                          |
| Landing link      | https://ccwonline.com.au/collections/flood-extraction?utm_source=instagram&utm_medium=social&utm_campaign=ccw-2026-11-storm-season&utm_content=w1-d4-am |
| Calendar slot key | 2026-11-12-ccw-video-1                                                                                                                                  |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                         |

Status: PREVIEW. Rewritten 08/11/2026 on the orchestrator's ruling. The old title "Not all water is the same" and
its water-sorting lines are cut from the voiceover, the screen, the post and the calendar. The video is now about
what a flood clean-up does to the crew: every hazard line quotes SafeWork NSW or WorkSafe Queensland, and keeps the
scope of its source (flood clean-up, flood recovery work, Queensland). Nothing says a tool protects anyone from
infection or makes sewage safe.

Products. The Hydro Shark moisture sensor and the Razorback MaxxGuard 550 are dropped: no regulator line ties
either to these hazards, and an air scrubber next to "infection" would read as a protection claim. The one product
is the Water Claw Large Deluxe, and its line is its CCW page's own words. Only the photo of the tool with its bag is
used; the product photos of a person standing on a Water Claw are left out, so the tool is never shown as protection.

Landing page. The old link (`/blogs/news`, read 08/11/2026) has no post on sewage or flood infection risk. The new
one is CCW's flood extraction collection (read 08/11/2026), which lists the Water Claw Large Deluxe; the CTA names it.

The draft's HeyGen avatar and generated shots are dropped: real owned photos only, no paid render.

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. 58 words; voiced 08/11/2026 (28.6 s), then the four pauses
between sentences trimmed to 0.35 s each (27.0 s of voice) so the delivery copy fits under its size cap at the
script's rate floor. Concept A "The hazard list" (blind pick 41/60 against 36 and 33, 08/11/2026). Each line quotes
a source (see Claims).

1. (0 to 6.1 s) In flood clean-up, sewage containing harmful bacteria may have overflowed inside a building.
2. (6.6 to 12.6 s) WorkSafe Queensland: an infection caused by carrying out work is a notifiable incident.
3. (13.1 to 19.6 s) Where contact with floodwater and mud is unavoidable, wear enclosed footwear, gloves and suitable clothing.
4. (20.1 to 23.6 s) Water Claw: pulls water out of carpet and pad together.
5. (24.1 to 27.0 s) See the flood extraction tools at CCW.

## Shot list

Every picture is an owned job or catalogue photo, moved in 2.5D in Remotion (no generated imagery, no paid render).
The Water Claw is cut from its white catalogue photo by the border flood fill (no AI) and stands flat on the carpet
with a silhouette contact shadow from its first frame. Plan: `lib/remotion/ccw/shot-plans.ts`; render:
`scripts/render-ccw-shortform.ts`. The job photos are carpet cleaning jobs; the type never says what the job was.

| #   | Time         | Trigger words         | Shot                                                                                | Source photos                        |
| --- | ------------ | --------------------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 0 to 3.6     | "In flood clean-up"   | Hook: boots on wet tiles; "SEWAGE / HARMFUL BACTERIA" slams onto the wet floor      | carpet-cleaning-extraction-01        |
| 2   | 3.6 to 6.5   | "may have overflowed" | Extraction wand on the carpet in a job room; "OVERFLOWED / INSIDE A BUILDING"       | carpet-cleaning-extraction-03        |
| 3   | 6.5 to 9.0   | "WorkSafe Queensland" | Technician in gloves and boots; "WORKSAFE QLD: / AN INFECTION"                      | carpet-cleaning-solution-02          |
| 4   | 9.0 to 10.9  | "caused by carrying"  | The extraction wand at work on the carpet; "CAUSED BY / CARRYING OUT WORK"          | carpet-cleaning-extraction-02        |
| 5   | 10.9 to 13.0 | "is a notifiable"     | The turn: the type alone on an empty floor, and it breaks up; source slip           | carpet-cleaning-result-02            |
| 6   | 13.0 to 16.5 | "Where contact"       | Hose across the carpet; "WHERE CONTACT / IS UNAVOIDABLE"                            | carpet-cleaning-extraction-04        |
| 7   | 16.5 to 18.2 | "wear enclosed"       | Tight on the work boots on the wet tiles; "ENCLOSED / FOOTWEAR"                     | carpet-cleaning-extraction-01 (crop) |
| 8   | 18.2 to 20.0 | "gloves and"          | Tight on the technician's gloves and work clothes; "GLOVES AND / SUITABLE CLOTHING" | carpet-cleaning-solution-02 (crop)   |
| 9   | 20.0 to 22.0 | "Water Claw"          | The Water Claw and its bag by the skirting; "WATER CLAW / LARGE DELUXE"             | carpet-cleaning-extraction-02; claw  |
| 10  | 22.0 to 24.6 | "carpet and pad"      | The Water Claw, larger, in a new room; "CARPET AND PAD / TOGETHER"                  | carpet-cleaning-rotary-02; claw      |
| 11  | 24.6 to 27.5 | "extraction tools"    | Scene end card: CCW logo plate, "See the flood extraction tools", web address       | carpet-cleaning-result-02, CCW logo  |

No photo is in more than two shots; the longest hold is 3.6 s (shot 1). Water Claw photo: catalogue ID
51412067156181 (tool and carry bag), not mirrored.

## On-screen text

- Floor type: "SEWAGE / HARMFUL BACTERIA", "OVERFLOWED / INSIDE A BUILDING", "WORKSAFE QLD: / AN INFECTION",
  "CAUSED BY / CARRYING OUT WORK", "NOTIFIABLE / INCIDENT", "WHERE CONTACT / IS UNAVOIDABLE", "ENCLOSED /
  FOOTWEAR", "GLOVES AND / SUITABLE CLOTHING", "WATER CLAW / LARGE DELUXE", "CARPET AND PAD / TOGETHER".
- Source slip on the floor: "Source: WorkSafe QLD".
- Captions: none burned in; every shot carries its words as floor type.
- End card: CCW logo, "See the flood extraction tools", ccwonline.com.au.
- No full-frame text cards.

## Post caption

In flood clean-up, sewage containing harmful bacteria may have overflowed inside a building (SafeWork NSW). In Queensland, an infection caused by carrying out work is a notifiable incident (WorkSafe Queensland). Where contact with floodwater and mud is unavoidable, wear enclosed footwear, gloves and suitable clothing. The Water Claw Large Deluxe pulls water out of carpet and pad together: https://www.ccwonline.com.au/products/waterclaw-large-deluxe. See the flood extraction tools: link in bio.

## Claims and sources

Web pages read 08/11/2026 through the Exa page reader (direct fetches of ccwonline.com.au return HTTP 429). Each
claim quotes the source sentence it rests on.

| Claim                                                                                                                                                                                                        | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| In flood clean-up, sewage containing harmful bacteria may have overflowed inside a building. On screen: SEWAGE HARMFUL BACTERIA; OVERFLOWED INSIDE A BUILDING                                                | SafeWork NSW media release, 29/05/2025, on flood clean-up: "Common hazards include sewage containing harmful bacteria that may have overflowed inside a building, wet, slippery and unstable surfaces, and wild animals including rodents, snakes and spiders." Scope, same release: "SafeWork NSW is urging those in flood-affected areas to be alert for hazards as they return to the workplace and begin the cleanup process." https://www.safework.nsw.gov.au/news/safework-media-releases/safework-nsw-urges-workplaces-to-beware-of-hazards-as-flood-cleanup-begins (accessed 08/11/2026) | Verified 08/11/2026 |
| WorkSafe Queensland: an infection caused by carrying out work is a notifiable incident. On screen: WORKSAFE QLD: AN INFECTION; CAUSED BY CARRYING OUT WORK; NOTIFIABLE INCIDENT; slip "Source: WorkSafe QLD" | WorkSafe Queensland, "Infection risks from flood recovery and response work": "An infection that is caused by carrying out work is a notifiable incident." https://www.worksafe.qld.gov.au/safety-and-prevention/hazards/hazardous-exposures/biological-hazards/infection-risks-from-flood-recovery-and-response-work (accessed 08/11/2026). Attributed to the Queensland regulator in the voiceover and the slip.                                                                                                                                                                               | Verified 08/11/2026 |
| Where contact with floodwater and mud is unavoidable, wear enclosed footwear, gloves and suitable clothing. On screen: WHERE CONTACT IS UNAVOIDABLE; ENCLOSED FOOTWEAR; GLOVES AND SUITABLE CLOTHING         | WorkSafe Queensland, "Storms and floods", Infection risks from floodwater: "Where contact with flood water and mud is unavoidable, wear enclosed footwear, gloves and suitable clothing." https://www.worksafe.qld.gov.au/safety-and-prevention/hazards/workplace-hazards/dangers-in-your-workplace/storms-and-floods (accessed 08/11/2026)                                                                                                                                                                                                                                                      | Verified 08/11/2026 |
| The Water Claw pulls water out of carpet and pad together. On screen: WATER CLAW LARGE DELUXE; CARPET AND PAD TOGETHER                                                                                       | CCW Water Claw Large Deluxe page, title "Water Claw Large Deluxe Flood Extraction Tool, 12 x 21 Inch"; Product Overview: "A 12 x 21 inch (305 x 533 mm) head that pulls water out of carpet and pad together without lifting the carpet." https://www.ccwonline.com.au/products/waterclaw-large-deluxe (accessed 08/11/2026)                                                                                                                                                                                                                                                                     | Verified 08/11/2026 |
| See the flood extraction tools: the landing link is CCW's flood extraction collection, which lists the Water Claw Large Deluxe                                                                               | CCW Flood Extraction collection: "The range covers Water Claw flood extraction tools in medium, large and medium deluxe with injection, plus the Flash Spotter and Spot Lifter" and lists "Water Claw Large Deluxe Flood Extraction Tool, 12 x 21 Inch". https://ccwonline.com.au/collections/flood-extraction (accessed 08/11/2026)                                                                                                                                                                                                                                                             | Verified 08/11/2026 |

Held back:

- "Grey water". No SafeWork NSW or WorkSafe Queensland sentence on grey water as a clean-up hazard was found
  (Exa search, 08/11/2026). The nearest, WorkSafe Queensland's "Non-potable water" page, lists "recycled greywater"
  as non-potable water used at work, a different scope. So the copy names sewage and floodwater only.
- "Workers who are involved with flood recovery and response work may be exposed to infection risks from contact
  with contaminated floodwater, soil and mud." (WorkSafe Queensland) and "Where possible, avoid using high pressure
  washers as this may generate infectious aerosols that can be breathed in." Both sourced; cut for length.
- The collection page's line on injection tools and contaminated water in underlay: it would read as a tool that
  makes sewage safe. Not used.
- No claim that any CCW product prevents infection, protects the crew, or makes sewage safe.

## Rule score

Self-score on the cut, 08/11/2026 (see `03-rule-score.md`). The file is labelled PREVIEW.

Blind judges scored the cuts on frames only: first cut 41/60 (chemical bottles under the work and gloves lines:
replaced), a second cut 38/60 (the turn moved onto bare carpet: put back on the technician), a third 41/60 and the
final cut 38/60. What the judges keep naming needs photos we do not own, not a new edit: a visibly wet or
flood-affected room for "overflowed inside a building", a crew member at work on a wet job for "notifiable
incident", and the Water Claw in use on wet carpet in place of the cut-out. Photo request for Toby: those three.

| Rule                              | Result  | Note                                                                      |
| --------------------------------- | ------- | ------------------------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                                    |
| S2 Hook in 2 s                    | PASS    | "SEWAGE / HARMFUL BACTERIA" slams down at 0.3 s; "sewage" spoken at 1.3 s |
| S3 Picture every ~4 s, no repeats | PASS    | 11 shots, longest hold 3.6 s; no photo in more than two shots             |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | All job or product photos; Margot is voice only                           |
| S5 Bright, moving, outcome        | PARTIAL | Daylight rooms; the job photos are cleaning jobs, not floods              |
| S6 Owned references only          | PASS    | Every shot names its owned manifest subjects                              |
| S7 Side-by-side equipment check   | PASS    | The cut-out is the catalogue photo itself, not mirrored                   |
| S8 No invented claims             | PASS    | Every line quoted; grey water held back for want of a source              |
| S9 Procedure claims               | PASS    | None made                                                                 |
| S10 AU English, metric, no emoji  | PASS    |                                                                           |
| S11 One CTA with UTM link         | PASS    | CTA matches the flood extraction collection it links to                   |
| S12 CCW brand only                | PASS    | No other brand or competitor named                                        |
