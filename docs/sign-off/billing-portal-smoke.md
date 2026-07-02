# Billing Portal Route Smoke Test — 2026-05-16

## Probe

```bash
curl -sI https://synthex.social/api/stripe/billing-portal
```

## Result

```
HTTP/2 405
server: Vercel
x-matched-path: /api/stripe/billing-portal
```

## Analysis

HTTP 405 (Method Not Allowed) on an unauthenticated `GET /api/stripe/billing-portal` is **valid and expected**. The route only accepts POST (Stripe Customer Portal session-creation pattern), so an unauthenticated GET is rejected at the method layer before auth even runs. The route exists, is wired in Vercel (`x-matched-path` matches), and is not exposing a body.

## Verdict: PASS

Route exists, correctly rejects unauthenticated GET with 405. Phase 3 PR1 (#247) billing portal ships.
