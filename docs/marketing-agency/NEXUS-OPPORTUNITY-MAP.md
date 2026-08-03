# Nexus Marketing Opportunity Map

The Opportunity Map is the free public acquisition surface for the Nexus Marketing Agency. It converts a single mixed paste of website, social and note evidence into an inspectable brand context, three ranked growth directions and one recommended next move.

## Public contract

- Route: `/opportunity-map`
- Input: a public website plus optional business name, social links, document links and notes
- Output: observed signals, unknown context, three evidence-linked directions, a commercial-fit state and a downloadable Markdown brief
- No login or provider connection is required
- A scan does not authorize publishing, spend, account access, agreement or service delivery
- Contact details are requested only after the map and require explicit purpose-bound consent

## Data flow

1. `POST /api/opportunity-map` validates and classifies the mixed paste.
2. The public route applies the asynchronous SSRF guard before the existing onboarding intelligence receives the website.
3. `lib/opportunity-map` converts the onboarding result into a deterministic, explainable map. Missing fields stay marked as unknown.
4. `OpportunityMapScan` stores the exact evidence and result for funnel measurement.
5. `POST /api/opportunity-map/handoff` creates an org-scoped `Lead` only after explicit contact consent and links it to the scan in one transaction.
6. The Lead raw payload preserves the fit, ranked directions, service recommendation and consent record so Nexus can continue from the map.
7. `POST /api/opportunity-map/feedback` records an explicit usefulness verdict and a short description of anything missing. It creates no Lead and requests no identity.

## Privacy, access and deletion contract

- Public scan evidence is untrusted business context, not a place for personal data, passwords, tokens, private document links or URL credentials. Before production release, the write path must redact secret-like values and remove URL credentials, query strings and fragments from free-form links and `feedbackMissing`; regression tests are a release gate.
- A scan that never becomes a consented handoff is deleted within 30 days. After a handoff, the copied Opportunity Map evidence in `Lead.rawPayload` and the source scan are deleted within 90 days; the minimum contact and consent record remains only while the enquiry is active or a legal retention duty applies. A consent withdrawal or valid privacy deletion request removes it earlier unless a documented legal hold applies.
- Retention must be enforced by an idempotent scheduled deletion job with deletion counts recorded in the audit log. Documentation alone does not satisfy the production-release gate.
- There is no public scan-read or list endpoint. Scan evidence is available only to server-side database code. A consented Lead is scoped to `MARKETING_LEADS_ORG_ID` and may be read only through authenticated, organisation-authorised CRM surfaces. Database operators remain restricted by least privilege and audited access.
- Feedback remains anonymous and creates no Lead. It must not be joined to identity unless the visitor separately completes the explicit, purpose-bound handoff.

## Qualification contract

The fit score combines evidence coverage with the size of the ranked opportunity, then reduces the score when critical context is missing.

- `qualified` (65–100): enough evidence and headroom for a Unite-Group service recommendation
- `developing` (45–64): useful direction, but context gaps should be resolved before production
- `needs-context` (0–44): insufficient reliable context for a production recommendation

Qualification creates no autonomous external effect. The later agreement, payment, client-organization provisioning and channel authorization events remain separate gates.

## Runtime requirements

- `DATABASE_URL` for scan and Lead persistence
- `MARKETING_LEADS_ORG_ID` for the Unite-Group marketing inbox
- shared rate-limit storage is recommended through Upstash Redis
- the existing onboarding providers are optional; the map degrades to observed website signals when AI/provider credentials are unavailable

## Funnel measures

`opportunity_map_scans` provides completed-scan, fit-state, explicit usefulness feedback and handoff timestamps. Joined Leads provide qualification and later conversion state without making the public scan a client tenant prematurely. Brief-download and page-abandonment analytics remain outside this table and should only be added through the consented analytics path.
