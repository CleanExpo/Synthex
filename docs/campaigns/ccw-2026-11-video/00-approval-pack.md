# CCW storm-ready video campaign: approval pack for Phill

SYN-1404 | Prepared 08/11/2026 | 40 videos, 16/11/2026 to 11/12/2026 | No charge to Toby this month

## What it is

Two 30-second videos every weekday for four weeks, voiced by Margot, for CCW. The story is
"storm season is open: get your kit ready with CCW", built on what CCW does that its main rival,
Advanced SE, does not say: its own Razorback range made in house, phone fault-finding with
same-day parts, prices shown online, three company-run sites, and Toby's own expert guides.

| Week | Dates          | Theme                                 | Main goal                    |
| ---- | -------------- | ------------------------------------- | ---------------------------- |
| 1    | 16/11 to 20/11 | Storm season is open                  | Get noticed                  |
| 2    | 23/11 to 27/11 | Did you know, what you may not know   | Teach and build trust        |
| 3    | 30/11 to 04/12 | Service your equipment before the wet | Calls about faults and parts |
| 4    | 07/12 to 11/12 | Ready for the wet                     | Kit sales, finance, visits   |

Funnel mix: 9 awareness, 15 consideration, 7 conversion, 9 retention.

## How we will know it worked

Every video links to a ccwonline.com.au page with its own tag (`utm_campaign=ccw-video-2026-11`,
`utm_content=<video id>`, `utm_source=<channel>`). Toby's Shopify analytics then shows visits and
sales per video and channel. Calls to 1800 686 869 cannot be tagged; ask Toby's team to note
"saw the video" on phone enquiries.

## What is ready

- Competitor teardown with sources: `01-competitor-teardown.md`
- 40-video calendar: `02-calendar.md` and `calendar.json`
- 40 scripts with voiceover, shot list (picture change about every 4 seconds) and rule score: `scripts/`
- Synthex wiring: `lib/marketing-agency/ccw-video-campaign-2026-11.ts` builds every tracked link and the
  40 draft calendar slots (blocked from publishing); unit test passes; loader script runs dry by default.

## What needs your yes (each is separate)

| #   | Approve                                                           | Why it waits on you                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Spend on renders: about US$87 for week 1, about US$348 for all 40 | Image-to-video clips at the repo's draft rate (US$0.2419 per second, `lib/services/ai/video/registry.ts`), 6 clips of 6 s per video. Image generation, HeyGen and ElevenLabs usage are on top. Above the US$20 a week cap. |
| A2  | Load the 40 draft slots into Synthex for CCW (`--execute`)        | Production database write. Confirm the CCW organisation slug (`ccw` or `ccwarehouse`).                                                                                                                                     |
| A3  | Send Toby the plan and the "storm-ready check" idea               | Client contact. The check is CCW's existing phone fault-finding, framed for the season.                                                                                                                                    |
| A4  | Each finished batch of 10 before it posts                         | Nothing posts without you.                                                                                                                                                                                                 |

## What Toby must confirm before anything posts

- Care tips and product details marked `[TOBY TO CONFIRM]` in the scripts (care intervals, how
  tools work, the 1:32 ratio wording, holiday trading hours).
- That CCW is happy to run the "storm-ready check" call-to-action and that the team can answer
  the extra calls.
- Use of his name and his blog guides as cited sources.
- Which accounts we post to (CCW's Instagram, Facebook, YouTube, LinkedIn).

## What is blocked and who owns it

| Item                                                                  | Blocked on                                                                                                      | Owner                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Renders                                                               | A1 spend approval                                                                                               | Phill                        |
| Side-by-side check of each equipment image against the real CCW photo | Renders                                                                                                         | This lane after A1           |
| CCW logo for compositing                                              | A full logo set is in `public/logos/ccw/` (`primary.svg`, `inverted.svg`); Toby confirms it is his current logo | Toby, via Phill (part of A3) |
| Gold short-form batch (the quality bar in the `sda-video` skill)      | Lives on the MacBook, not this Mac                                                                              | This lane, on the MacBook    |
| Independent review of the scripts                                     | Not yet run; the rule scores are self-scores                                                                    | Next review lane             |
| Water-damage standard rows used in 5 scripts                          | Register sits on branch `feature/syn-1403-restoration-video-training`, not yet merged                           | SYN-1403 lane                |

## Rules this campaign keeps

Real CCW reference photos only, through the sanctioned pipeline; no owned photo means the shot is
blocked. Margot voices every video. Bright, moving pictures that show the result. No invented
numbers, no prices in videos, no competitor named or shown, no other Unite Group brand in frame.
Australian English, metric, 230 V.

**Approve:** reply with the numbers you approve (for example "A1 week 1 only, A2, A3").
