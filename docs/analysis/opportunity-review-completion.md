# Synthex → Unite-Group Nexus local verification, 07/10/2026

This report records the local verification snapshot before publication. The
founder subsequently authorised build-mode continuation including commits, PRs,
merges, deployment and live verification. Release and browser evidence is tracked
separately by SPM; this snapshot does not assert live acceptance.

This user-authorised continuation adds a durable manual review workspace and a
Nexus blocked-review import. It extends the previous synthetic demonstration;
that older report remains historical. Both dirty canonical checkouts are intact.
No commit, push, PR, deployment, migration, live ingestion or live data operation
was performed. No new dependencies or provider/scheduler execution were added.

## Implemented pathway

1. Synthex `/dashboard/opportunities`: capture real operator-supplied source
   attribution and claims, separate Unite evidence, complete project/business
   hypothesis, confidence estimate, assumptions, uncertainties, KPI/baseline,
   owner, success/stop criteria and next manual validation.
2. Authenticated effective-organisation proposal APIs store versioned review
   metadata in existing CommandPacket rows. Captures are atomically idempotent;
   decisions use revision compare-and-swap. Reject is terminal. Request-evidence
   requires new nonduplicate evidence and subsequent explicit acceptance.
3. Acceptance permits only a v1 JSON download. Every packet retains the
   production block, zero-spend AUD boundary and unvalidated demand/revenue.
   The generic Command Centre cannot transition these review packets.
4. Nexus `/founder/opportunities`: Import Synthex proposal → select the matching
   canonical portfolio repository → Preview import → Save blocked review.
   Independent strict validation and founder-scoped idempotent persistence create
   one forecast-only blocked opportunity, never a task or execution admission.
   Full proposal remains in Synthex; Nexus stores bounded provenance and digest.

## Changed file groups

Synthex: `lib/opportunity-review/`, `app/api/opportunity-proposals/`,
`components/opportunity-review/`, `app/dashboard/opportunities/page.tsx`,
`components/marketing-agency/GovernedOpportunitiesPanel.tsx`,
`packages/control-module/src/intake/command-packet.service.ts`, `next.config.mjs`,
`.planning/ROUTE_REFERENCE.md`, relevant unit tests and this analysis/plan.

Nexus: `apps/web/src/lib/synthex/`,
`apps/web/src/app/api/founder/opportunities/import/`,
`apps/web/src/components/founder/opportunities/SynthexImportPanel.tsx`,
`OpportunitiesPageClient.tsx`, relevant tests and the feature operator guide.

Reused existing persistence, authentication, org/founder scope and registry
schemas. No new tables, dependencies or generic execution layer. The only build
configuration fix converts the canvg file URL to a native Windows path.

## Fresh Synthex evidence

- `node node_modules/jest/bin/jest.js --config config/jest/jest.worktree.cjs --runInBand --runTestsByPath tests/unit/opportunity-review/schema.test.ts tests/unit/opportunity-review/service.test.ts tests/unit/opportunity-review/api.test.ts tests/unit/components/OpportunityReviewWorkspace.test.tsx tests/unit/scripts/synthetic-opportunity.test.ts tests/unit/lib/command-packet.service.test.ts`: 6 suites, 65 tests passed.
- `node --test scripts/__tests__/next-config-file-paths.test.mjs`: 3 passed.
- `npm run type-check`: exit 0. Implementation leaves also ran fresh complete TypeScript checks.
- `npm run lint`: exit 0, zero warnings.
- `node scripts/security/route-safety-scan.mjs`: 764 routes, 0 new violations;
  65 existing baselined findings remain.
- `npm run build`: exit 0; compilation, TypeScript, 689 static pages and traces completed.
- Existing control-module package build/typecheck: exit 0. Fresh runtime import
  smoke denies every generic action with zero writes, proving compiled binding.
- Independent OpenAI review-agent: PASS, no remaining findings after fixes for
  generic packet mutation, organisation response races, unsafe/malformed URLs,
  and export/import byte-limit alignment. Review is not live-release approval.

## Nexus and cross-repository evidence

Final verified Nexus worktree:
`C:/Users/Disaster Recovery 4/.codex/worktrees/nexus-opportunity-verified`, branch
`codex/nexus-opportunity-verified`, same main SHA
`0ab7699c6d9529c789844bdb07e110c8ae8d2034`. The original isolated
`D:/nexus-opportunity-review` source is preserved and matches all 14 feature
files, including the final panel test fix. The dirty canonical Nexus checkout
remains untouched. The C: workaround avoided the slow D: dependency-link path.

Node 24.19.0, pnpm 9.15.0, existing frozen lockfile. Manifests/lockfiles unchanged.
Install skipped lifecycle scripts; no dependencies were added. A temporary
command shim selected the bundled Node 24 without modifying host configuration.

- `pnpm exec vitest run src/lib/synthex/__tests__/opportunity-import.test.ts src/lib/synthex/__tests__/import-projects.test.ts src/app/api/founder/opportunities/import/__tests__/route.test.ts src/components/founder/opportunities/__tests__/SynthexImportPanel.test.tsx src/components/founder/opportunities/__tests__/OpportunitiesPageClient.test.tsx`: 5 test files, 42 passed, 0 failed, exit 0. Final JSON receipt read back after formatting.
- `pnpm run type-check`: exit 0.
- `pnpm run lint`: exit 0.
- `pnpm run security:routes-check`: exit 0, 0 unprotected mutating routes.
- `node scripts/verify-web-ci-build.mjs` at repository root under Node 24:
  exit 0; existing build-only placeholder environment, compilation, TypeScript,
  10 static pages and traces completed. No credentials or environment files were
  written. Build placeholders do not prove live service configuration.
- `git diff --check`: exit 0 in both isolated candidates.
- Independent read-only re-review after final fixes: PASS, no findings.

Root cross-repository assertion passed with each repository's actual locked
runtime graph (Synthex Zod 4.4.3; Nexus Zod 4.6.5): actual Synthex service capture
→ acceptance → export → independent Nexus preview/import → retry. Exactly one
hermetic record, null economics, blocked review and approval requested. No HTTP,
live data or providers. Temporary source-loader assertions are integration
checks, not production sessions or signed harness receipts.

The builder's provisional service/API loaders used canonical installed libraries
before isolated dependencies were available. They are superseded by the final
locked-dependency tests and cross-repository assertion above. Initial Nexus
test-first execution was blocked by missing runner dependencies; uninterrupted
TDD is not claimed. Malformed URLs and Unicode truncation have observed
failing-assertion → passing-assertion regression evidence. The full isolated run
also caught ambiguous UI test selectors, fixed with scoped assertions and reset
fetch mocks; no production behavior was weakened.

## Remaining release gates

This is a local build candidate, not deployed production usability. Live schema
existence/RLS, cross-app authenticated sessions and real user smoke tests remain
unverified. The credential-free Synthex build warns about missing database,
Redis and provider settings; passing a build does not establish those services.
No signed export authority is claimed. Manual evidence remains a hypothesis.
No rendered browser verification was performed because live servers are excluded.

Senior Harness cannot start: required app runtime module is missing. Native
Codex disjoint implementation and independent review were used; no signed harness
admission or receipt is claimed. Applied Superpowers, Matt Pocock TDD, OpenAI
review-agent and prior marketing evidence/KPI skills within the authorised scope.
