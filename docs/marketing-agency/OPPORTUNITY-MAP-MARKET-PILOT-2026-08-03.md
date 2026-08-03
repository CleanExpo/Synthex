# Opportunity Map market pilot

**Decision date:** 3 August 2026
**Decision:** Prepare a controlled market pilot now. Do not start paid or broad public acquisition until the branch gates, target runtime configuration and a preview scan pass.

## Why this is the right boundary

The Opportunity Map is far enough along to learn from real businesses: it gives value before contact details, keeps evidence and unknowns visible, produces a downloadable brief, and carries consented context into the Synthex strategy team. More open-ended feature research is now lower value than observing where real users say the map missed.

It is not yet ready for unrestricted traffic. The public model path, database migration, shared rate limit and lead organisation must be proven in the target environment. The wider Synthex dashboard also has surfaces outside this novice review. A controlled pilot separates product-learning failures from infrastructure failures.

## Pilot cohort and promise

- Invite 10–20 Australian service businesses across at least three industries.
- Run for 7–14 days or until 20 valid completed maps, whichever takes longer.
- Use direct invitations and founder-led outreach only; do not buy traffic.
- Promise one free evidence-backed map, not a complete marketing strategy.
- Ask participants to use their real public website and ordinary rough context.
- Do not coach the first attempt. Observe whether the page explains itself.

## Turn researchers into a missing-elements loop

Researchers should no longer receive broad prompts such as “find anything we missed.” Every task must start from a real scan, feedback item, repeated abandonment signal or production failure and name the decision it can change.

### Daily capture

Collect these product facts without interpreting them away:

- completed maps by source, industry, fit state and visible context gap;
- useful / not-yet verdicts and the visitor's exact missing explanation;
- consented handoffs and the discovery questions the strategy team still had to repeat;
- scan errors, duration and provider fallback behaviour;
- Auto Label items marked `Check`, corrected, dismissed or rerouted inside client work.

### Research packet contract

For each repeated missing element, create one bounded packet containing:

1. The user evidence: scan IDs, de-identified feedback and frequency.
2. The missing-element label: offer, audience, proof, competitor, channel, execution, accuracy, trust, or runtime.
3. The decision at stake: copy change, evidence source, ranking rule, label policy, workflow route, or no change.
4. Fresh primary sources with date, relevance and confidence.
5. Contradictory evidence and what remains unknown.
6. A smallest test and a stop condition.

The client-specific Auto Label Pipeline should route evidence using the client's language and workflow policy. It must not turn a label into an instruction or use one client's corrections to train another client's taxonomy.

### Promotion rule

Ship a product change when one of these is true:

- the same missing element appears in at least three independent businesses;
- a single issue creates a privacy, consent, security or false-certainty risk;
- the issue blocks the map or handoff in the target environment;
- evidence shows a high-confidence label is repeatedly corrected or rerouted.

Keep one-off preferences as hypotheses. This prevents researchers from converting every comment into product bloat.

## Measures that answer the market question

Primary:

- at least 70% of submitted feedback says the map gave a clear next move;
- fewer than 10% of valid scans fail technically;
- at least 20 completed maps from the target cohort;
- fewer than 30% of maps are judged irrelevant or materially inaccurate.

Diagnostic:

- median and 95th-percentile time to a result;
- feedback participation rate and missing-element distribution;
- fit-state distribution by industry;
- brief downloads once consented funnel analytics is available;
- handoff rate and number of discovery questions repeated after handoff;
- Auto Label `Check`, correction, dismissal and downstream reroute rates.

Handoff conversion is useful but not the first success criterion. The first question is whether an uncoached visitor understands Synthex and receives a credible next move.

## Launch gates

All must be true before invitations are sent:

- PR required checks pass on the exact pilot SHA, including RLS and auth coverage.
- The Vercel preview builds and `/opportunity-map` renders on desktop and mobile.
- One safe preview scan completes and persists the exact map.
- A not-yet feedback response persists without creating a Lead.
- A consented test handoff reaches the correct organisation and preserves the map.
- Target environment has a working database, shared Redis rate limiting, onboarding provider configuration and `MARKETING_LEADS_ORG_ID`.
- Scan and handoff failures are visible in production logs.
- Legacy `/agencies` claims are reconciled or excluded from the pilot journey.

## Pause conditions

Pause invitations immediately for any privacy or cross-client isolation failure, misleading certainty, broken consent, or missing handoff. Pause and repair the funnel if valid scan failures exceed 10% or the 95th-percentile response exceeds 45 seconds. Return to research if more than 30% of participants say the result is irrelevant; do not solve that with more acquisition copy.

## Decision after the pilot

- **Expand:** the usefulness, reliability and relevance thresholds pass, and no critical trust issue remains.
- **Iterate in cohort:** the map is useful but one or two repeated missing-element clusters dominate.
- **Stop and reshape:** relevance remains below threshold or the strategy team must repeat most discovery despite the preserved handoff.
