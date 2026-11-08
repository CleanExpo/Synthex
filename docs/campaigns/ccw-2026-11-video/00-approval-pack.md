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

Every video carries a tappable link to a ccwonline.com.au page (Facebook caption, Instagram Story
sticker, boosted-post button), tagged `utm_campaign=ccw-video-2026-11` and `utm_content=<video id>`.
Visits land in Toby's analytics, not Synthex. The 08/11 audit (`03-tracking-audit.md`) found GA4 and
the Meta Pixel installed, but two GA4 properties, no Organization or WebSite schema, and Meta cart
events unconfirmed (A7). Calls to 1800 686 869 cannot be tagged; ask Toby's team to note "saw the video".

## What is ready

- Competitor teardown with sources: `01-competitor-teardown.md`
- 40-video calendar: `02-calendar.md` (data: `lib/marketing-agency/ccw-video-campaign-2026-11.calendar.json`)
- 40 scripts with voiceover, shot list (picture change about every 4 seconds) and rule score: `scripts/`
- Synthex wiring: `lib/marketing-agency/ccw-video-campaign-2026-11.ts` builds every tracked link and the
  40 draft calendar slots (blocked from publishing); unit test passes; loader script runs dry by default.

## What needs your yes (each is separate)

| #   | Approve                                                    | Why it waits on you                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Render method: no render spend (was about US$348)          | Remotion motion over CCW's own photos; Margot on the existing ElevenLabs plan. 16/11 proof rendered. Any later paid shot (US$0.2419 a second) comes to you first. Trade-off: moving product shots, no on-camera Margot, until Toby sends clips. Remotion is free up to 3 employees; confirm Unite Group fits. |
| A2  | Load the 40 draft slots into Synthex for CCW (`--execute`) | Production database write. Confirm the CCW organisation slug (`ccw` or `ccwarehouse`).                                                                                                                                                                                                                        |
| A3  | Send Toby the plan and the "storm-ready check" idea        | Client contact. The check is CCW's existing phone fault-finding, framed for the season.                                                                                                                                                                                                                       |
| A4  | Each finished batch of 10 before it posts                  | Nothing posts without you.                                                                                                                                                                                                                                                                                    |
| A5  | Push the branch                                            | A pushed Synthex branch merges to main automatically on green. Local commits only until you say so.                                                                                                                                                                                                           |
| A6  | Margot as CCW's voice                                      | Your brief says Margot; a repo test says client brands choose their own voice. Confirm with Toby (A3).                                                                                                                                                                                                        |
| A7  | Tracking and schema fixes on ccwonline.com.au              | Needs Toby's admin access. Fix list and theme snippet in `03-tracking-audit.md`; we change nothing on his site.                                                                                                                                                                                               |

## What Toby must confirm before anything posts

- Care tips and product details marked `[TOBY TO CONFIRM]` in the scripts (care intervals, how
  tools work, the 1:32 ratio wording, holiday trading hours).
- That CCW is happy to run the "storm-ready check" call-to-action and that the team can answer
  the extra calls.
- Use of his name and his blog guides as cited sources.
- Which accounts we post to (CCW's Instagram, Facebook, YouTube, LinkedIn).
- Any real workshop or job clips he can share (phone video is fine): they turn the product
  motion into footage.

## What is blocked and who owns it

| Item                                                             | Blocked on                                                                                                               | Owner                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Renders                                                          | Proof for 16/11 rendered locally (a preview, not approved); the other 38 videos need their shot plans                    | This lane                    |
| CCW logo for compositing                                         | A full logo set is in `public/logos/ccw/` (`primary.svg`, `inverted.svg`); Toby confirms it is his current logo          | Toby, via Phill (part of A3) |
| Gold short-form batch (the quality bar in the `sda-video` skill) | Lives on the MacBook, not this Mac                                                                                       | This lane, on the MacBook    |
| Review findings (non-blocking)                                   | One independent review passed with no blocking finding on 08/11/2026; smaller items are in SYN-1405                      | This lane                    |
| Standards lines checked against the Australian 2025 editions     | Check each standards line against AS-IICRC S500:2025 and S520:2025 before it posts; 3 week-4 scripts need a register row | This lane, before render     |

## Rules this campaign keeps

Real CCW photos only (owned or supplier-authorised); no owned photo means the shot is blocked. Margot voices every video. Bright, moving pictures that show the result. No invented
numbers, no prices in videos, no competitor named or shown, no other Unite Group brand in frame.
Australian English, metric, 230 V.

**Approve:** reply with the numbers you approve (for example "A1, A3, A7").
