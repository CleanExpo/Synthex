# RestoreAssist staff cards: design and discovery

Status: design only, 22/10/2026. RestoreAssist was read, not changed: `main` at
`65fafd0902ab168416eed8f638bbf221e4873413` with a clean working tree, read before and after.
Building this needs its own RestoreAssist session, branch and gates. Tags: `[VERIFIED]` (read from the
named file), `[INFERENCE]`, `[UNCONFIRMED]`.

Client metric this moves: RestoreAssist trial sign-ups (FD-10), and each subscribing firm's repeat
customers.

## The idea in one paragraph

A restoration firm signs up to RestoreAssist and enters its business details once. The owner then
clicks "Make cards" and every technician gets a branded living card: their own name, photo and
tickets, plus the firm's story, its full service menu and a rule-safe way to leave a Google review.
The card goes to the customer at the end of the job. A household that only knew the firm for one flood
now sees, on a card they kept, that the same people do carpets, upholstery, tiles and odour work. One-off
restoration customers become repeat customers.

## What RestoreAssist already holds (no new typing for the owner)

| Card needs | Already in RestoreAssist | Source |
| --- | --- | --- |
| Firm name, logo, brand colours | `Organization.tradingName`, `legalName`, `logoUrl`, `primaryColor`, `accentColor` | `prisma/schema.prisma:985-997` `[VERIFIED]` |
| Phone, email, address, website, ABN | `Organization.phone`, `email`, `address`, `website`, `abn` | `prisma/schema.prisma:987-994` `[VERIFIED]` |
| "About us" text | `Organization.aboutCopy`, filled by scraping the firm's website at setup | `prisma/schema.prisma:998` `[VERIFIED]`; `app/api/setup/hydrate/route.ts:40-108` `[VERIFIED by research agent]` |
| Google review link | `Organization.googleReviewUrl` (RA-6952) | `prisma/schema.prisma:1010` `[VERIFIED]` |
| Staff name, email, phone, photo, role | `User.name`, `email`, `phone`, `image`, `role`, linked by `organizationId` | `prisma/schema.prisma:45-106` `[VERIFIED by research agent]` |
| Services and service areas | Only on the user-level `ContractorProfile.servicesOffered` and `ContractorServiceArea` | `prisma/schema.prisma:518`, `:586` `[VERIFIED by research agent]` |
| Certifications (IICRC) | `ContractorCertification` on `ContractorProfile`; not per staff member | `prisma/schema.prisma:560` `[VERIFIED by research agent]` |
| Review request after a job | `lib/pulse/review-ask.ts` emails the firm's Google review link once when a job closes, logged in `ClientCommsLog` | `lib/pulse/review-ask.ts:1-23` `[VERIFIED]` |
| Unsubscribe | `Client.pulseOptOut` | `prisma/schema.prisma:398` `[VERIFIED by research agent]` |

**Gaps** `[VERIFIED: not found in schema, lib or app per the research agent]`: no Google Place ID, no
social links, no firm-level service catalogue, no job title on `User`, no per-staff certifications, no
marketing consent beyond the Pulse opt-out, no repeat-customer follow-ups, no vCard.

**Closest existing feature:** the public contractor directory, `app/contractors/[slug]/page.tsx`, backed by
`ContractorProfile.slug` and `isPubliclyVisible`. It already shows phone, email, website and certifications.
`[VERIFIED by research agent]` The staff card should reuse its pattern, not duplicate it. `[INFERENCE]`

## Every card in the firm's own brand

Each firm's cards are rendered from its own brand kit, never from a house style. RestoreAssist already
holds most of it: `Organization.logoUrl`, `primaryColor` and `accentColor` (`prisma/schema.prisma:995-997`)
`[VERIFIED]`, and `lib/branding/extract-colors.ts` measures colours from the firm's own logo, locally and
free `[VERIFIED by research agent]`. Two cautions for the build session:
- When it finds no pixels, `extract-colors.ts` falls back to RestoreAssist's own colours (#1C2E47 /
  #8A6B4E). For cards, that fallback must become "missing", or every unbranded firm would wear
  RestoreAssist's colours. `[VERIFIED by research agent: extract-colors.ts:69]`
- Fonts are not captured at all today. Use the firm's web font only where its licence allows embedding,
  otherwise the closest open font, and name it on the owner's screen. `[INFERENCE]`

The brand kit format and its validator are in `business-card/brand-kits/` (`validate.py`). The first kit,
`phill-mcgurk.json`, is built from Synthex's canonical Unite Group config and logo. `[VERIFIED]`

## What the card shows

1. **The person.** Name, photo (`User.image`), role, tickets, mobile, "save to contacts" and wallet pass.
2. **The firm, as flashcards.** Swipeable cards built from the firm's own website and setup data:
   about us, "what to do in the first hour of a flood", service areas, insurers worked with. The owner
   approves every card before it goes live. `[INFERENCE]`
3. **The full service menu, for cross-sell.** Water damage, fire and smoke, mould, carpet cleaning,
   upholstery cleaning, tile and grout, odour control, rugs. Each has a one-tap "ask about this", so
   the flood customer learns the firm also cleans carpets. `[INFERENCE]`
4. **Reviews, done by the rules.** The same flow as Phill's card (research-notes.md §3): neutral taps
   about the real job, optional AI wording from the customer's own answers, and one tap to the firm's
   Google review page. Every customer is asked, so there is no review gating. RestoreAssist's existing
   review-ask email already sends the link to every closed job, not only happy ones. `[VERIFIED: lib/pulse/review-ask.ts]`
5. **Emergency line.** A big call-now button for the after-hours number.

## How a one-off job becomes a repeat customer

| Moment | What happens | Rule to respect |
| --- | --- | --- |
| On site | The tech shows or taps the card; the customer saves it | None |
| Job closes | Existing review-ask email, now linking to the tech's card and its review flow | Ask everyone; one ask per job |
| 2 weeks later | "How is the floor holding up?" check-in with the service menu | Only with the customer's express consent (a tick at sign-off); Spam Act needs consent, sender ID and unsubscribe `[VERIFIED: acma.gov.au/avoid-sending-spam]` |
| 6 and 12 months later | Seasonal carpet, upholstery or tile reminder | Same consent; honour `pulseOptOut` |
| Any time | Customer forwards the card to a neighbour or their property manager | No reward per review; referral rewards disclosed |

## How it moves RestoreAssist trial sign-ups (FD-10)

- **Trial magnet.** "Start a free trial and your whole crew gets living cards today." It is a visible
  win in the first hour, before a single report is written. `[INFERENCE]`
- **Every card advertises RestoreAssist.** A small "Cards by RestoreAssist" line on every customer-facing
  card puts the product in front of other restorers, insurers and property managers. `[INFERENCE]`
- **Setup gets shorter, not longer.** The card is built from data the setup wizard already collects
  (`lib/setup/wizard-steps.ts:24-32`) `[VERIFIED by research agent]`, so it rewards finishing setup.
- **Measure it.** Trial sign-ups attributed to card links (UTM per card), and the share of trial
  firms that publish at least one staff card in week one. Where the trial metric is read is not yet
  recorded in Synthex. `[UNCONFIRMED]`

## Where it would sit in RestoreAssist (for the build session)

- Public card: a new top-level route such as `app/c/[slug]/page.tsx`, public by default because
  `proxy.ts` matchers cover only dashboard, reports, setup and similar paths. `[VERIFIED by research agent: proxy.ts:401-430]`
- Owner screen: `app/dashboard/team/cards/page.tsx`, already gated to ADMIN and MANAGER by the team layout.
  `[VERIFIED by research agent: app/dashboard/team/layout.tsx, lib/auth/dashboard-page-access.ts:21]`
- Data: a small `StaffCard` model (organizationId, userId, unguessable slug, published flag, job title,
  approved flashcards, chosen services). Read only that firm's `Organization` fields and that one user's
  fields; never touch `Client` or `Inspection`. Tenancy through `lib/auth/assert-tenancy.ts`, which
  insists on a non-empty `organizationId`. `[INFERENCE from the tenancy module described by the research agent]`
- Add an organisation-level service catalogue and Google Place ID (both missing today).
- Avoid lucide icons in new UI (repo guard). `[VERIFIED by research agent: check:no-lucide script]`

## More ecosystem ideas

1. **Home record.** The homeowner keeps a card-linked history of the work done (drying dates,
   moisture readings from the RestoreAssist report), which naturally prompts maintenance services. Needs
   the client's consent and portal tenancy. `[INFERENCE]`
2. **CARSI to card to RestoreAssist.** CARSI graduates get a card showing their new IICRC ticket, with
   a RestoreAssist trial invite for their employer. `[INFERENCE]`
3. **NRPG verified directory.** Every published staff card can be listed in the NRPG contractor network,
   so insurers and property managers find verified, reviewed contractors. `[INFERENCE]`
4. **Insurer and property-manager view.** One link that lists a firm's techs with tickets, response
   times and Google rating. `[INFERENCE]`
5. **Overflow referrals.** When Disaster Recovery cannot take a job, it passes it to a card-holding NRPG
   member nearby, with any referral fee disclosed. `[INFERENCE]`
6. **Supplier offers.** Partners such as CCW (a client, so only with their agreement) offer card holders
   restock deals inside the owner's dashboard, never on the customer's card. `[INFERENCE]`
7. **Motion intro per firm.** The group's marketing agency (Synthex, internal) makes each firm's short
   intro from its own real job photos. Internal plumbing; it does not sell Synthex. `[INFERENCE]`

## Open questions for Phill

1. Do cards come free with every RestoreAssist plan, or only with a higher tier?
2. Can techs edit their own card, or does only the owner?
3. Which services make the default cross-sell menu for a restoration firm?
