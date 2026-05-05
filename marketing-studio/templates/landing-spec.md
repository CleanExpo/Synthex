# Landing Page Spec — {brand} {pageName}

> Template consumed by `marketing-copywriter`. Sections are optional but ordered.

## Header
- Brand: {slug}
- Page URL slug: /{slug}
- Primary keyword (if SEO): {keyword}
- Primary CTA: {action verb + outcome}
- Conversion event: {event name}

## Hero
- Headline (≤10 words): …
- Sub-headline (≤20 words): …
- Primary CTA button: {text} → {URL with UTM}
- Hero visual: {image | video → dispatch to remotion-orchestrator | static graphic}

## Problem / Pain
- Opener (uses ICP vocabulary verbatim): …
- 2-3 specific pain bullets (each with frequency or cost): …

## Solution / How it works
- Section 1 — {benefit + 1-line proof}
- Section 2 — …
- Section 3 — …
(Each section: ≤80 words + 1 visual placeholder.)

## Social proof
- Testimonials: {3 quotes — flag {{NEEDS_PROOF}} if absent}
- Logos: {names — flag {{NEEDS_PROOF}}}
- Metrics: {numbers — flag {{NEEDS_PROOF}}}

## Feature → benefit table
| Feature | Benefit (what it means for the customer) |
| --- | --- |
| … | … |

## Objection handling (FAQ)
Pull from ICP `buyingProcess.commonObjections`:
- Q: …
- A: …

## Final CTA
- Repeats Tier-1 tagline + same primary action.
- Microcopy below button: trust signal (e.g. "No credit card required — 14-day trial").

## Voice lint pass
- [ ] Zero first-person plurals
- [ ] Zero AI-filler words
- [ ] Cadence matches `BrandConfig.voice.requiredCadence`

## Tracking
- GA4 event: {event}
- PostHog event: {event}
- UTM scheme: {confirms scheme from analytics-attribution}
