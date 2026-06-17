# Publishing Handoff

Campaign: CARSI x CCW Business Growth Days 2026

This campaign is ready as a Synthex draft pack. It is not externally publishable until the CARSI public booking URL and Stripe checkout both pass verification.

## Operator Instructions

1. Confirm `https://www.carsi.com.au/events/ccw-roadshow` returns HTTP 200.
2. Submit a test booking start and confirm the response contains a Stripe Checkout URL.
3. Confirm CARSI and CCW social credentials are active in Synthex.
4. Replace `[BOOKING_LINK]` in the copy deck with the correct UTM URL.
5. Publish only approved slots.
6. Keep Australian carpet cleaner group posts helpful and community-safe; avoid spam framing.

## Current Blockers

- `www.carsi.com.au` still points to the DigitalOcean/Cloudflare origin and returned a 404 for the roadshow URL during verification on 17 June 2026.
- The Vercel production roadshow checkout route returned HTTP 500 during verification.
- Vercel logs showed Stripe failing because `STRIPE_SECRET_KEY` had an invalid character in the Authorization header.
- CARSI follow-up work has added Stripe secret normalization, but production must be redeployed and retested.

## Final Handoff State

- Campaign pack applied to Synthex docs: yes.
- External publish status: blocked pending launch gate.
- Paid ad status: blocked. No ad spend is approved.
- Organic social status: draft and schedule-ready once launch gate passes.
- Email status: draft and send-ready once launch gate passes.

