# Google Console Operating Loop

This is the delivery loop for connecting every business under `phill.mcgurk@gmail.com` to its own Google surfaces without making Phill do the technical work.

## Goal

Every business must have its own verified and tested connection map:

- Google Search Console property
- Google Analytics 4 property
- Google Business Profile location
- YouTube channel where video publishing is part of the business workflow
- Google Drive workspace where campaign/source assets need durable storage

The founder only provides account authority, consent, ownership approval, DNS approval, or Google verification actions. Everything else is agent work.

## Specialist Agents

1. Senior PM / Board Controller
   - Owns sequencing, blocker control, evidence quality, and final ready/blocked decisions.
   - Keeps the connection register current.

2. Google Cloud Console Agent
   - Verifies enabled APIs, OAuth client configuration, redirect URIs, consent-screen status, and scope approval.
   - Blocks restricted-scope cost exposure until Board approval.

3. Search Console Agent
   - Maps domains to GSC properties.
   - Confirms owner/full/restricted permission level, sitemap status, and indexing eligibility.
   - Produces DNS/service-account authority packets when Google ownership is missing.

4. GA4 Measurement Agent
   - Maps GA4 accounts, properties, data streams, measurement IDs, and conversion events.
   - Uses existing `GA4Property` mappings after founder authorization.

5. Google Business Profile Agent
   - Maps GBP accounts and locations.
   - Verifies NAP consistency, categories, review links, and verification state.
   - Uses existing `GBPLocation` mappings after founder authorization.

6. YouTube / Drive Agent
   - Maps channel ownership and Drive workspace requirements.
   - Confirms upload and asset-storage authority without exposing tokens.

7. Technical Integrations Engineer
   - Runs `npm run connections:google:audit`.
   - Runs `npm run connections:google:apply` only after authority is granted and exact safe matches are available.
   - Keeps connection writes scoped to existing `PlatformConnection`, `GSCProperty`, `GA4Property`, and `GBPLocation` records.

8. Security / Compliance Lead
   - Enforces scope minimisation, encrypted token handling, tenant isolation, and no-secret reporting.

9. Evidence Librarian
   - Captures proof per business: property IDs, permission levels, location IDs, verification state, scope list, and blocker history.

10. QA / Verification Agent
   - Runs dry-run checks, read-only live checks, and cross-business isolation checks.
   - Separates read-only validation from live mutation tests.

## Business Flow

Each business moves through:

`Inventory -> Authority Packet -> Founder Google Approval -> Evidence Capture -> Synthex Mapping -> Sync Validation -> QA Report -> Ready/Blocked`

No business is marked connected until:

- the relevant Google surface exists,
- Synthex has an org-scoped OAuth connection,
- the selected property/location/channel is mapped to the correct `organizationId`,
- read-only sync works,
- no cross-business leakage is observed.

## Commands

```bash
npm run connections:google:audit
npm run connections:google:audit:json
npm run connections:google:apply
```

Default audit mode is read-only. Apply mode only upserts exact safe local mappings from existing authorized Google connections; it does not create GBP posts, submit indexing requests, upload videos, or publish content.

## Authority Gates

Phill provides authority only when Google requires it:

- account login and OAuth consent,
- Search Console property ownership,
- DNS TXT approval,
- service-account owner access approval,
- GA4 property access,
- GBP owner/manager approval,
- YouTube channel OAuth approval,
- Board approval for restricted-scope security assessment costs.

## Stop Conditions

Stop and record a blocker when:

- Google asks for verification or ownership that cannot be automated,
- a property/location cannot be matched confidently to one business,
- a token is expired and has no refresh token,
- a requested action would mutate external Google state without explicit approval,
- any output would expose credentials, cookies, service-account JSON, access tokens, or refresh tokens.
