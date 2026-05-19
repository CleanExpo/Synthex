# Agent Operating Model

## Decision

Use a board-controlled specialist workflow. The board does not expose long deliberation to users; it emits decisions, actions, blockers, evidence, and QA results.

## Operating Pattern

1. Source data is collected.
2. Board controller creates a campaign memo.
3. Specialist agents produce constrained outputs.
4. Contrarian identifies the weakest assumption.
5. Compliance checks claims, licences, consent, privacy, and policy.
6. QA produces a pass/fail report.
7. Client-ready export is allowed only when gates pass.

## Board Roles

| Role | Decision Rights | Output |
| --- | --- | --- |
| CEO Board Controller | Final commercial and product decision. | Board memo, final go/no-go. |
| Senior Project Manager | Delivery sequence, dependencies, blockers. | Milestone plan and status. |
| Technical Architect | Architecture, repo fit, provider boundaries. | Integration plan and risks. |
| Brand Strategist | Positioning, value proposition, narrative. | Brand angle and message hierarchy. |
| Market Strategist | Category, competitor, wedge, offer context. | Market insight and differentiation. |
| Persona Research Lead | Buyer persona, JTBD, behavioural drivers. | Persona and rationale. |
| Psychology Lead | Attention, memory, trust, emotion, persuasion. | Psychological mechanism and cautions. |
| Creative Director | Concepts, hooks, script direction, visual system. | Creative concept set. |
| Video Producer | Formats, pacing, shots, captions, audio fit. | Storyboard and production notes. |
| Artlist Asset Producer | Music search, recommendation, licence evidence. | Audio recommendation set. |
| HeyGen Producer | Avatar/video draft workflow. | Draft generation plan and job status. |
| SEO/AEO/GEO Strategist | Discoverability and answer-readiness. | Query and content rationale. |
| E-E-A-T Reviewer | Experience, expertise, authority, trust evidence. | Evidence matrix and trust score. |
| MarTech/Data Engineer | Analytics, CRM, attribution, events. | Measurement and event plan. |
| Meta Ads Strategist | Facebook creative readiness. | Format QA and draft payload notes. |
| Client Success Director | Onboarding, approvals, revisions, handoff. | Client handoff and revision plan. |
| Security/Compliance Lead | Consent, privacy, PII, secrets, licensing. | Compliance pass/fail. |
| QA Lead | Tests, browser QA, Lighthouse, preview sign-off. | QA report. |
| Contrarian | Strongest objection and failure mode. | Weakest assumption and mitigation. |

## Agent Contract

Every specialist output must include:

- `agentId`
- `inputRefs`
- `output`
- `evidenceRefs`
- `claims`
- `assumptions`
- `confidence`
- `risks`
- `nextAction`
- `status`: `draft | needs_evidence | blocked | passed`

## Escalation Rules

- Missing source data: continue with assumptions only if clearly marked; block client-ready export.
- Missing consent: block use of the story/image/person likeness.
- Missing licence: block asset use in export.
- Unsupported factual claim: block claim or rewrite as unverified hypothesis.
- Artlist or HeyGen credentials missing: use mock provider.
- Undocumented provider API: implement adapter boundary only.
- Meta publish/spend requested without flag: hard stop.

## QA Gates

| Gate | Required Before Client-Ready |
| --- | --- |
| Source data exists | Yes |
| Campaign memo exists | Yes |
| Persona rationale exists | Yes |
| Claim evidence pass | Yes |
| Consent pass | Yes |
| Licence pass | Yes |
| Meta creative pass | Yes |
| Accessibility and mobile UI pass | Yes |
| Lighthouse route check | Yes before production sign-off |
| Approval state explicit | Yes |

## Run Logging

Each orchestrated run must create an agent run log with:

- organisation ID
- user ID
- campaign ID
- source input IDs
- agents invoked
- provider mode
- model/provider metadata where applicable
- generated outputs
- blocked outputs
- costs where applicable
- timestamps

## Board Memo Shape

The board memo must include:

- campaign objective
- target persona
- source data summary
- product value thesis
- strongest proof points
- weakest assumption
- creative strategy
- format plan
- evidence gaps
- consent/licence gaps
- QA requirements
- final board decision
