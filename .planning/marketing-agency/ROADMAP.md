# Marketing Agency Roadmap

## Success Criteria

Ship a Synthex dashboard module that can create Facebook-ready brand-awareness video campaign packages from real source data, with persona rationale, scripts, storyboards, Artlist music recommendations, optional HeyGen drafts, export manifests, evidence packs, licence records, consent records, QA reports, and client handoff notes.

Publishing and ad spend are excluded until explicitly approved.

## Roadmap

### Phase 0 - Reconnaissance

Status: complete.

Verification:

- Repo structure inspected.
- Existing brand/client/video/social/SEO/GEO/E-E-A-T/workflow/approval surfaces identified.
- Official Artlist, HeyGen, Google, Lighthouse, shadcn, Component Gallery, gstack, Karpathy references checked.
- API surface map and integration risk register created.

### Phase 1 - Product Architecture

Output:

- Product spec.
- Agent operating model.
- Facebook Video Creator spec.
- Client success workflow.
- Asset licensing policy.
- Consent/story evidence policy.
- SEO/AEO/GEO playbook.
- E-E-A-T evidence matrix.
- Meta creative QA checklist.

Verify:

- No fake story/testimonial path exists.
- No unlicensed asset path exists.
- No publishing path exists.
- Core objects are defined before schema work.

### Phase 2 - Data And Schema

Output:

- Organisation-scoped Prisma/Supabase models or extensions.
- Backward-compatible migrations only.
- Ownership and data-access tests.
- Schema map.

Verify:

- `npx prisma validate`.
- Migration SQL reviewed for destructive operations.
- Tenant isolation tests cover stories, evidence, licences, campaigns, exports, agent logs, and QA reports.

### Phase 3 - Agentic Agency Engine

Output:

- `lib/marketing-agency/*` orchestration modules.
- Board memo generation.
- Specialist agents as deterministic contracts with evidence references.
- Run logs and scoring.

Verify:

- Orchestrator returns a full campaign package in mock mode.
- Unsupported claims are blocked.
- Each output includes confidence, assumptions, evidence references, and next action.

### Phase 4 - Artlist Integration

Output:

- Artlist auth/search/recommend/download/licence modules.
- Mock provider.
- Typed errors and rate-limit handling.

Verify:

- Mock recommendations pass.
- Live provider is credential-gated.
- Every selected track has licence/evidence metadata.

### Phase 5 - HeyGen Integration

Output:

- HeyGen client, video-agent, poll, webhook/callback, download modules.
- Mock provider.
- Cost/concurrency guardrails.

Verify:

- Mock prompt-to-video draft works.
- Live provider is credential-gated.
- Likeness consent is required for real people.

### Phase 6 - Facebook Video Creator UI

Output:

- Dashboard routes and components for campaign creation, persona, evidence, Artlist picker, HeyGen drafts, previews, export, QA, and handoff.

Verify:

- Empty/loading/error states.
- Keyboard and accessibility basics.
- Mobile layout.
- No secret leakage.
- Publish controls disabled by default.

### Phase 7 - Meta Export Layer

Output:

- Facebook format specs, creative checks, export package, draft ad payload.

Verify:

- 9:16, 4:5, 1:1, and optional 16:9 variants export as JSON + media manifest.
- Captions included.
- Claims evidence-linked.
- Invalid/unsupported creative fails checks.

### Phase 8 - SEO/AEO/GEO/E-E-A-T Engine

Output:

- Buyer intent map.
- Query fanout map.
- Structured data recommendations.
- E-E-A-T evidence/trust score.

Verify:

- People-first content guidance followed.
- Unsupported claims blocked.
- Structured data recommendations match visible content.

### Phase 9 - QA And Browser Harness

Output:

- Unit, integration, route, component, Playwright, Lighthouse, a11y, mock provider, and security tests.

Verify:

- Marketing agency dashboard renders.
- Facebook video creator renders.
- Export package generates.
- QA blocks unsupported claims and unlicensed assets.
- Publish/ad-spend actions disabled.
- Lighthouse targets met or documented.

### Phase 10 - Client Success OS

Output:

- Runbook, revision policy, approval template, handoff template, workflow states.

Verify:

- Every campaign has handoff notes.
- Revisions tracked.
- Approval explicit.
- No approved campaign without evidence/licensing/consent pass.

### Phase 11 - Production Sign-Off

Output:

- Final verification report.
- PR references if code changes are made.
- Preview/production checks.

Verify:

- Typecheck, lint, tests, build, Playwright, Lighthouse, provider mocks, security checks.
- No secret exposure.
- Tenant isolation preserved.
