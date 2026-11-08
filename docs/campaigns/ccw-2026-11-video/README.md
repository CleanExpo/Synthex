# CCW 4-week video campaign (SYN-1404)

Client: CCW, Carpet Cleaners Warehouse (owner Toby). No charge to Toby for this month.
Run by: Unite-Group, through Synthex (internal AI marketing agency).
Linear: https://linear.app/unite-group/issue/SYN-1404
Client metric this moves: CCW enquiries and equipment sales or service bookings that arrive through
the campaign landing page with this campaign's UTM tags.

## What is in this folder

| File                                                            | What it is                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `00-approval-pack.md`                                           | One page for Phill: what is ready, what needs his yes, what is blocked |
| `01-competitor-teardown.md`                                     | Advanced SE versus CCW, with sources                                   |
| `02-calendar.md`                                                | The 40 videos as a readable table                                      |
| `lib/marketing-agency/ccw-video-campaign-2026-11.calendar.json` | The same 40 videos as data, kept beside the code that reads it         |
| `03-rule-score.md`                                              | The 12 rules every script is scored against                            |
| `scripts/<id>.md`                                               | One script, beat map and shot list per video                           |

## Dates

16/11/2026 to 11/12/2026, Monday to Friday, two videos a day (07:00 and 17:30 AEST, Brisbane time;
add one hour for Sydney and Melbourne during daylight saving).

## Gates that still bind (nothing here changes them)

- Nothing is posted and nothing is sent to Toby until Phill approves that batch in writing.
- Every picture comes from `generateImage()` / `generateBatch()` in
  `lib/services/ai/image-generation.ts` (video: `submitGenerativeVideo()`), grounded in the owned CCW
  photos in `public/reference-library/manifest.json`. No owned reference means BLOCKED.
- Every generated equipment image is compared side by side with its real CCW photo; any mismatch is
  rejected.
- Margot voices every video (ElevenLabs voice ID `tAtHhBlA3E0eKZJKNSKE`), through the `sda-video` chain.
- Any CCW code or data sent to TypeSafe Jev needs Toby's written approval first.
- Claims: no invented numbers. Lines marked `[TOBY TO CONFIRM]` cannot be published until Toby or a
  primary source confirms them.
