# CARSI x CCW Business Growth Days 2026

Status: draft campaign pack generated for Synthex.

Campaign slug: `carsi-ccw-roadshow-2026`
Window: 18 June 2026 to 31 July 2026
Primary booking URL: `https://www.carsi.com.au/events/ccw-roadshow`
External publish status: blocked until launch gates pass.

## Campaign Summary

CARSI and Carpet Cleaners Warehouse are running two-day Business Growth Days for carpet cleaning, rug cleaning, stain removal, tile cleaning and business growth.

- Melbourne: 22-23 July 2026, 8.30am-4.30pm both days, CCW Bayswater North.
- Sydney: 30-31 July 2026, 8.30am-4.30pm both days, CCW Seven Hills.
- Price: $175 per person or $500 for five seats.
- Included: course outline, practical chemical details, service and business growth guidance.

## Core Message

Growth needs more than another machine or product. These two-day sessions connect training, equipment, chemicals, service decisions, quoting, customer expectations and follow-up so cleaners leave with a clearer growth plan.

## Launch Gate

Do not externally publish until:

- `https://www.carsi.com.au/events/ccw-roadshow` returns HTTP 200.
- Submitting the booking form returns a Stripe Checkout URL.

Current status on 17 June 2026:

- The Vercel production app has the page at `https://carsi-web.vercel.app/events/ccw-roadshow`.
- The custom domain `https://www.carsi.com.au/events/ccw-roadshow` returned HTTP 404 from the DigitalOcean/Cloudflare origin.
- Stripe checkout on the Vercel production app returned HTTP 500. Logs showed `STRIPE_SECRET_KEY` had an invalid character in the Authorization header.
- CARSI follow-up branch adds Stripe secret normalization and a Synthex launch gate packet.

## Files

- `01-platform-copy-deck.md` - draft social and email copy.
- `05-publishing-handoff.md` - operator handoff and blocked publish state.
- `06-utm-tracking-plan.csv` - UTM links for launch channels.

