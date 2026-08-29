---
version: alpha
brand: dr
# Sidecar to dr.ts / dr.design.md. Read by the synthex-design skill at §2.
# See carsi.claims.md for why claims live here rather than in BrandConfig.
#
# facts_approved entries:
#   claim        the exact wording that may appear on a canvas. It MUST be
#                self-sufficient: notes are never rendered, so every material
#                qualification belongs INSIDE this string, not below it.
#   source_url   where it is substantiated
#   verified_on  DD/MM/YYYY
#   vg_ref       the row id in .claude/memory/verification-gates.md, if one exists
#   expires_on   optional — availability and coverage claims should carry one
facts_approved:
  - claim: '24/7 emergency restoration response'
    source_url: 'https://disasterrecovery.com.au'
    verified_on: 29/08/2026
    vg_ref: none
    expires_on: 28/02/2027
    note: >-
      Source wording is "24/7 Available", stated against water and flood, fire
      and smoke, mould and air quality, and laser cleaning, plus "24/7 Emergency
      Restoration Services" in the page title. This is an availability claim and
      it must be operationally true at all times it is displayed — an unstaffed
      3am line makes it misleading conduct. Re-verify with operations, not just
      the website, before any paid placement.
  - claim: 'Restoration services across Australia and New Zealand'
    source_url: 'https://disasterrecovery.com.au'
    verified_on: 29/08/2026
    vg_ref: none
    expires_on: 28/02/2027
    note: >-
      Source names Australia and New Zealand as the service area, with Sydney,
      Melbourne, Brisbane, Perth and Auckland listed. Do not render a city as
      "we have an office in X" — the source supports service coverage, not
      premises.
  - claim: 'Work carried out by IICRC-certified contractors'
    source_url: 'https://disasterrecovery.com.au'
    verified_on: 29/08/2026
    vg_ref: none
    expires_on: 28/02/2027
    note: >-
      Source wording is "IICRC-certified contractors". The certification belongs
      to the contractors, NOT to Disaster Recovery as an entity. "We are IICRC
      certified" is a different and unsubstantiated claim. Keep the subject on
      the contractors in any rendering.
anti_references: []
claim_review_owner: founder
---

## Approved Facts

**Three claims: availability, coverage, and whose certification it is.**
Everything else renders as `[NEEDS APPROVAL: claim]`.

**No price is publishable.** The site states no price, fee or quote range as at
29/08/2026.

**No guarantee or warranty wording is publishable.** The site states none, and
restoration outcomes are exactly where a guarantee becomes an ACL problem.

## Two figures on the page are recruitment criteria, not brand claims

This is the trap most likely to reach a canvas, because both numbers look like
credentials when lifted out of context.

- **"$1M+ coverage"** is the _minimum liability insurance a contractor applicant
  must carry_ to join the network. It is **not** a statement that Disaster
  Recovery carries $1M cover.
- **"2+ years experience"** is the _minimum experience required of a contractor
  applicant_. It is **not** a statement about the business's trading history or
  its crews' average experience.

Rendering either as a brand attribute would assert something the source
contradicts. Neither may appear on a marketing surface in any form, and neither
is a candidate for `facts_approved` — they would need a different source
entirely, about a different subject.

## The ABN belongs to a different entity

The site states **ABN 85 151 794 142** for **National Restoration Professionals
Group Pty Ltd** — that is NRPG, a separate portfolio brand, not Disaster
Recovery.

If an ABN is ever required on a DR surface (invoices, legal footers, Google
Business verification), it must be recorded against the correct trading entity
first. Do not print this ABN under the Disaster Recovery name on the strength of
its appearance in a shared privacy notice. This needs founder clarification of
the DR ↔ NRPG entity relationship before any legal-footer use.

## The 54% statistic is third-party and needs its attribution

The page cites **54%** of insured Australians holding a stated concern,
attributed to a **YouGov survey, April 2026**. Third-party research may be
quoted, but only with the source and date visible in the same field of view —
an unattributed "54% of Australians" is a claim Synthex would be asserting
rather than citing. It is deliberately **not** in `facts_approved`: a canvas
renders `claim` alone, and this one cannot be made self-sufficient at a size
that fits a board. Use it in long-form copy where the attribution fits.

### Claim states — approved and awaiting sign-off

An earlier heading read "Candidates awaiting founder sign-off" while three of
its rows were already in `facts_approved` and marked **Approved**, which is two
states at once. The table covers both; the "May print?" column is the authority.
Approved rows are quoted **verbatim** from `facts_approved.claim`, because a
shortened paraphrase here is the thing most likely to get lifted onto a canvas
instead of the approved string.

| Candidate claim                                         | VG row | Status               | May print?                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `24/7 emergency restoration response`                   | none   | Live-source verified | **Approved** — must stay operationally true                                                                                                                                                                                                                                                                      |
| `Restoration services across Australia and New Zealand` | none   | Live-source verified | **Approved** — coverage, never "office in X"                                                                                                                                                                                                                                                                     |
| `Work carried out by IICRC-certified contractors`       | none   | Live-source verified | **Approved** — subject must remain the contractors                                                                                                                                                                                                                                                               |
| IICRC S500:2025 / S520:2025                             | none   | On site as badges    | Only as the **standard a service follows**, never as DR's own certification                                                                                                                                                                                                                                      |
| IICRC FSRT                                              | none   | On site as a badge   | **Different kind of thing — a technician certification, not a standard.** FSRT is Fire and Smoke Damage Restoration Technician: a credential held by a _person_. It may only ever be attributed to a named, verified contractor, never to Disaster Recovery and never phrased as a standard the service follows. |
| "$1M+ coverage"                                         | none   | Recruitment criteria | **No — misattributes a contractor requirement**                                                                                                                                                                                                                                                                  |
| "2+ years experience"                                   | none   | Recruitment criteria | **No — misattributes a contractor requirement**                                                                                                                                                                                                                                                                  |
| ABN 85 151 794 142                                      | none   | NRPG's entity        | **No — wrong entity for a DR surface**                                                                                                                                                                                                                                                                           |
| 54% insured-Australians statistic                       | none   | YouGov, April 2026   | Long-form only, with source and date visible                                                                                                                                                                                                                                                                     |

## Anti-references

Not yet captured. `/brand-facts dr` asks for these.

## Standing Prohibitions

- **No price, fee or quote range.** No source exists.
- **No guarantee, warranty or "we'll restore it or else" framing.**
- **Never render "$1M+ coverage" or "2+ years experience"** as attributes of
  Disaster Recovery — they describe contractor applicants.
- **Never print ABN 85 151 794 142 as Disaster Recovery's ABN.** It is National
  Restoration Professionals Group Pty Ltd's.
- **Never shift IICRC certification from the contractors to the brand.**
- **Never quote the 54% figure without "YouGov, April 2026" in the same view.**
- **Never render "24/7" on a surface if the line is not actually staffed 24/7.**
  This is the one approved claim that can become false without anyone editing a
  file.

Also binding, from `dr.ts` and `dr.design.md`:

- Tagline "When the worst happens, ready answers" — the register supports
  _ready_, not _fastest_. No superlatives; the site uses none and neither may a
  canvas.
- `voice.forbiddenWords` — check the config before drafting.
