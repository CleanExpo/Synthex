# Marketing Agency Milestones

## M0 - Recon Baseline

Status: complete.

Deliverables:

- `docs/marketing-agency/recon-2026-05-15.md`
- `docs/marketing-agency/api-surface-map-2026-05-15.md`
- `docs/marketing-agency/integration-risk-register-2026-05-15.md`
- `.planning/marketing-agency/STATE.md`
- `.planning/marketing-agency/ROADMAP.md`
- `.planning/marketing-agency/MILESTONES.md`

Exit criteria:

- Artlist API limits understood.
- HeyGen API/CLI/MCP capability understood.
- Meta publish/spend blocked by default.
- Existing Synthex architecture mapped.

## M1 - Architecture And Policies

Status: complete.

Deliverables:

- `docs/marketing-agency/PRODUCT-SPEC.md`
- `docs/marketing-agency/AGENT-OPERATING-MODEL.md`
- `docs/marketing-agency/FACEBOOK-VIDEO-CREATOR-SPEC.md`
- `docs/marketing-agency/CLIENT-SUCCESS-WORKFLOW.md`
- `docs/marketing-agency/ASSET-LICENSING-POLICY.md`
- `docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md`
- `docs/marketing-agency/SEO-AEO-GEO-PLAYBOOK.md`
- `docs/marketing-agency/EEAT-EVIDENCE-MATRIX.md`
- `docs/marketing-agency/META-CREATIVE-QA-CHECKLIST.md`

Exit criteria:

- Core objects defined.
- Evidence and consent blockers explicit.
- Provider boundaries explicit.
- UI journey defined.

## M2 - Persistence Foundation

Status: design complete; migration pending.

Deliverables:

- `docs/marketing-agency/schema-map.md`
- Backward-compatible migrations pending.
- Ownership/RLS tests pending.

Exit criteria:

- New records are organisation-scoped.
- No destructive schema operation.
- Every generated object traces to source inputs and agent run.

## M3 - Mock Agency Engine

Deliverables:

- Domain types.
- Orchestrator.
- Run logs.
- Evidence/scoring/export package builders.
- Mock Artlist and HeyGen providers.

Exit criteria:

- One mock campaign package can be generated end-to-end.
- Unsupported claims fail QA.
- Unlicensed assets fail QA.

## M4 - Draft UI

Deliverables:

- Marketing Agency dashboard route.
- Facebook Video Creator route.
- Campaign/persona/story/evidence/export components.

Exit criteria:

- UI renders on desktop/mobile.
- Empty/loading/error states exist.
- Publish/ad-spend controls unavailable by default.

## M5 - Provider Integrations

Deliverables:

- Artlist music provider.
- HeyGen draft video provider.
- Typed provider errors.
- Licence and generated asset records.

Exit criteria:

- Mock tests pass.
- Live providers remain credential-gated.
- Secrets never reach client.

## M6 - Meta Export And QA

Deliverables:

- Format specs and creative checks.
- JSON/media manifest exports.
- QA checklist and evidence pack UI.

Exit criteria:

- 9:16, 4:5, 1:1, optional 16:9 export.
- Claims, consent, licence checks enforced.
- Draft payload generation only.

## M7 - Production Gate

Deliverables:

- Test suite.
- Lighthouse baseline.
- Security check.
- Final completion report.

Exit criteria:

- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run build`
- Playwright/browser smoke tests.
- Lighthouse checks.
- No unresolved critical risks.
