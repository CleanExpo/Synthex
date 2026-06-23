# Spec — google-business-profile (SYN-1049 foundation uplift)

## Finish line
Every GBP artefact this connector produces — review replies, Google Posts, listing-optimisation recommendations, NAP audits, insights interpretations — is foundation-checked against the locked CEO foundation and passes the `brand-voice-enforce` gate before it lands in front of a client.

## Inputs read at invocation
- `.claude/memory/ceo-foundation.md` — GBP compliance (Q3.2.3), universal taboos, verification gates for ranking claims
- `.claude/memory/verification-gates.md` — gate state for any referenced claim
- `lib/google/business-profile.ts` — GBP service exports (`getReviews`, `replyToReview`, `createPost`, `getInsights`, `getCategories`, etc.)
- `lib/google/google-auth.ts` — `getOAuthAccessToken`
- `hooks/useGBPLocations.ts`, `hooks/useGBPReviews.ts`, `hooks/useGBPInsights.ts` — SWR data hooks
- `app/api/cron/gbp-monitor/route.ts` — daily review fetch + AI reply suggestion (stored, never auto-sent)

## Acceptance criteria
- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Every client-facing GBP review reply routes through `brand-voice-enforce` before send (the human-approval step at `POST /api/google-business/reviews/[reviewId]/reply` is preserved — AI suggestions are never auto-sent).
- [ ] Every ranking/insights/benchmark claim in connector output carries exactly one evidence tag; projected local-pack movement is never stated as fact.
- [ ] Listing recommendations stay within GBP compliance (Q3.2.3): no keyword stuffing in business name, no artificial/aspirational categories, NAP matches the canonical `GBPLocation.address` record.

## Referenced paths (only ones VERIFIED to exist on disk)
- `lib/google/business-profile.ts`
- `lib/google/google-auth.ts`
- `hooks/useGBPLocations.ts`
- `hooks/useGBPReviews.ts`
- `hooks/useGBPInsights.ts`
- `app/api/cron/gbp-monitor/route.ts`
- `app/api/google-business/locations/route.ts`
- `app/api/google-business/locations/[locationId]/route.ts`
- `app/api/google-business/reviews/route.ts`
- `app/api/google-business/reviews/[reviewId]/reply/route.ts`
- `app/api/google-business/reviews/[reviewId]/auto-reply/route.ts`
- `app/api/google-business/posts/route.ts`
- `app/api/google-business/photos/route.ts`
- `app/api/google-business/insights/route.ts`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)
- none

## Verification
- `grep -q "ceo-foundation" .claude/skills/google-business-profile/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope
- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
