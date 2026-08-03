# Synthex Marketing Extender delivery

## Product role

The Marketing Extender is the public acquisition surface for IntentScape. It gives a visitor a useful vision brief before asking for contact details and preserves the internal IntentScape name for the governed workspace/runtime.

Public route: `/intentscape`

## Customer journey

1. The visitor supplies one rough situation in their own words.
2. The public expansion route creates a private `prospect` Markdown workspace inside the configured marketing organisation.
3. The IntentScape generator, anchoring audit and independent evaluator produce a Vision Map.
4. The visitor selects a direction and defines success, exclusions and authority boundaries.
5. The visitor downloads the complete Markdown vision brief without providing contact details.
6. The visitor may separately consent to send the brief and contact details into the Unite-Group Nexus lead funnel.

The free download and the Nexus handoff are deliberately separate. A visitor does not have to become a lead to keep the work.

## Nexus handoff

The optional handoff reuses the existing signed lead pipeline:

`MarketingExtenderHandoff` → `POST /api/internal/sign-lead` → HMAC-signed `POST /api/leads` → `Lead.rawPayload.intentscape`

The record includes:

- source, medium and campaign attribution, with UTM values preserved when present;
- the private prospect workspace ID;
- the original signal;
- selected hypothesis and Context Field version;
- approved goal and the complete Markdown brief;
- an explicit `consentToNexusReview: true` assertion.

The schema rejects an IntentScape handoff unless consent is literally `true`.

## Public model protection

- Same-origin or explicitly allowlisted browser calls only.
- Maximum three expansions per source IP per hour.
- Maximum 120 public expansions per marketing organisation per hour.
- The caller cannot select an organisation or actor.
- Public responses omit the internal marketing organisation ID and full Context Field record.
- No public route can approve a goal, publish, purchase or execute downstream work.

## Required production configuration

- `MARKETING_LEADS_ORG_ID`: organisation that owns prospect workspaces and lead records.
- `LEAD_CAPTURE_HMAC_SECRET`: signs the internal lead handoff.
- `CORS_ALLOWED_ORIGINS`: includes the production Synthex origin.
- Production AI provider credentials used by IntentScape.
- Private IntentScape Markdown artifact storage configuration.
- Shared Redis/Upstash credentials so public rate limits survive serverless cold starts.

If any of these are absent, the public UI remains viewable as a guided sample, but live expansion or Nexus handoff returns an explicit unavailable state.

## Explainer assets

- `marketing-extender-intro.mp4` — complete 25-second customer journey.
- `marketing-extender-context.mp4` — one-paste Context Field and provenance.
- `marketing-extender-expand.mp4` — seven-lens expansion beyond the obvious request.
- `marketing-extender-decision.mp4` — human-owned goal and authority boundary.
- `marketing-extender-handoff.mp4` — free download and consent-based Nexus handoff.

All compositions use the Synthex Premium OS palette and are reproducible with `npx tsx scripts/render-marketing-extender-videos.ts`.

## Launch gate

Before sharing the production URL:

1. Verify all required environment variables in the deployment.
2. Complete one real public expansion and confirm its Markdown workspace is private.
3. Download and open the generated brief.
4. Complete one consented test handoff and verify the lead appears under the marketing organisation with attribution and brief intact.
5. Confirm a non-consented visitor can still download the brief and creates no lead.
6. Verify the three-per-hour public expansion limit using a non-production test IP or isolated environment.
