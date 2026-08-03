# Synthex + Opportunity Map UX SWOT

**Date:** 3 August 2026  
**Scope:** Public Synthex positioning, Opportunity Map, public Idea Explorer, authenticated IntentScape first use, mobile wayfinding, consent and handoff.  
**Review method:** Independent Claude Code read-only repository critique, Codex repository review, and rendered desktop/mobile journeys through `/`, `/opportunity-map` and `/intentscape`.

## Positioning test

Synthex is a marketing command center that turns business evidence into clear opportunities, controlled campaigns and measurable results. A visitor can start free by pasting a website and any useful context into the Opportunity Map. Synthex returns three ranked directions and shows what it found, inferred and still needs to learn. Nothing is published, purchased or sent without explicit approval. If the visitor asks for help, the Synthex strategy team receives the same context so discovery does not restart from zero.

## Strengths

- The Opportunity Map delivers value before asking for contact details or an account.
- Evidence, assumptions and unknowns remain visibly separate instead of being presented as certainty.
- The same intake can become a downloadable brief and a consent-bound strategy handoff.
- IntentScape has a real control model: competing directions, independent evaluation and explicit approval before action.
- Existing Synthex capabilities cover the complete delivery loop: research, campaign planning, creative production, approvals, publishing and measurement.
- The public surfaces have a distinctive, consistent dark visual language and strong desktop hierarchy.

## Weaknesses

- Synthex previously introduced `Nexus`, `Unite-Group`, `Marketing Extender`, `IntentScape`, `Context Field`, `Goal Contract` and `Work Packet` before explaining the user outcome.
- The public homepage mixes a free diagnostic, an enterprise command center and agency delivery without clearly stating how they connect.
- The public navigation previously disappeared on mobile, leaving only one call to action.
- The consent banner previously covered the first form task on both desktop and mobile.
- The Idea Explorer led with a negative promise and internal agent-process language instead of the result a visitor receives.
- The homepage contains more than 1,000 visible words and several sections that repeat approval and evidence claims.

## Opportunities

- Make the Opportunity Map the single public front door, then reveal deeper Synthex capabilities only after the visitor receives value.
- Own the trust position: every recommendation shows its evidence, assumptions and missing information.
- Use the downloadable brief as a shareable product introduction, including for recipients who did not run the scan.
- Turn the Idea Explorer into the route for people who have a problem or idea but no suitable website to scan.
- Carry the exact evidence and decisions into strategy delivery so the first human conversation starts ahead of discovery.
- Measure abandonment at four clear events: map started, map completed, brief downloaded and consented handoff.

## Threats

- Legacy public pages, especially `/agencies`, still describe a different self-service social automation product and contain unverified scale/free-trial claims.
- Anonymous pilot testimonials and broad volume claims can undermine each other if both remain public.
- A model outage or missing provider configuration can break the free front door at its highest-value step.
- A localhost Redis fallback is not a production-grade shared rate limit for a public model endpoint.
- Introducing an unfamiliar legal or delivery brand at consent time can still reduce trust unless the relationship is stated plainly.
- The breadth of the authenticated product can recreate a dashboard maze if first-use guidance names architecture instead of the next user decision.

## Confirmed first-time-user blockers

1. Full-width fixed cookie consent covered the first task.
2. Mobile public navigation hid every secondary destination and login.
3. The Opportunity Map navigation call reloaded the current page instead of moving to the form.
4. The homepage did not state that Synthex is a marketing command center or connect the free map to the delivery product.
5. Opportunity Map copy used an unexplained `Marketing Extender` label.
6. Handoff consent introduced Unite-Group without explaining its relationship to Synthex.
7. The handoff confirmation had no next action.
8. The Idea Explorer asked visitors to understand prompts, agent loops, provenance, hypotheses and governed packets.
9. Authenticated IntentScape repeated internal data-model terms during first use.
10. Public discovery routes made an unnecessary auth request and logged a 401 in the browser.

## Changes made from this review

- Consent is now an in-flow, optional analytics choice and no longer overlays the user task.
- Mobile navigation exposes the same destinations as desktop with accessible open, close and Escape behavior.
- The Opportunity Map call moves directly to the form when the visitor is already on that page.
- Homepage copy now defines Synthex, the free first step and the controlled delivery capability in one sequence.
- Public references use Synthex first; Unite-Group is identified only as the operator where legally relevant.
- `SOC ready` was replaced by the concrete product behavior `No silent publishing`.
- The public Idea Explorer and authenticated first-use path now use outcome language while preserving the underlying approval model.
- The handoff success state now continues to the Synthex capability explanation.
- Opportunity Map and Idea Explorer no longer perform irrelevant auth probes.

## Remaining product risks

- Reconcile or remove the legacy `/agencies` positioning before relying on organic acquisition.
- Validate the public model provider, database migration, shared Redis and lead organisation configuration in the target environment.
- Add production analytics for the four funnel events only after consent, then use real abandonment data to reduce the remaining 1,000-word homepage.
- Run an authenticated novice usability pass over the wider dashboard; this review covered the IntentScape entry path, not every Synthex module.
