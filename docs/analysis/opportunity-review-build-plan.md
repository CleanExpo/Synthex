# Synthex → Unite-Group Nexus opportunity review build

Historical planning snapshot: the restrictions and runtime observations below
describe the original synthetic slice. Subsequent user-authorised engineering,
publication and release admission are recorded in the current external SPM ledger;
this snapshot is not the current deployment authority or completion receipt.

07/10/2026. User-authorised continuation beyond the original synthetic slice.
Keep dirty canonical checkouts intact. No deploy, commit, push, live ingestion,
live database writes, migrations, credentials, schedulers or provider activation.

## Verified baselines and skills

Synthex main c1a11c12bbbfed21456fccacc19baed2c7eb89c2, isolated existing worktree
`C:\Users\Disaster Recovery 4\.codex\worktrees\synthex-opportunity-slice\Synthex`.
Unite-Group main 0ab7699c6d9529c789844bdb07e110c8ae8d2034, isolated worktree
`D:/nexus-opportunity-review` (branch codex/synthex-opportunity-review).
Existing canonical checkouts have unrelated work and remain untouched.

Loaded Superpowers using-superpowers, brainstorming, test-driven-development,
verification-before-completion; Matt Pocock's official engineering/tdd skill;
OpenAI review-agent; repository auth-patterns, ui-ux, build-orchestrator.
Read Senior Harness and Unlazy contracts. Harness driver fails before startup
with ModuleNotFoundError: app, so no signed admission/receipt is claimed. Native
Codex disjoint implementation lanes and independent review are the fallback.
Use existing user instruction to proceed; do not insert new skill approval
stages or change agent configuration/governance files.

## Outcome and implementation contract

An authenticated operator can capture a real, manually supplied opportunity,
retain source URL/publication or capture date and creator/source claims,
record Unite-Group evidence separately, choose a portfolio project reference,
and save a complete proposal. No synthetic fixtures appear in product surfaces.

Use existing CommandPacket storage in Synthex, not a new model or migration.
Every proposal has approvalGate=production_blocked, scenarioState=blocked,
status=pending (or blocked for rejection), executionBlocked=true in its durable
versioned routingHints envelope ({kind: opportunity_review, version: 1, clientRequestId, captureFingerprint, record}). Nothing enters a provider/execution/Linear approval
path. Existing generic packet approval already rejects production_blocked.

New Synthex interfaces:

- `lib/opportunity-review/schema.ts`: exported ProposalInputSchema, ReviewActionSchema,
  ProposalRecordSchema and NexusExportSchema + inferred types.
- `lib/opportunity-review/service.ts`: create/list/review/export functions;
  DB binding with injectable transaction-capable client for tests.
- `/api/opportunity-proposals`: GET list, POST capture, PATCH review decisions;
  existing APISecurityChecker and effective organisation resolver unchanged.
- `/api/opportunity-proposals/[id]/export`: authenticated GET accepted-only export.
- `/dashboard/opportunities`: real data list, capture form, review controls,
  evidence-request resolution, errors/loading states and Nexus download.
- Link from existing GovernedOpportunitiesPanel to new workspace.

Proposal fields: title; targetProject `{name, repository}` (planning reference,
not authority to access that project); targetBusiness; customerProblemHypothesis;
sources `[{url,capturedAt,publishedAt?,claims[]}]`; uniteEvidence
`[{reference,observation,capturedAt}]`; confidence (operator estimate, never
validated demand); assumptions[]; uncertainties[]; suggestedOwner;
kpi `{name,unit,baselineRequirement}`; successCriteria; stopCriteria;
nextValidationStep. Zero-spend AUD boundary and demand/revenue unvalidated flags
are server-owned constants. Arrays and text bounded and URL protocols restricted.

Capture clientRequestId UUID gives deterministic org-qualified packet ID and
idempotent creation. Conflicting retries fail. Decision PATCH carries id,
expectedRevision, action (`accept`, `reject`, `request-evidence`, `add-evidence`),
note and optionally new evidence. Optimistic atomic scoped update rejects races.
Rejected records are terminal. Evidence-requested cannot accept or export until
new nonduplicate evidence is added, then explicit acceptance. Acceptance requires
separate Unite evidence and a complete proposal; sources never count as demand.
No caller controls org/user, packet gate, blocked flags or arbitrary metadata.

Nexus export contract (versioned extended bundle):
`{version:1, packetId, revision, executionBlocked:true, review:{state:'accepted'},
 proposal:<ProposalInput plus server boundaries>,
 opportunity:{name,stage:'blocked_review',status:'blocked_review',source:'synthex',
 source_detail,next_action}}`.
No economics, probability, lead/contact IDs, provider task or executable action.
The existing Nexus founder opportunity API has no project/import/dedup fields,
so add a separate authenticated import route and visible import panel. Validate
the bundle independently in Nexus; choose/validate the target from Nexus's own
portfolio registry. Use deterministic founder-qualified UUID as the existing
crm_opportunities primary key for idempotent insert; preserve full proposal in
Synthex, with provenance/reference in Nexus's existing bounded source_detail.
Do not submit automatically or claim existing Nexus has JSON import already.

## Ownership / dependency graph

1. Backend leaf owns lib/opportunity-review/**, app/api/opportunity-proposals/**,
   tests/unit/opportunity-review/\*\*. Publishes schema and API contract before UI.
2. Synthex UI leaf owns components/opportunity-review/\*\*,
   app/dashboard/opportunities/page.tsx, GovernedOpportunitiesPanel.tsx and
   tests/unit/components/OpportunityReviewWorkspace.test.tsx. Depends on 1.
3. Nexus leaf owns new import schema/service/route/panel + native opportunity UI
   integration and tests only in D:/nexus-opportunity-review. Depends on export
   contract, not on a running Synthex server.
4. Build leaf owns next.config.mjs native-file-URL fix + focused regression test
   and route reference documentation. No other configuration/security changes.
   Root integrates, runs gates, and obtains independent defect-first review.
   No leaf reverts another's work or recursively delegates. Max four active builders.

## Agreed test seams and verification

Use public service/API/component boundaries, following Matt Pocock and
Superpowers red→green slices. No tests of private implementation details.
Service tests use a hermetic transactional store seam; API tests mock auth/DB
boundaries, never real credentials. UI tests exercise capture, review, request
evidence and export actions via mocked responses. Nexus tests prove malformed,
unaccepted, unblocked, forged economics and unknown-project imports fail;
unauthenticated/cross-founder access fails; retries produce one blocked record.
Tripwires guard provider/network/queue/CRM/messaging/spending capabilities in
Synthex service tests (the explicit Nexus import store is the sole CRM seam).
Build regression must fail on the old encoded Windows URL alias before fixing.

Run focused Jest/Vitest, Synthex type-check/lint/build/static scan, Nexus web
typecheck/lint/focused tests/build using its exact dependency/runtime contracts.
Do not start servers. Report missing environment/runtime requirements honestly;
never write production credentials or weaken gates to make a build pass.
Independent OpenAI review-agent review after integration. Fix actual defects,
then re-run affected gates. Record exact command output and remaining blockers.

## Risks / acceptance

Manual evidence is still a hypothesis until primary validation; no revenue
promise. Export is untrusted and Nexus revalidates it. Project labels do not grant
cross-project data access. Database existence/RLS deployment, cross-app live
sessions, and production operation cannot be proven with local mocks; no rollout
claim without a separately authorised deployment and live smoke check.
Finish local implementation and gates, or state the exact remaining blocker.

Final verification location: Nexus source copied with SHA256 checks to C:/Users/Disaster Recovery 4/.codex/worktrees/nexus-opportunity-verified (codex/nexus-opportunity-verified), same baseline. Both builds and final gates passed; see opportunity-review-completion.md. Original D: isolated source retained; canonical dirty checkouts untouched.
