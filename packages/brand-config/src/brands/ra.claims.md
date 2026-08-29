---
version: alpha
brand: ra
# Sidecar to ra.ts / ra.design.md, alongside ra.motion.md and ra.scene.md.
# Read by the synthex-design skill at §2. See carsi.claims.md for why claims
# live here rather than in BrandConfig.
#
# facts_approved entries:
#   claim        the exact wording that may appear on a canvas. It MUST be
#                self-sufficient: notes are never rendered, so every material
#                qualification belongs INSIDE this string, not below it.
#   source_url   where it is substantiated
#   verified_on  DD/MM/YYYY
#   vg_ref       the row id in .claude/memory/verification-gates.md, if one exists
#   expires_on   optional — coverage and offer claims should carry one
facts_approved:
  - claim: 'Free 15-day trial, including 50 inspection report credits'
    source_url: 'https://restoreassist.app'
    verified_on: 29/08/2026
    vg_ref: none
    expires_on: 28/02/2027
    note: >-
      Source wording is "Start free — 15-day trial" and "15-day trial and 50
      inspection report credits", with a live /signup path. Verified as actually
      available on 29/08/2026, not a waitlist. Re-verify before reuse: a trial
      length and a credit allowance are the two things most likely to change
      quietly.
  - claim: 'Built for restoration work across Australia and New Zealand'
    source_url: 'https://restoreassist.app'
    verified_on: 29/08/2026
    vg_ref: none
    expires_on: 28/02/2027
    note: >-
      Source wording is "Deployed across Australia and New Zealand", with NSW,
      VIC, QLD, WA, SA, TAS, ACT, NT and NZ named. Rendered here as "built for"
      rather than "deployed across" because the latter implies an installed base
      this register cannot substantiate — no user-count gate is verified.
anti_references: []
claim_review_owner: founder
---

## Approved Facts

**Two claims, both offer-and-coverage.** Everything else renders as
`[NEEDS APPROVAL: claim]` — the safe default, not a blocker.

**No price is publishable.** The site states no price, no tier and no
subscription cost as at 29/08/2026. There is therefore no source for any RA
pricing claim, and none may be inferred from the trial terms.

## The standards badges are the main exposure

The site displays **"IICRC S500:2021"** and **"NCC 2022"**, and describes the
product as producing _"S500:2021-aligned report drafts"_.

The word **aligned** is doing all the work, and it must survive into any copy.
"S500-aligned report drafts" is a claim about the software's output format.
"S500 compliant", "IICRC certified" or "meets NCC 2022" are claims about
conformity assessment that nothing in this register supports.

**NCC 2022 is separately blocked.** VG-06 (NCC 2022 publication source access)
is `[verification needed]`, and its own registry note already flags
RestoreAssist's NCC compliance wording as the reason the gate exists. Do not
put NCC 2022 on a canvas in any form.

## The 4.8 / 50 reviews rating has no source at all

VG-43 records an aggregate rating of **4.8 from 50 reviews** for schema markup,
status `[verification needed]`. The live site displays **no rating and no
review count** as at 29/08/2026.

So this figure is not merely unverified — there is no observable source for it
anywhere. Publishing it, or emitting it as `aggregateRating` schema, would be
fabricated review data: a straightforward ACL problem and a Google structured-
data violation. **It must never render, and it must never move to
`facts_approved` on the strength of the registry row alone.** Only a genuine,
attributable review provenance audit can change that, and that is
`foundation-keeper`'s call.

## There is no App Store link to point at

VG-40 (RestoreAssist iOS App Store URL, live) is `[verification needed]` and
marked Key #1. The site's only call to action is web signup at `/signup`; no
App Store or Google Play link appears. Do not render an app-store badge, a
"download on the App Store" CTA, or any claim of app-store availability.

### Candidates awaiting founder sign-off

Sourced from `.claude/memory/verification-gates.md`. Only `foundation-keeper`
may flip a gate, and verbal confirmation does not flip one.

| Candidate claim                       | VG row | Status                  | May print?                                       |
| ------------------------------------- | ------ | ----------------------- | ------------------------------------------------ |
| Free 15-day trial + 50 report credits | none   | Live-source verified    | **Approved** — in `facts_approved`               |
| AU + NZ coverage                      | none   | Live-source verified    | **Approved** — in `facts_approved`               |
| S500:2021-aligned report drafts       | none   | On site, hedged         | Only with "aligned" intact — never as compliance |
| NCC 2022 compliance                   | VG-06  | `[verification needed]` | **No — not publishable in any form**             |
| 4.8 / 50 aggregate rating             | VG-43  | `[verification needed]` | **No — and no live source exists**               |
| iOS App Store availability            | VG-40  | `[verification needed]` | **No — no store link on the site**               |
| GA4 + Search Console wired            | VG-44  | `[verification needed]` | Internal instrumentation, not a marketing claim  |
| Trial signup conversion tracking      | VG-45  | `[verification needed]` | Internal instrumentation, not a marketing claim  |

## Anti-references

Not yet captured. `/brand-facts ra` asks for these: whose look should
RestoreAssist never resemble? Text notes only — never scrape or store a
competitor's assets.

## Standing Prohibitions

- **No price, in any form.** No source exists.
- **No aggregate rating or review count.** See above — this is fabrication risk,
  not a pending approval.
- **No app-store availability claim** while signup is web-only.
- **Never drop "aligned" from a standards claim.** It is the difference between
  describing an output format and asserting conformity assessment.
- **No user counts, install counts or "trusted by N tradies"** — no gate covers
  them and the site states none.

Also binding, from `ra.ts` and `ra.design.md`:

- `voice.forbiddenWords` — check the config before drafting; RA's list is
  enforced mechanically by `brand-voice-enforce`.
- The tagline "Built in Brisbane for Australian tradies" is brand positioning,
  already on-brand, and needs no gate — but "Australian tradies" must not
  narrow a claim the source states for both AU and NZ.
