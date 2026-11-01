# Living Business OS: Synthex internal redesign architecture (SYN-1316)

Status: **ARCHITECTURE + ISOLATED CONTRACT IMPLEMENTATION, NOT DEPLOYED**. 27/10/2026 AEST.
Linked Linear: https://linear.app/unite-group/issue/SYN-1316
Source branch: `feat/adaptive-client-intelligence-20261027`, based on inspected `origin/main` `e1008e6c7`.

## Product intent and ownership

**Unite Group** owns the commercial front door and any authorised sale/package order. **Synthex** remains internal: the builder, CRM/marketing intelligence and fulfilment operator. **Pi Dev Ops** engineers and orchestrates delivery; **Mission Control** visualises actual tasks, approvals and runtime evidence; **Rana** finalises reviewed releases. This does NOT change Synthex into a customer-facing SaaS or enable its dormant billing routes.

Per current immutable `docs/governance/CONSTITUTION.md`, founder decision FD-8 and `CLAUDE.md`: Synthex INTERNAL. Founder direction now includes a Unite Group external front door; implementation of that external portal belongs to its authorised repo/workstream and needs a recorded governance reconciliation. No payment, production publish, credentials, cross-tenant data sharing or external marketing is approved by this document alone.

**Value promised:** client receives a living, continuously improved digital business presence, not a fixed number of posts or blind weekly redesigns. Owner sets intent and priorities; intelligence interprets consented signals and measures gross-profit outcomes, quality and capacity.

## Inspect existing architecture before changing it

[VERIFIED by repo file inspection, 27/10/2026]
| Capability | Existing path/model | Action |
|---|---|---|
| Tenant isolation | `prisma/schema.prisma` Organization / ClientProfile, Supabase auth rules | Reuse organisation scope; extend intent without destructive migration |
| CRM | `app/api/clients/[clientId]/crm/route.ts`, Lead/Contact/ClientEngagementEvent | Reuse: current endpoint is read-only, not a new full CRM |
| Onboarding | `app/api/onboarding/*`, `lib/onboarding/*` | Reuse profile, collect only missing authorised facts |
| Site generation | `lib/ai-websites/generate-for-org.ts`, `app/api/ai-websites/generate/route.ts` | Reuse generator; separate preview, approval and live |
| Living card | `app/api/card/[slug]/events/route.ts`, `lib/learning-loop/*` | Reuse consent-safe experiment events; current implementation is scoped to existing card experiment |
| Opportunity research | `lib/marketing-agency/intelligence/*`, `lib/auto-research/*` | Reuse source/evidence pipeline; do not create duplicate opportunity DB |
| Value/attribution events | `lib/measurement/client-value-events.ts`, existing `lib/learning-loop/*` | Reuse measurement / experiment receipts, strengthen commercial outcome read-back |
| Voice | `app/api/voice/*`, `lib/sms/twilio-provider.ts` | SMS exists; actual Twilio phone-to-ElevenLabs production connection remains UNCONFIRMED |
| Platform | Next 16 / React 19 / TypeScript / Prisma 7 / Supabase / Vercel | Respect auth, RLS, organisation and approval rules |

## One system, no redundant product silos

```text
UNITE GROUP customer portal (commercial source of truth)
    -- signed, authorised order intent -->
SYNTHEX internal fulfilment intake (idempotent, scoped by org+order)
    --> existing onboarding/Brand DNA
    --> tenant CRM + website preview + living-card preview + owner dashboard
    --> verified build receipt --> governed authorisation --> publish gate
                         |
         privacy-aware customer interaction signals
 (card/website/phone → service intent → enquiry → booking → sale)
                         |
         existing CRM + measurement + experiment ledgers
                         |
         opportunity engine (evidence × value × risk × capacity)
                         |
         0–3 adaptive owner voice questions where facts are missing
                         |
          governed change candidate (draft, baseline, rollback)
                         |
        experiment + measurement + client improvement statement
```

## Domain contracts in first code slice

- `lib/living-business-os/contracts.ts`: strict business intent, evidence source, signal, fulfilment request and interaction shapes. Validate order shape and organisation identifiers only. Real order authorisation requires a **separate server-side signed receipt lookup** before any provisioning; the Zod shape alone cannot authenticate an order. Raw public card attention is never automatically a CRM contact or marketing opt-in.
- `lib/living-business-os/decision-engine.ts`: deterministic ranking; unknown capacity, weak evidence, risky intervention, no margin or cost beyond allowance → research more; full booking capacity → defer demand acquisition; all other proposals still require approval.
- `lib/living-business-os/weekly-questions.ts`: at most three targeted questions, zero allowed; asks about capacity/service priorities/evidence gaps; deduplicates answered IDs.
- `tests/unit/living-business-os/contracts.test.ts`: unit coverage for tenant, order, consent/identity, spend, capacity, evidence and weekly question boundaries.
  These **only produce internal contracts and planning decisions**. They do not provision a site, attach voice calls, change database schema or trigger production publishing.

## Event identity design

Event envelope must carry: organisation, source system, source event ID, occurred/captured timestamps, business service ID, verified/estimated provenance, experiment allocation if any, permitted purposes/consent proof, and a deduplication key. Private consumer identity is linked only with a lawful basis. Instrument existing ClientEngagementEvent/Lead/learning-loop adapters first. Never use arbitrary QR scans as proof of repeat business, infer an identified person from a random session or reuse personal data across tenants.

## Software engineering rules

1. All mutations authorised by caller/org scoped Supabase identity; never trust client-sent org or package alone.
2. Validate incoming integrations with strict schemas AND provider signature/HMAC verification; idempotent retries with dead-letter handling.
3. Publish and non-trivial spending stay behind standing authorisation + recorded human release gates. Review AI claims, images, business prices and service availability against verified client knowledge.
4. Baselines, goals, attribution uncertainty, rejection/negative signals and rollback receipts must survive failed experiments.
5. Use auditable deterministic orchestration first; agent models propose options and answer questions, not grant their own permissions.
6. Respect bounded model calls/voice minutes, client spend quotas, data minimisation, Australian commercial-message consent and accessible non-voice alternatives.
7. “Done” = test/prod evidence and live `/api/health` buildId match for applicable releases. No green status inferred from draft/CI alone.

## What remains unbuilt and where to work

| Order | Deliverable                                                                      | Proof before declaring done                                                                                                                   |
| ----- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Architecture/contracts, baseline research, source mapping                        | New focused unit tests passing in isolated worktree; independent code review                                                                  |
| 1     | Unite Group authorised package receipt → Synthex idempotent provisioning adapter | Signed/verified test order → single tenant preview; duplicate retries no duplicate sites; no billing in Synthex                               |
| 2     | Common service catalogue, card/QR/NFC → CRM identity/consent adaptor             | Card interest stays anonymous, accepted enquiry links to approved CRM contact; tenant isolation                                               |
| 3     | Owner dashboard + Twilio/ElevenLabs adapters and weekly question flow            | Authenticated demo on sandbox tenant, post-call webhook verified and deduped, accessible fallback; no call recordings without suitable notice |
| 4     | Evidence-to-opportunity-to-site/card candidate orchestration                     | Source references, confidence, profit/capacity model, signed approval, rollback and experiment baseline/outcome                               |
| 5     | Pilot on one owned brand then Rana release review                                | True paid/qualified outcome or honestly inconclusive experiment; quality, a11y, cost, security and production gates                           |

## Enhancements worth prioritising (not speculative features)

1. **Service ontology and intent resolution.** One canonical service ID with synonyms connects card, site, voice, GBP and CRM, enabling “my pest-control guy” or “leather sofa cleaning” _inside an authorised saved card or our app_. Cannot force OS-wide phone search.
2. **Evidence provenance + uncertainty.** Owned behaviour and booked sales outrank estimates; no search-volume prediction falsely presented as observed demand. Time-decay and counterfactual/holdout framework are later analytical work, not automatic “AI rankings”.
3. **Consent and review ethics.** Separate optional direct-marketing opt-in from service enquiry; unsubscribe and audit proofs. Allow neutral, genuine review links; NEVER tie rewards, ratings or negative-feedback suppression to review requests.
4. **Multimodal owner participation.** Three-minute voice check-in, uploaded images with rights/review, accessible text alternative, easy correction/retraction. No questions when facts are already known.
5. **Cost and failure economy.** Admission control (provider spend/voice minutes), cache repeated research, fall back to deterministic logic, circuit breaks on bad provider responses; do not silently convert failed actions to “done”.
6. **Safety kill-switch and human handoff.** Per-tenant pause voice/publication/contact; route risky customer-service matters to a human; privacy defaults and provider retention policies.
7. **Client success statement.** Show completed improvements, rejected experiments, actual customer outcomes, costs, confidence and high-value next decisions; do not equate clicks with profit.
8. **Platform portability.** Existing sites remain owned by clients; connectors and exportable service catalogue avoid vendor lock-in and disruptive forced rebuilding.

## Research anchors verified 27/10/2026

- Google AI search fundamentals: https://developers.google.com/search/docs/appearance/ai-features (no special guaranteed AI ranking format).
- Google Business Profile Performance API: https://developers.google.com/my-business/reference/performance/rest (daily/monthly visibility and keyword impressions; not attributable sales).
- Twilio bidirectional Media Streams: https://www.twilio.com/docs/voice/media-streams (validate X-Twilio-Signature, one bidirectional stream per call).
- ElevenLabs post-call webhook: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks (signed callbacks, not a substitute for owned CRM).
- OAIC APP 7: https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles
- ACMA: https://www.acma.gov.au/avoid-sending-spam (consent + working unsubscribe).
- Google review policy: https://support.google.com/business/answer/3474122 (genuine, never incentivised reviews).
- WCAG 2.2: https://www.w3.org/TR/wcag/ (accessible owner dashboard and customer card).

## Coordination / outstanding gates

The user's live "Unite Group Ops Board — Mini Lead PC Worker MacBook" mapping was not found under that exact name in Linear via project/view/search lookups. Linear epic SYN-1316 exists under project Synthex. Child issues are eligible for agent pickup **after board lane mapping is confirmed**; filing is not automatic assignment/dispatch. This isolated branch must not be merged or deployed before independent review and affected repo gates. Commercial portal integration needs its own existing governance and source repo verification. Rana remains final engineer/release reviewer.
