# SYN-828 — DR per-service × per-verified-area landing pages (GATED)

**Mandate:** 27e98e38-a6fd-4269-b223-db00f5e0e629
**Parent:** SYN-822
**Status:** HARD-BLOCKED — see ticket description "Pre-condition (HARD BLOCKERS)"

## Gate dependency

- **brand-voice-enforce** (PR #243) — every generated landing-page body passes the gate at `surface='landing-page'` before commit to repo
- **CEO confirmation** of DR verified service-delivery footprint (which postcodes/suburbs DR genuinely covers) — R1 mitigation per epic
- **SYN-AEO-2 GSC gap analysis** — DONE 2026-04-28 (SYN-823)

## What this PR does NOT ship

Page bodies. The hard blocker is the CEO-confirmed footprint — engineering cannot decide which postcodes are "verified service delivery" without a CEO declaration. Generating pages for unverified suburbs risks SAB-policy violations (per R1 mitigation in the epic).

## Generator path when unblocked

The dynamic generator already exists at SYN-838 (`LandingPageGenerated` Prisma model + Brand-voice-enforce-passed boolean per row). When CEO confirms the footprint, a follow-up PR:

1. Calls `enforceBrandVoice({ brand: 'dr', candidate: pageBody, surface: 'landing-page' })`
2. Sets `LandingPageGenerated.brandVoiceEnforcePassed = result.pass`
3. Commits to `disasterrecovery.com.au` repo only if `pass === true`

## Reference-customer slot

- Slot 1 (B2C restorer) — per-service × per-area page generator is THE acquisition lever for slot 1
- Not relevant to slots 2 / 3 directly

## Blocker

CEO confirmation of verified service-delivery footprint. Phill-side per Linear epic.
