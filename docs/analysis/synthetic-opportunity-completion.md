# Synthex bounded opportunity pathway — 07/10/2026

## Preflight and finish line (written before implementation)

[VERIFIED] Live `git ls-remote origin refs/heads/main` returned
`c1a11c12bbbfed21456fccacc19baed2c7eb89c2`. The isolated worktree is
`C:\Users\Disaster Recovery 4\.codex\worktrees\synthex-opportunity-slice\Synthex`,
branch `codex/synthetic-opportunity-slice`. D:/Synthex remains at
`4ca1b88aaf0fa379d457c76d7bb9823e90a9d979` on
`fix/migrate-deploy-visible-timeout`, with four untracked files preserved.
No pull/reset/stash/build is run in that checkout.

[VERIFIED] Vercel project `prj_gbQmHn6quoHgG3AswRrDoUlYaF40`, team
`team_KMZACI5rIltoCRhAtGCXlxUf`, latest production deployment
`dpl_8NTrAfLFSerkwh21Q2DWSZp1jKxE` reports READY and the same main SHA.
`synthex-sandbox` also exists. Supabase metadata lists Synthex project
`znyjoyjsvjotlzjppzal`, ACTIVE_HEALTHY, ap-southeast-1.
[UNCONFIRMED] Runtime configuration, database contents, RLS deployment and
provider readiness were not inspected; healthy metadata does not prove them.
[VERIFIED] DigitalOcean apps reference RestoreAssist, CCW-CRM, CARSI and
Unite-Hub. One droplet exists. [UNCONFIRMED] No Synthex ownership of that
droplet was established. No hosts were logged into.

[VERIFIED] Skills library: https://github.com/CleanExpo/skills-library at
`b1c374d5e1d1ff99a3379008483d9ad6e46c8824`. Read marketing-icp-research and
marketing-campaign-planner. Apply their evidence, audience, hypothesis and KPI
discipline; their public-SaaS examples and live research/budget suggestions do
not override this internal, synthetic-only, zero-spend brief.
[VERIFIED] Read README, docs/governance/{CLAUDE,CONSTITUTION,SECURITY,CONTRIBUTING}.md,
package scripts, FABEL_PLAYBOOK, evidence-standard and fable-engine skill.
No tracked AGENTS.md or root CLAUDE.md exists; session AGENTS instructions apply.
[INFERENCE] The supplied brief already authorises this bounded implementation,
so the fable-engine spec gate needs no additional confirmation. No production
or governance changes are authorised. Linear issue linkage remains unknown;
no issue is created because the brief excludes external writes.

Done when an operator-invoked, finite synthetic demonstration separates creator
inspiration from portfolio evidence, enforces accept/reject/request-evidence,
and emits decision-ready drafts and local pending/blocked packet previews with
focused tests and independent review. No application route/UI, database, env,
credentials, approval policy, worker or scheduler is changed.

## Evidence-backed gap register

| Gap                                       | Evidence and classification                                                                                                                            | Bounded response                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Creator path is disconnected              | [VERIFIED] prisma/schema.prisma Creator/UgcSubmission have no governed signal relation; lib/ugc/promote-submission.ts instead schedules calendar slots | Pure fixture adapter only                                                                                 |
| Evidence can be conflated                 | [VERIFIED] signal-ledger.ts accepts generic evidenceRefs and confidence; creator popularity is not independently rejected                              | Separate source claims, synthetic portfolio evidence, assumptions and validation gaps                     |
| Review lifecycle missing for this pathway | [VERIFIED] no matching creator-to-opportunity adapter found in app/lib search                                                                          | Explicit in-memory decisions; rejected terminal; awaiting evidence cannot promote                         |
| Provenance lost in display                | [VERIFIED] opportunity-reader.ts omits sourceUrl/sourcePath from its summary                                                                           | Retain fixture URL and capture/publication date in output                                                 |
| Tenant conventions differ                 | [VERIFIED] creator routes use withAuth home org; opportunity route uses effective org                                                                  | Fixture sessions only; enforce org scope; defer real auth integration                                     |
| Handoff writes external state             | [VERIFIED] app/api/command-centre/intake/route.ts calls persistCommandPacket; service uses Prisma create with status pending                           | Local packet preview using existing pure helper; no HTTP/DB submission                                    |
| Blocked flag is not durable               | [VERIFIED] intake response sets executionBlocked=true; PersistedCommandPacket has no such field                                                        | Preview has blocked=true and production_blocked gate; durable contract needs separately authorised design |
| Mission Control is a separate store       | [VERIFIED] lib/mission-control/mission-store.ts writes Organization.settings                                                                           | Do not equate Command Centre packet with Mission Control mission                                          |
| Live collection has side effects          | [VERIFIED] research-bridge.ts persists and may write Obsidian; UGC promotion creates calendar slots                                                    | Import pure scoring only; test effect tripwires                                                           |
| Skill/example identity drift              | [VERIFIED] marketing skills describe synthetic-data SaaS; governance describes internal marketing app                                                  | Use internal field-service operator hypothesis, never SaaS economics                                      |
| Demand is unknown                         | [UNCONFIRMED] no live customer evidence accessed                                                                                                       | Mark all fixtures synthetic and real demand unvalidated                                                   |
| Full baseline quality unknown             | [UNCONFIRMED] fresh checkout initially has no dependencies                                                                                             | Install locked dependencies without lifecycle hooks; record actual gates                                  |

## Roadmap (dependencies and verifiable completion)

Moves 1–12 are within the current slice; later moves require separate scope.

| #   | Move                                                     | Dependency                                  | Completion check                                                                |
| --- | -------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Verify live main and dirty status                        | Git access                                  | Exact SHA/status recorded                                                       |
| 2   | Create isolated branch/worktree                          | 1                                           | HEAD matches SHA, clean initial status                                          |
| 3   | Read governance and scripts                              | 2                                           | Auth, internal identity and forbidden effects documented                        |
| 4   | Locate hosting and skills library                        | Account read access                         | Metadata/repo SHA recorded; unknowns labelled                                   |
| 5   | Map existing creator/research/opportunity/packet paths   | 3                                           | Evidence paths and side effects listed                                          |
| 6   | Lock synthetic source attribution                        | 5                                           | URL/date validation tests                                                       |
| 7   | Separate inspiration and portfolio evidence              | 6                                           | Output and evidence-only gate tests                                             |
| 8   | Add in-memory org-scoped decisions                       | 7                                           | Accept/reject/request-evidence tests; no real auth claims                       |
| 9   | Enforce promotion blocking and deduplication             | 8                                           | Rejected/awaiting evidence and repeated fixture tests                           |
| 10  | Produce complete decision-ready draft                    | 9                                           | Required fields, confidence, KPI/baseline, stop rules asserted                  |
| 11  | Build pure Command Centre handoff preview                | 10                                          | Existing schemas validate pending, production_blocked, executionBlocked preview |
| 12  | Run finite demo, quality checks and independent review   | 11                                          | Actual commands/results and findings recorded                                   |
| 13  | Align effective-organisation auth across creator path    | Owner-approved scope after 12               | Multi-business API isolation tests                                              |
| 14  | Design durable reject/request-evidence lifecycle         | 13; persistence approval                    | Audited transitions, rejected rows cannot be submitted                          |
| 15  | Define Command Centre versus Mission Control destination | Owner decision after 12                     | Agreed intake contract and display location                                     |
| 16  | Design durable blocked state and idempotent submission   | 14,15; schema/production approval if needed | Transaction/race/retry tests, no approval enables execution                     |
| 17  | Add authenticated review UI and source inspection        | 13–16                                       | Accessible UI workflow and tenant tests; real data only                         |
| 18  | Authorise evidence acquisition separately                | Privacy/permissions/source-owner decisions  | Provenance, retention and consent verified before collection                    |
| 19  | Validate problem and baseline                            | 18                                          | Primary evidence supports hypothesis; baseline measured                         |
| 20  | Propose zero-spend experiment for review                 | 19                                          | Named owner, evidence-based success/stop rules, explicit action gate            |
| 21  | Observe outcomes and close feedback loop                 | Explicit experiment approval                | Measured outcome, no invented economics, retain failed hypotheses               |

## Build / cleanup plan

[INFERENCE] Use one offline workflow module, one synthetic fixture/demo and
focused tests. Reuse signal-ledger scoring and the existing pure board-input
helper. Keep state private in memory and return defensive copies. Add tests
before implementation. No broad refactoring, dependencies or new abstraction
layer. No production endpoint accepts synthetic data. Duplicate fixture IDs
are scoped by org; identical replays are no-ops and changed replays fail.
Rejected items stay terminal. Request-evidence may be reviewed again, but only
accepted records with separate portfolio evidence pass promotion. Confidence
describes synthetic hypothesis support, never real validated demand.

The preview is a local artefact, not a submitted Mission Control packet.
Persistence is not necessary for this slice; actual submission is deferred
because the verified intake writes the database and lacks a durable blocked
field. Never call it or import the Prisma binding in this slice.

Quality commands: focused npm test -- --runInBand --runTestsByPath ...,
node_modules/.bin/tsx scripts/synthetic-opportunity-demo.ts,
npm run type-check, npm run lint, npm run build. Avoid build:vercel because it
runs migrations. Do not link/copy production env. Network/effect tripwires
cover the workflow dependency graph. Application-wide build may be blocked
by missing configuration; record it honestly and do not add live credentials.

## Red team: What would still prevent us from using this safely?

[INFERENCE] Synthetic evidence proves workflow mechanics only. Real use still
needs aligned tenant auth, permissions/retention for collected sources, primary
problem evidence, operator ownership, durable rejection/idempotency, and a
verified review destination whose approval cannot silently trigger execution.
[UNCONFIRMED] Production provider, RLS and auth behaviour remain unverified.
No guaranteed income or revenue validation is asserted. A successful local
demo does not authorise deployment, ingestion, contact, spending or scheduling.

## Verification and final gap updates

[VERIFIED] Added only these files: this report,
`scripts/offline-opportunity/workflow.ts`, `scripts/offline-opportunity/fixture.ts`,
`scripts/synthetic-opportunity-demo.ts`, and
`tests/unit/scripts/synthetic-opportunity.test.ts`. Existing product behaviour
and approval/auth controls were not edited. Simplifications: reuse pure
signal scoring and board-input drafting; no new dependencies, persistence,
API endpoint, UI surface, server, background service or provider adapter.

[VERIFIED] Dependency preparation:
`npm ci --ignore-scripts --offline --no-audit --no-fund` succeeded (2058 packages,
using the lockfile and cache; no lifecycle hooks). Existing package
`npm run build` succeeded in both `packages/control-module` and
`packages/brand-config` (the latter reported existing export-order warnings).
`node node_modules/prisma/build/index.js generate --no-hints` succeeded,
generating Prisma Client 7.7.0 locally without connecting to a database.
No env file was copied, linked, created or edited.

[VERIFIED] Focused and adjacent regression checks:

```powershell
node node_modules/jest/bin/jest.js --config config/jest/jest.worktree.cjs --runInBand --runTestsByPath tests/unit/scripts/synthetic-opportunity.test.ts tests/unit/marketing-agency/signal-ledger.test.ts tests/unit/unite-command-center/board-input-service.test.ts tests/unit/lib/command-packet.service.test.ts
```

Actual output: `Test Suites: 4 passed, 4 total`; `Tests: 32 passed, 32 total`.
The same four suites were rerun after final formatting and restoration of the
locked dependency tree: again `Tests: 32 passed, 32 total` (exit 0).
The new suite contributes 13 tests. The persistence regression suite uses its
existing mocked Prisma client. The initial tests-first command failed to load
because the new test had an incorrect relative import; it did not execute any
tests. That import was corrected before the successful verification.
Direct Jest invocation avoids this host's npm PowerShell wrapper dropping
`--runInBand` / `--runTestsByPath` options.

[VERIFIED] `node node_modules/tsx/dist/cli.mjs scripts/synthetic-opportunity-demo.ts`
exited 0; its local JSON output has `status=pending`, `executionBlocked=true`,
`submitted=false`, `approvalGate=production_blocked`, and retains the synthetic
source URL. Invocation is finite; all workflow maps die at process exit.
This is a Command Centre-compatible preview, not a Mission Control submission.

[VERIFIED] Separate strict check for scripts (excluded by the root tsconfig):

```powershell
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --moduleResolution bundler --module esnext --target es2020 scripts/offline-opportunity/workflow.ts scripts/offline-opportunity/fixture.ts scripts/synthetic-opportunity-demo.ts
```

Exited 0. Explicit lint including scripts (normally ignored by repository lint)
also exited 0:

```powershell
node node_modules/eslint/bin/eslint.js --no-ignore --max-warnings 0 scripts/offline-opportunity/workflow.ts scripts/offline-opportunity/fixture.ts scripts/synthetic-opportunity-demo.ts tests/unit/scripts/synthetic-opportunity.test.ts
```

[VERIFIED] `node scripts/security/route-safety-scan.mjs` exited 0: 762 routes,
65 existing baselined findings, zero new violations. This heuristic scan is
not proof that production auth/RLS is safe. The new test separately traverses
the workflow's dependency graph and rejects unapproved external imports,
dynamic imports, networking and timers; runtime tripwires cover fetch, HTTP,
HTTPS, sockets, child processes and intervals. No workflow external effect ran.

[VERIFIED] Independent read-only reviewer verdict PASS: no critical/high
defects found in evidence separation, org scope, review blocking, clones,
idempotency or packet boundaries. Its one note requested replacing this
verification placeholder; addressed by this section. Review is not deployment
approval and did not execute tests; the leader ran the checks above.

[VERIFIED] Live main was rechecked and remains the same SHA. Dirty checkout
HEAD/status rechecked unchanged. No commit, push, PR, merge, deploy, external
write, source/customer collection or scheduled/live service was performed.

[VERIFIED] Application-wide `npm run type-check` and `npm run lint` both exited 0. Targeted `prettier --check` also passed for all four TypeScript files.
[VERIFIED] The first `npm run build` exited 1: jsPDF could not resolve `canvg`
from `app/dashboard/seo/audit/page.tsx`. [INFERENCE] The initial diagnosis was
that the offline install had omitted this optional dependency; that diagnosis
was incomplete. [VERIFIED] `canvg` 3.0.11 is already locked as jsPDF's optional
dependency in package-lock.json. Recovery command:
`npm install --ignore-scripts --no-save --package-lock=false --no-audit --no-fund canvg@3.0.11`.
[VERIFIED] That recovery exited 0, but npm changed transient dependency versions
while resolving metadata. To avoid testing an unpinned tree, reran
`npm ci --ignore-scripts --offline --no-audit --no-fund`: exited 0, 2058 packages
restored from the original lockfile, including `canvg` 3.0.11. Regenerated the
local Prisma client successfully. No manifest or lockfile was changed.
[VERIFIED] The second `npm run build` also exited 1 with the same jsPDF/canvg
resolution error. Exact baseline blocker: `next.config.mjs:355` assigns the
canvg alias from `new URL('./lib/empty-module.cjs', import.meta.url).pathname`.
On this Windows worktree that yields
`/C:/Users/Disaster%20Recovery%204/.codex/worktrees/synthex-opportunity-slice/Synthex/lib/empty-module.cjs`.
`existsSync` returned false for that configured alias; `fileURLToPath` produced
the native path and `existsSync` returned true. `require.resolve('canvg')`
also succeeded after locked dependency restoration. This is an existing
cross-platform build-configuration defect, not a synthetic workflow error.
No third build attempt or next.config edit was made: broad/unrelated fixes are
outside this brief. A separately scoped fix should convert file URLs with
`fileURLToPath` and check equivalent aliases before rerunning the Windows build.
Both build attempts used `NEXT_TELEMETRY_DISABLED=1`; neither used the
migration-bearing `build:vercel` script.

### Remaining gaps and next slice

[VERIFIED] Moves 1–11 completed locally; move 12 completed tests, lint,
typecheck, static scan and independent review but is BLOCKED on the existing
Windows build alias defect above. The slice is tested locally, not fully
application-build-verified and not approved for rollout. Attribution, evidence separation, explicit decisions, blocking and
deduplication now have focused proof. Request-evidence and rejected records
cannot be reopened in this bounded demonstration: use a new fixture revision.
This protects promotion but is not a durable evidence-resolution lifecycle.

[UNCONFIRMED] Real Supabase auth/tenant isolation, production RLS, actual
customer demand, runtime provider configuration and Mission Control submission
remain unverified. Fixture sessions validate mechanics only and must never be
used as production authentication.

[INFERENCE] Recommended next separately authorised slice: define which review
destination owns opportunity proposals (Command Centre versus Mission Control),
then design an effective-org-authenticated, durable, idempotent intake and
rejection/evidence-resolution contract whose blocked state survives storage.
Keep provider execution unavailable. Review that contract and its tenant,
retry/race and rejected-promotion tests before any persistence/schema/API work.
No live ingestion or process is needed for that design slice.
