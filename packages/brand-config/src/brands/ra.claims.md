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
  - claim: 'Free 15-day trial, 50 inspection report credits — reports run on your own Anthropic or OpenAI key, billed by them'
    source_url: 'https://restoreassist.app/pricing'
    verified_on: 29/08/2026
    vg_ref: none
    expires_on: 28/02/2027
    review_required: founder-wording
    note: >-
      CORRECTED 29/08/2026 after review. The first version of this claim read
      "Free 15-day trial, including 50 inspection report credits" and stopped
      there. It was written from the homepage alone; /pricing was never fetched.
      That page says: "Report generation on every plan — including your free
      trial — runs on your own Anthropic or OpenAI API key", billed separately
      by the provider, and /signup says "An Anthropic or OpenAI API key is
      required to operate RestoreAssist. You pay providers directly, at cost."
      A trial advertised as free while the customer must supply and pay for a
      third-party API key is a material omission, and omitting it is the kind
      of thing the ACL treats as misleading even where every word printed is
      true. A canvas renders `claim` and never renders `note`, so the
      qualification has to live in the string — the same reason CARSI's $795
      claim carries "coming soon" inline.
      THE FOUNDER OWNS THE FINAL WORDING. This phrasing is the shortest form
      that still discloses who pays; it is deliberately an under-claim, not a
      polished line. If it is judged too long for a board, the correct move is
      to drop the claim from the board, never to drop the qualification from
      the claim.
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

**No pricing claim is approved — but a pricing source exists.** An earlier
version of this file said "the site states no price, no tier and no
subscription cost". That was wrong, and wrong in an instructive way: it was
inferred from the homepage, which was the only page fetched, and then written
down as a verified fact. <https://restoreassist.app/pricing> publishes, as at
29/08/2026:

| Item            | Price                        | Per report |
| --------------- | ---------------------------- | ---------- |
| Free Trial      | $0 — 50 reports, 15 days     | —          |
| Monthly         | $99/month — 50 reports/month | $1.98      |
| 8 Reports Pack  | $20                          | $2.50      |
| 25 Reports Pack | $50                          | $2.00      |
| 60 Reports Pack | $100                         | $1.67      |
| Add-ons         | $11/month each               | —          |

Stated as "AUD, incl. GST. Tax invoices issued monthly." **Every per-report
figure on that page is explicitly exclusive of AI provider costs**, which the
customer pays directly.

None of these are in `facts_approved`. Not because there is no source —
there plainly is — but because approving a price is the founder's call, as
VG-60 was for CARSI, and because any RA price printed on a canvas would have
to carry the API-key cost the same way the trial claim now does. Distinguish
the two states carefully: "not yet approved" is where RA pricing sits;
"no source exists" is where the 4.8/50 rating sits, and they are not the
same kind of blocked.

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

Rows already in `facts_approved` are listed **verbatim**, because a shortened
paraphrase in this table is the thing most likely to get lifted onto a canvas
instead of the approved string. The heading covers both states; the "May print?"
column is the authority on which one a row is in.

| Candidate claim                                                                                                     | VG row | Status                  | May print?                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- | -------------------------------------------------------------------------------- |
| `Free 15-day trial, 50 inspection report credits — reports run on your own Anthropic or OpenAI key, billed by them` | none   | Live-source verified    | **Approved, wording pending founder** — in `facts_approved`                      |
| `Built for restoration work across Australia and New Zealand`                                                       | none   | Live-source verified    | **Approved** — in `facts_approved`                                               |
| $99/month · $20 / $50 / $100 report packs · AUD incl. GST                                                           | none   | Live source at /pricing | **Not yet approved** — founder's call, and any price must carry the API-key cost |
| S500:2021-aligned report drafts                                                                                     | none   | On site, hedged         | Only with "aligned" intact — never as compliance                                 |
| NCC 2022 compliance                                                                                                 | VG-06  | `[verification needed]` | **No — not publishable in any form**                                             |
| 4.8 / 50 aggregate rating                                                                                           | VG-43  | `[verification needed]` | **No — and no live source exists**                                               |
| iOS App Store availability                                                                                          | VG-40  | `[verification needed]` | **No — no store link on the site**                                               |
| GA4 + Search Console wired                                                                                          | VG-44  | `[verification needed]` | Internal instrumentation, not a marketing claim                                  |
| Trial signup conversion tracking                                                                                    | VG-45  | `[verification needed]` | Internal instrumentation, not a marketing claim                                  |

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
