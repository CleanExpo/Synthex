# CARSI — paid enrolments

**FD-10 campaign brief. HOLD_FOR_REVIEW. Nothing here publishes.**

| | |
| --- | --- |
| Metric of record | CARSI **paid enrolments** (FD-10) |
| State | Held. `lib/autopilot/hold-for-review.ts` exports `HOLD_FOR_REVIEW: boolean = true`. Switching on P7 is a founder act (A-25). |
| Shape | `brief.json` matches the `CampaignBrief` type in `lib/dashboard/campaign-brief.ts`. |

## Where `proof` comes from

Both lines are **verbatim** from `facts_approved` in
`packages/brand-config/src/brands/carsi.claims.md`.

## Why the $795 membership is NOT in this brief

The register's approved string is:

> `$795 a year (AUD, GST included) for one learner to access all published courses for 12 months — coming soon`

`— coming soon` is part of the approved claim, not an optional note, because advertising a price
for a product that cannot be bought is misleading conduct under the ACL. The register says that
phrase may be dropped only when the plan is actually purchasable, **and the price re-verified on
the same day**.

**Checked 01/11/2026 and the register and the live site now disagree.**
`carsi.com.au/pricing` still shows `$795` but **"Coming soon" is gone** (`x0`; it was present when
the register was written on 29/08). `/subscribe` shows no "coming soon" and no checkout link.

So one of two things is true and this brief cannot tell which: the membership became purchasable
and the register is stale, or the label was dropped in error and the site is now advertising an
unbuyable price. Either way the annual plan stays out of the campaign until VG-60 is re-verified
against the live page. **`foundation-keeper` owns that write — not this brief, and not a campaign
run.** Until then, paid enrolments means the per-course path.

## The standing prohibition that matters most

CARSI must never be described as an RTO, must never imply IICRC endorsement or guaranteed
certification outcomes, and **"IICRC CEC Accredited" is not publishable in any form** — VG-02 is
`[verification needed]`. Note that `carsi.com.au` itself currently serves that descriptor in its
meta description and JSON-LD. The register and the live site disagree there too; it is pre-existing
site content, flagged rather than fixed, because it is a legal call.

CEC hours are an internal number and will never move to `facts_approved` — a design wanting an
hours figure should be redesigned, not escalated.
