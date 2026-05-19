# Integration Risk Register - 2026-05-15

## Highest-Risk Decision

The highest-risk failure mode is accidentally turning a creative/export tool into an ad publishing/spend tool. The initial product must block Meta publishing and ad spend by default, even though Synthex already has Facebook/social posting infrastructure.

## Risk Register

| ID | Risk | Severity | Evidence | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R1 | Artlist video generation endpoint is invented or assumed. | Critical | Artlist docs verified only music catalogue/search/download. | Implement only documented music surfaces. Add manual Artlist Studio adapter boundary with no network calls. | Technical Architect |
| R2 | Provider secrets leak to client-side UI. | Critical | Artlist client secret, HeyGen API key, and Meta tokens are server-only credentials. | Use server-only modules, encrypted credential/vault patterns, no `NEXT_PUBLIC_` secrets, and no token data in API responses. | Security/Compliance |
| R3 | Meta publishing or paid launch happens without explicit approval. | Critical | No `APPROVED_TO_PUBLISH_META_ADS` env flag exists; user explicitly forbids spend/publishing. | Draft/export only. Disable publish buttons. Require future explicit server flag, credentials, approval, and compliance pass. | CEO / Meta Strategist |
| R4 | Customer stories/images are fabricated or used without consent. | Critical | User requires real stories, real images, source, consent status, and evidence record. | Add consent records, story evidence, and hard QA blockers. No client-ready export without consent pass. | E-E-A-T / Compliance |
| R5 | Unsupported product claims pass into client-ready creative. | High | Brand-awareness campaigns can easily overstate value or outcomes. | Claim-to-evidence matrix; unsupported claims blocked or downgraded to hypotheses. | E-E-A-T Reviewer |
| R6 | Cross-tenant data leak through new models/routes. | Critical | Synthex is organisation-scoped; many models carry `organizationId`. | Every table/query route must include org scope and RLS/Supabase policy where applicable. Add ownership tests. | Data Engineer |
| R7 | HeyGen real-person likeness misuse. | High | HeyGen supports avatars, photo avatars, digital twins, and image/video generation. | Require explicit likeness consent record before using any real person's image/voice/avatar. | HeyGen Producer / Compliance |
| R8 | HeyGen cost/concurrency runaway. | Medium | HeyGen docs list pay-as-you-go costs and 10 concurrent jobs on PAYG. | Mock default; live mode needs budget caps, queue limits, retry caps, and cost logging. | Senior PM / Data Engineer |
| R9 | Artlist rate-limit/quota failures degrade UX. | Medium | Artlist docs: standard 100 rpm, search 50 rpm, download 20 rpm, 429 headers. | Cache search where allowed, exponential backoff, typed errors, user-facing retry state. | Artlist Producer |
| R10 | Meta creative specs drift. | Medium | Meta docs and Ads Guide change over time and are JS-heavy to scrape. | Re-verify official specs during Phase 7. Store doc date in `meta/specs.ts`. | Meta Strategist |
| R11 | UI adds a large route without Lighthouse/a11y coverage. | Medium | Existing `lighthouserc.js` audits only `/`, `/dashboard`, `/login`. | Add marketing agency routes to LHCI and Playwright smoke tests before completion. | QA Lead |
| R12 | Duplicate architecture bypasses existing workflow/approval systems. | Medium | Repo already has `WorkflowExecution`, `StepExecution`, `ApprovalRequest`. | Reuse or extend existing workflow/approval patterns; do not create parallel review systems unless necessary. | Technical Architect |
| R13 | Existing repo has historical docs drift. | Medium | README references Next 15/Prisma 6 while package uses Next 16/Prisma 7. | Treat `package.json`, schema, and active source as truth; document drift when relevant. | Senior PM |
| R14 | Legal/licensing ambiguity for downloaded Artlist assets. | High | API can return downloadable URLs; campaign export requires licence evidence. | Persist licence/evidence metadata for every selected/downloaded asset; block unlicensed export. | Artlist Producer / Compliance |
| R15 | "AEO/GEO" work becomes manipulative or spammy. | Medium | Google docs say foundational SEO still applies and structured data must match visible content. | Use people-first content, visible evidence, query maps, and structured data recommendations only where accurate. | SEO/AEO/GEO Strategist |
| R16 | Component Gallery assets copied without licence review. | Low | User provided Component Gallery as reference. | Use for reference only; implement own components using repo design system/shadcn where appropriate. | Creative Director |

## Hard Stops

- Artlist, HeyGen, or Meta credentials needed for a real API call after mock/provider interface is complete.
- Any publishing/ad-spend attempt without explicit server-side approval flag.
- Any real customer story/image without consent evidence.
- Any destructive migration or unclear tenant isolation risk.
- Any platform policy or secret exposure risk.

## Open Blockers

- No Artlist credentials in repo/env example.
- No HeyGen credentials in repo/env example.
- No `APPROVED_TO_PUBLISH_META_ADS` flag in repo/env example.
- Official Artlist video-generation API not documented.
- Meta creative spec details must be re-verified at implementation time against current official Ads Guide pages.

## Contrarian Review

The product scope is too broad for a single implementation wave if treated as UI, agents, schema, providers, exports, QA, and client success all at once. The lowest-risk path is to ship in layers:

1. Architecture docs and policies.
2. Typed domain model and mock orchestrator.
3. Draft/export UI.
4. Provider adapters behind mocks.
5. Real provider enablement only after credentials, legal review, and hard gates.
