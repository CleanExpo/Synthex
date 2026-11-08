# ccw-w4-d5-am: Three CCW sites, three states

| Field             | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date and time     | Friday 11/12/2026, 07:00 AEST                                                                                                                    |
| Funnel stage      | conversion                                                                                                                                       |
| Length            | 30 s, 1080x1920, captions burned in                                                                                                              |
| Channels          | Instagram Reels, Facebook Reels, YouTube Shorts, LinkedIn                                                                                        |
| Call to action    | Find your nearest CCW                                                                                                                            |
| Landing link      | https://ccwonline.com.au/pages/contact-us?utm_source=instagram&utm_medium=organic_social&utm_campaign=ccw-video-2026-11&utm_content=ccw-w4-d5-am |
| Calendar slot key | 2026-12-11-ccw-video-1                                                                                                                           |
| Production chain  | `sda-video` skill, steps 1 to 9                                                                                                                  |

## Voiceover

Voice: Margot, ElevenLabs `tAtHhBlA3E0eKZJKNSKE`. About 66 words, 30 seconds.

1. (0 to 3 s) Pick it up in Boondall, Seven Hills
2. (3 to 7 s) or Bayswater North. These are CCW's own sites.
3. (7 to 11 s) That is Queensland, New South Wales and Victoria.
4. (11 to 15 s) Partner agents cover South Australia, Western Australia and Tasmania.
5. (15 to 19 s) The agents are at Plympton, Bentley and Invermay.
6. (19 to 23 s) Call 1800 686 869 or visit before the holiday break.
7. (23 to 26.5 s) From carpet wands to air movers, start with a call.
8. (26.5 to 30 s) Find your nearest CCW. Link below.

## Shot list

Every shot starts on its trigger words and holds 3 to 4 s. No shot repeats. Pictures come only from
the sanctioned pipeline, grounded in the named CCW reference photos.

| #   | Time       | Trigger words           | Shot                                                                                                             | Source                                                                                                                                                                              |
| --- | ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0 to 3     | "Pick it up"            | Margot to camera in a bright CCW-style warehouse aisle, morning light                                            | HeyGen avatar from Margot's voice (`heygen-director`)                                                                                                                               |
| 2   | 3 to 7     | "Bayswater North"       | XPOWER X-800 air movers lined up on a clean warehouse floor at a bright trade-counter pick-up area, slow push-in | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                            |
| 3   | 7 to 11    | "Queensland"            | Carpet cleaning wand laid on a trade counter in a bright store, daylight                                         | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-wand`, then `submitGenerativeVideo` image-to-video                                                                     |
| 4   | 11 to 15   | "Partner agents"        | XPOWER X-800 air mover being carried toward a van, morning light                                                 | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                            |
| 5   | 15 to 19   | "Plympton"              | Carpet cleaning wand held up in a bright warehouse aisle, close-up                                               | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-wand`, then `submitGenerativeVideo` image-to-video                                                                     |
| 6   | 19 to 23   | "Call 1800 686 869"     | X-800 air mover close-up of the clamp, clean bench                                                               | `generateImage` grounded on `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video                                            |
| 7   | 23 to 26.5 | "carpet wands"          | Carpet cleaning wand beside an X-800 air mover on a tidy floor, ready to go                                      | `generateImage` grounded on `carpet-cleaning/carpet-cleaning-wand` and `water-damage-restoration/ccw-xpower-airmover-x800-1hp-w-clamp`, then `submitGenerativeVideo` image-to-video |
| 8   | 26.5 to 30 | "Find your nearest CCW" | Margot beside the air mover line-up; approved CCW logo file composited on the wall in the edit                   | HeyGen avatar from Margot's voice (`heygen-director`); approved CCW logo file composited in the edit                                                                                |

Footage share: shots 2 to 7, 23.5 s of 30 s (78%). Margot alone: shots 1 and 8, 6.5 s (22%).

## On-screen text

- Shot 6: "1800 686 869" set into the scene as a Blender insert (`blender_title.py`), 4 s, composited in the edit, not generated.
- Captions: Margot's words, burned in, CCW colours.
- No full-frame text cards.

## Post caption

Pick it up in Boondall QLD, Seven Hills NSW or Bayswater North VIC, with partner agents in Plympton SA, Bentley WA and Invermay TAS. Call 1800 686 869 or visit before the holiday break. Find your nearest CCW: link in bio.

## Claims and sources

| Claim                                                         | Source                                                                     | Status              |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| Own sites: Boondall QLD, Seven Hills NSW, Bayswater North VIC | CCW contact page: https://ccwonline.com.au/pages/contact-us                | Verified 08/11/2026 |
| Partner agents: Plympton SA, Bentley WA, Invermay TAS         | CCW contact page: https://ccwonline.com.au/pages/contact-us                | Verified 08/11/2026 |
| Phone 1800 686 869                                            | CCW contact page: https://ccwonline.com.au/pages/contact-us                | Verified 08/11/2026 |
| Call or visit before the holiday break                        | Holiday trading hours not on the verified source list: `[TOBY TO CONFIRM]` | Pending Toby        |

## Rule score

Self-score on the script, 08/11/2026 (see `03-rule-score.md`).

| Rule                              | Result  | Note                                                       |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| S1 Margot, plain English          | PASS    | Margot named; no slang                                     |
| S2 Hook in 2 s                    | PASS    | Row hook is line 1; statement, no question                 |
| S3 Picture every ~4 s, no repeats | PASS    | 8 shots, holds 3 to 4 s                                    |
| S4 Footage 75%+, Margot 10 to 28% | PASS    | 78% / 22% on the plan; re-measure on render                |
| S5 Bright, moving, outcome        | PASS    | Daylight scenes; ends on a finished outcome                |
| S6 Owned references only          | PASS    | Every footage shot names a reference subject from this row |
| S7 Side-by-side equipment check   | PENDING | At render                                                  |
| S8 No invented claims             | PASS    | Holiday timing marked for Toby                             |
| S9 AS-IICRC procedure claims      | PASS    | No standards procedure claim                               |
| S10 AU English, metric, no emoji  | PASS    |                                                            |
| S11 One CTA with UTM link         | PASS    | Landing link copied from the calendar row                  |
| S12 CCW brand only                | PASS    | No other brand or competitor                               |
