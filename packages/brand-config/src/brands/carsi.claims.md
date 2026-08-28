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
#   claim        the exact wording that may appear on a canvas
#   source_url   where it is substantiated
#   verified_on  DD/MM/YYYY
#   vg_ref       the row id in .claude/memory/verification-gates.md, if one exists
#   expires_on   optional — pricing and coverage claims should carry one
facts_approved: []
anti_references: []
claim_review_owner: founder
---

## Approved Facts

**Empty.** Until the founder fills this list, every claim the design engine
wants to make renders as the literal placeholder `[NEEDS APPROVAL: claim]`.
That is the safe default, not a blocker — a claim-free board is a correct
pilot result.

### Candidates awaiting founder sign-off

Sourced from `.claude/memory/verification-gates.md`. Only `foundation-keeper`
may flip a gate, and verbal confirmation does not flip one.

| Candidate claim                               | VG row       | Status                                        | May print?                                                      |
| --------------------------------------------- | ------------ | --------------------------------------------- | --------------------------------------------------------------- |
| Pricing — $20 entry / $795-a-year all-access  | VG-60        | `[verified-26/04/2026 · CARSI site /pricing]` | Yes, once copied into `facts_approved` with its source and date |
| IICRC CEC provider status                     | VG-02        | `[verification needed]`                       | **No — not publishable in any form**                            |
| IICRC S500 / S520 licensed publication access | VG-04, VG-05 | `[verification needed]`                       | No                                                              |
| Catalogue depth / active course inventory     | VG-63        | `[verification needed]`                       | No                                                              |
| Subscriber base figures                       | VG-64        | `[verification needed]`                       | No                                                              |

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

Also binding, from `carsi.ts` and `carsi.design.md`:

- Never use clinical jargon without an on-screen definition (`doNot`).
- Never sensationalise or use marketing voice. Patient cadence; explain before
  instructing. **This outranks the punchy-hook instinct in SKILL.md §5.**
- Never mix Lora into body type.
- The pronouns we / our / i / us / my are forbidden (`voice.forbiddenWords`).
