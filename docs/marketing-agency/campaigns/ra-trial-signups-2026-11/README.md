# RestoreAssist — trial sign-ups

**FD-10 campaign brief. HOLD_FOR_REVIEW. Nothing here publishes.**

| | |
| --- | --- |
| Metric of record | RestoreAssist **trial sign-ups** (FD-10) |
| State | Held. `lib/autopilot/hold-for-review.ts` exports `HOLD_FOR_REVIEW: boolean = true`, so autopilot drafts and never schedules. Switching on P7 is a founder act (A-25). |
| Shape | `brief.json` matches the `CampaignBrief` type in `lib/dashboard/campaign-brief.ts`, so `campaignBriefReady()` and `campaignBriefTopic()` consume it directly. |
| Creative | The locked `sweep` template, `docs/marketing-agency/design-runs/templates/ra/sweep.{html,tokens.json}` — ten `template_slots`, reproduces the locked board byte-identically. |

## Where `proof` comes from

Both lines are **verbatim** from `facts_approved` in
`packages/brand-config/src/brands/ra.claims.md`. Nothing else about RestoreAssist may be
asserted — the register is the only source of publishable fact for this brand.

## The one thing that blocks this brief going live

The trial claim carries **`review_required: founder-wording`**. It reads:

> Free 15-day trial, 50 inspection report credits — reports run on your own Anthropic or OpenAI key, billed by them

That qualification is not decoration. `restoreassist.app/pricing` states report generation on
every plan — the free trial included — runs on the customer's own API key, billed by the
provider. A trial advertised as free without it is a material omission. The wording is
deliberately an under-claim, not finished copy, and the founder owns the final phrasing.

**A campaign whose entire job is trial sign-ups cannot run on an unapproved trial claim.** Settle
the wording before P7 is switched on, or the campaign runs on the AU/NZ line alone.

## Also carried forward

Both claims expire **28/02/2027**. Any creative locked against them inherits that date.
`missing-logo:ra` still stands — `public/logos/` does not exist, so boards identify the brand with
a caption-type eyebrow reading `RestoreAssist`, never `RA`, never styled as a lock-up.
