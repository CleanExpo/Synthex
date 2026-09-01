---
version: alpha
brand: carsi
# Sidecar to carsi.ts / carsi.design.md, following the same pattern as
# ra.motion.md and ra.scene.md. Read by the synthex-design skill at §2.
#
# Claims live here rather than in BrandConfig because BrandConfig is compiled by
# tsup and shipped to the browser: an approved-claims register is record data
# with sources and expiry dates that changes on a legal cadence, not a code one.
# Every claim edit would otherwise force a package rebuild.
#
# facts_approved entries:
#   claim        the exact wording that may appear on a canvas. It MUST be
#                self-sufficient: notes are never rendered, so every material
#                qualification (who it covers, for how long, whether it can
#                actually be bought) belongs INSIDE this string, not below it.
#   source_url   where it is substantiated
#   verified_on  DD/MM/YYYY
#   vg_ref       the row id in .claude/memory/verification-gates.md, if one exists
#   expires_on   optional — pricing and coverage claims should carry one
facts_approved:
  - claim: 'From $20 per course (AUD, GST included)'
    source_url: 'https://carsi.com.au/pricing'
    verified_on: 29/08/2026
    vg_ref: VG-60
    expires_on: 28/02/2027
    note: >-
      The site says "From $20", a floor rather than a fixed price. Do not render
      this as "$20 entry" or "$20 a course" — that states more than the source
      supports.
  - claim: '$795 a year (AUD, GST included) for one learner to access all published courses for 12 months — coming soon'
    source_url: 'https://carsi.com.au/pricing'
    verified_on: 29/08/2026
    vg_ref: VG-60
    expires_on: 28/02/2027
    note: >-
      Source wording is "100% access to all published CARSI courses for one
      learner for 12 months". The plan is labelled "Coming soon" on the pricing
      page and CANNOT be purchased as of 29/08/2026 — only per-course buying and
      the free tier are live. Advertising a price for an unavailable product is
      misleading conduct under the ACL, so "coming soon" is part of the claim
      string, not an optional note. Drop that phrase only when the plan is
      actually purchasable, and re-verify the price on the same day.
      Never render as team or seat pricing.
  - claim: 'Prices in AUD, GST included'
    source_url: 'https://carsi.com.au/pricing'
    verified_on: 29/08/2026
    vg_ref: VG-60
    expires_on: 28/02/2027
    note: >-
      Never rendered on its own — the qualifier is already inlined in both price
      claims above, which is what a canvas actually prints. This record exists to
      document WHY: Australian Consumer Law requires a single total price
      inclusive of GST, so a price without it is non-compliant. Keep it inlined
      in any price claim added later.
anti_references: []
claim_review_owner: founder
---

## Approved Facts

**Pricing only.** VG-60 was copied in on 29/08/2026 by founder instruction.
Every other claim still renders as the literal placeholder
`[NEEDS APPROVAL: claim]` — the safe default, not a blocker.

**Pricing must never carry an accreditation descriptor.** The source page
describes courses as "IICRC CEC Accredited", but VG-02 (IICRC CEC provider
status) is `[verification needed]`, so that descriptor is not publishable by
Synthex on any surface. Render the price without it. A board saying
"IICRC CEC accredited course from $20" is an ACL exposure even though the
price half is approved.

**Source correction, unresolved in the registry.** VG-60's "verification
source" column reads `ccwonline.com.au [sic — site URL TBC]` — CCW's domain,
not CARSI's, and CCW sits outside the Nexus under the L1–L9 carve-out. Its
status column separately says "CARSI site /pricing". The live page at
<https://carsi.com.au/pricing> was fetched on 29/08/2026 and carries both
figures, so that is the source recorded here. **The registry row itself still
says ccwonline.com.au and has not been corrected — only `foundation-keeper`
may write to `verification-gates.md`.**

**Only per-course pricing is actually purchasable.** Re-checked 29/08/2026:
the pricing page labels the $795 yearly membership **"Coming soon"**, alongside
Teams Starter $299/yr, Teams Growth $799/yr and Full Library $2,499/yr. The only
live options are per-course buying (from $20) and the free tier. The $795 claim
therefore carries "— coming soon" **inside the claim string**, because a canvas
renders `claim` and never renders `note`, and advertising a price for a product
that cannot be bought is misleading conduct under the ACL. Teams pricing is not
covered by VG-60 and is not approved in any form.

**This makes VG-60's own wording stale.** The gate reads "$20 entry / $795/yr
all-access" as at 26/04/2026, with no indication the annual plan is unreleased.
A future re-verification should capture availability, not just the number —
`foundation-keeper`'s call, not recorded here.

### Candidates awaiting founder sign-off

Sourced from `.claude/memory/verification-gates.md`. Only `foundation-keeper`
may flip a gate, and verbal confirmation does not flip one.

| Candidate claim                                        | VG row       | Status                                                                | May print?                                                 |
| ------------------------------------------------------ | ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| Pricing — from $20 per course / $795-a-year all-access | VG-60        | `[verified-26/04/2026]` · re-checked against the live page 29/08/2026 | **Approved** — now in `facts_approved`, expires 28/02/2027 |
| IICRC CEC provider status                              | VG-02        | `[verification needed]`                                               | **No — not publishable in any form**                       |
| IICRC S500 / S520 licensed publication access          | VG-04, VG-05 | `[verification needed]`                                               | No                                                         |
| Catalogue depth / active course inventory              | VG-63        | `[verification needed]`                                               | No                                                         |
| Subscriber base figures                                | VG-64        | `[verification needed]`                                               | No                                                         |
| CEC hours per course                                   | none         | Internal metric — founder, 29/08/2026                                 | **No — internal number, never a marketing claim**          |

## Anti-references

Not yet captured. The `/brand-facts carsi` command asks for these: whose look
should CARSI never resemble? Text notes only — never scrape or store a
competitor's assets.

Until one is recorded, the design engine states the category default from a
quick look at the space and writes that line into
`manifest.category_default_avoided` instead.

## Standing Prohibitions

Lifted verbatim from
`docs/marketing-agency/full-authority-campaigns/carsi-restoration-training-authority-2026-06-11/README.md`
so the design engine inherits the campaign's already-agreed verifiability rules
rather than inventing its own.

- Do not describe CARSI as an RTO.
- Do not imply IICRC endorsement or guaranteed certification outcomes.
- Do not use testimonials, images, likenesses, or customer stories without
  consent evidence.
- **Do not put CEC hours on a canvas.** Hours/CECs are an internal number
  (founder, 29/08/2026). This is not a claim awaiting substantiation — it is
  out of scope for marketing surfaces, so it will never move to
  `facts_approved`. A design wanting an hours figure should be redesigned, not
  escalated for approval.

Also binding, from `carsi.ts` and `carsi.design.md`:

- Never use clinical jargon without an on-screen definition (`doNot`).
- Never sensationalise or use marketing voice. Patient cadence; explain before
  instructing. **This outranks the punchy-hook instinct in SKILL.md §5.**
- Never mix Lora into body type.
- The pronouns we / our / i / us / my are forbidden (`voice.forbiddenWords`).
