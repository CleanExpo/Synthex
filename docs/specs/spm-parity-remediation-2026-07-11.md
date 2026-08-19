# SPM Spec — Supabase Parity-Audit Remediation

`/spm` output · 2026-07-11 · repo `CleanExpo/Synthex` @ main `d98289e1` · prod project `znyjoyjsvjotlzjppzal` · **read-only run; no build performed**
Status: **COMPLETE** — 7/7 bench contracts folded (§7 receipt), judge challenge answered (§8), synthesis decisions D1–D8 encoded, recommendation **APPROVE BUILD conditional** (§19). T3 adversarial verify: COMPLETE — 7 findings (3 blocking), all folded into this revision (§7).

---

## 1. Task

Produce the build-ready remediation spec that closes every finding in the Supabase parity audit (`docs/db/supabase-parity-audit-2026-07-11.md`, produced 2026-07-11 at main `d98289e1` by a 22-agent repo⇄prod audit of prod project `znyjoyjsvjotlzjppzal`; ~23 users, internal tool). The user goal is literal: _"correct these errors and mistakes and clean it all up completely tested until we hit 100%."_ This spec defines what "100%" means as a bounded, per-class, evidence-backed contract (§15) rather than an unqualified slogan, and sequences the work so that no autonomous step ever holds a prod **database** write credential — all prod DB mutation lands inside **founder gate F1**, while F2's edge-function deploys and cron-command updates are founder-authorized actions executed live in the founder's presence via MCP (classifier-gated), never run unattended.

PR #724 (`chore/supabase-parity-20260711`, CI green — <https://github.com/CleanExpo/Synthex/pull/724>) already carries the first tranche: `schema.prisma` adoption of prod-first columns, the additive/idempotent migration `prisma/migrations/20260711120000_schema_parity_reconcile`, the founder script `docs/db/ledger-reconcile-2026-07-11.sql` (9 ledger rows with verified sha256 checksums), and the legacy `supabase/` file purge. This spec governs merging #724 and finishing everything it does not: auth-event consolidation, table re-adoption with RLS, dead-artifact cleanup, and edge hardening.

## 2. Project context

- **Prod is founder-gated for writes.** CI does **not** auto-apply migrations; every DDL and every ledger row is a manual founder SQL-editor apply. This is not a limitation to route around — it is the safety boundary this spec is built on.
- **Two ledgers, not one** (data seat, d4). `_prisma_migrations` governs `prisma migrate`; `supabase_migrations.schema_migrations` governs `supabase db push` / `scripts/safe-migrate.sh` (restricted to `supabase/migrations` files). Hand-applies update **neither** unless we write the row explicitly. Prod facts at audit time: `_prisma_migrations` = **33 rows**; **296** public tables; **231** Prisma-mapped (65 non-Prisma).
- **The audit lives on the PR branch, not on main.** Main `d98289e1` has no `docs/db/` dir yet; the audit doc, migration, and ledger script are carried by #724 (CI green, unmerged). Merging #724 (Phase 1) is what brings them onto main. This is expected, not drift.
- **MCP is the reliable prod connection**; `:5432` direct is unreachable from this box (memory: `synthex-prod-migration-gate`). Read-only re-verification and branch DBs go through Supabase MCP; PowerShell has egress, the Bash tool does not.
- Prior parity work on this repo used git-blob sha256 checksums to reconcile ledger rows (2026-07-09 session, 30→33). The same method backs the 9 checksums in #724.

## 3. Problem statement

The audit enumerated eight classes of repo⇄prod divergence plus two live-failing controls. Concretely:

1. **Ledger drift (C1).** `_prisma_migrations` sits behind the repo's migration tree; 9 hand-applied files have no ledger rows, so `prisma migrate status` and any drift tool mis-report. A 10th row (the #724 re-adoption migration) cannot be computed until #724 merges (checksum is taken from the merged blob — ledger script STEP 4).
2. **Schema column parity (C2).** Prod carries columns the repo schema never declared ("prod-first" columns). #724 adopts them into `schema.prisma`; the additive reconcile migration makes a fresh DB match prod.
3. **Prod-only tables absent from schema (C3).** Five tables exist in prod but not in `schema.prisma` and must be re-adopted: `platform_algorithms`, `ranking_signals`, `signal_weights`, `source_provenance`, and `milestone_events`. The archived DDL for the first four (`.claude/archived/2026-04-27/sql-drift/prisma-root/migration-2026-04-02-syn603-algorithm-kb.sql:18-123`) has **zero RLS**; `milestone_events` carries a non-conventional client SELECT policy (no `TO` clause, `org = auth.uid()`).
4. **auth_events is dead and its writer is broken (C4).** `lib/auth/monitoring.ts:263-281` inserts into `auth_events` using the **anon** client (`:266` `SUPABASE_ANON_KEY`) and never reads the returned `{ error }`; the `try/catch` at `:282-285` only catches _thrown_ errors, and supabase-js does **not** throw on RLS denial. Result: auth events silently fail to persist. Nothing reads the table; brute-force detection is in-memory; Sentry is a stub. The table has 0 rows.
5. **churn-scorer is dead and its cron fails nightly (C5).** `cron.job` row `jobid=1` (`daily-churn-score`, `0 2 * * *`, `active=true`) POSTs an anon-JWT to `functions/v1/churn-scorer`. The deployed function's upstream fetch hits the nonexistent route `/api/internal/churn-scorer` (a **404 at the route layer**, per audit §4, failing since ~2026-04-09); the function consequently returns **500 to its cron caller** — observed live: 500, 2,230 ms, version 3, at 2026-07-11 02:00:03 UTC via `get_logs`. Both statements are the same failure at two layers. No ticket, commit, or README ever committed churn scoring; `docs/pm/capability-matrix.csv:24` marks retention incomplete; `client_churn_risk` provenance traces to an aborted syn618 CLI-to-prod spike (`docs/sign-off/rls-baseline-post-batch1.md:39`).
6. **17 known-dead orphan tables (C6).** Non-Prisma tables whose DDL is verbatim-recoverable from the tracked `supabase/migrations/20250115000001_unified_schema.sql`.
7. **5 unknown-origin orphan tables (C7).** Non-Prisma tables with no recoverable DDL in the repo; `client_churn_risk` is one (traced to syn618). Different irreversibility class from C6.
8. **Repo hygiene + standing blindness (C8).** Legacy `supabase/` files (purged in #724), plus the absence of any standing drift-visibility gate, RLS coverage check for non-Prisma tables, or versioned waiver list — so this drift can silently recur.

Plus a **cross-cutting security rider**: all six cron-invoked edge functions currently deploy with **`verify_jwt=false`** — fully unauthenticated triggers, no platform JWT gate at all (audit §4, prod state). Flipping them to `verify_jwt=true` would still be insufficient — the **public** anon key is itself a valid JWT and passes the gate — so the load-bearing control is an in-handler constant-time per-function secret; F2 additionally sets `verify_jwt=true` as defense-in-depth. This surfaced from the churn-scorer investigation and the board mandated folding it into scope (P6).

**Class-disposition matrix** (the single-glance index; "100%" = every row Closed at its proof class):

| Class | Finding                                             | Disposition                                              | Proof class                    | Phase | §15 criteria           |
| ----- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------ | ----- | ---------------------- |
| C1    | `_prisma_migrations` 9 rows behind (+10th blocked)  | Ledger reconcile → 43 rows, checksum-verified            | proven-after-founder-gate      | P4    | 1, 2, 3, 4             |
| C2    | Prod-first columns absent from `schema.prisma`      | #724 adoption + additive migration + waiver-list diff    | proven-on-branch               | P1/P3 | 5, 6                   |
| C3    | 5 prod-only tables absent from schema, 4 with 0 RLS | Re-adopt with RLS + policies mirrored from prod          | proven-on-branch               | P3/P4 | 7, 8                   |
| C4    | `auth_events` dead; anon writer swallows RLS errors | Consolidate into `audit_events_immutable`, PII-min       | proven / proven-on-branch      | P2    | 9, 10, 11, 12          |
| C5    | churn-scorer 500 nightly; dead function + cron      | Kill: archive → cron disable → Linear ticket             | proven / proven-after-gate     | P0/P4 | 13, 14                 |
| C6    | 17 known-dead orphan tables                         | Reversible DROP, backup-gated, DDL-recoverable           | proven-after-founder-gate      | P4    | 15                     |
| C7    | 5 unknown-origin orphan tables                      | Provenance → capture → RENAME → 90-day burn-in           | proven-after-founder-gate      | P0/P4 | 16, 17                 |
| C8    | Legacy `supabase/` + no standing drift visibility   | Purge (#724) + drift/RLS/waiver gates + preflight edit   | proven                         | P1/P5 | 18, 19, 20, 21, 22, 23 |
| rider | Cron-invoked edge fns gated only by anon-valid JWT  | Per-function secret + atomic cron update, canary rollout | proven-after-founder-gate (F2) | P6    | 25, 26                 |

## 4. Desired outcome

All eight audit classes are closed, each with proof at its designated gate class — `{proven | proven-on-branch | proven-after-founder-gate}` — and the repo is left with standing gates so the drift cannot silently return:

- Repo and prod agree on schema and ledger: `_prisma_migrations` reaches **43 rows** (33 + 9 + 1) with names and sha256 checksums programmatically verified byte-for-byte; a Prisma-7 `migrate diff` filtered through the DROP-line filter and compared to a **versioned waiver list** yields an empty remainder.
- Auth-event logging survives as a **control** but flows through the canonical, service-role, error-checked path (`lib/security/audit-logger.ts`), with PII minimised; `auth_events` is retired.
- The dead churn-scorer function and its failing nightly cron are killed reversibly, the decision recorded as a Linear ticket, and the rebuild explicitly foreclosed.
- The 17 known-dead tables are dropped (backup-gated, re-verified, recoverable); the 5 unknown-origin tables are provenance-traced, captured, renamed for a 90-day burn-in, and only then considered for a separate founder-gated drop.
- The cron-invoked edge functions enforce a per-function secret; cron commands are updated atomically so no nightly job 401s.
- Standing gates — `migration-drift-visibility.yml` (with a populated `PROD_DB_READONLY_URL`), the RLS coverage check, and the waiver-list diff — are in place.

No autonomous step ever holds a prod **database** write credential (QA q1). All prod **DB** mutations occur inside **founder gate F1** (one appended SQL-editor session); **founder gate F2** (edge secrets + cron command update) is a founder-authorized action executed live in the founder's presence via MCP `deploy_edge_function` (classifier-gated), never run unattended.

## 5. Scope (IN / OUT)

### In scope

- **IN-1** Merge PR #724 (owner gate) — brings schema-column adoption (C2), the additive reconcile migration, the ledger script, and the `supabase/` purge (C8) onto main.
- **IN-2** auth-event **consolidation** into `audit_events_immutable` via `auditLogger.logAuth`, error-checked, PII-minimised, `auth_events` retired (C4 · D1).
- **IN-3** Re-adoption migration for the 5 prod-only tables with **RLS + policies mirrored from live prod** `pg_policies` (C3 · D3), `CREATE IF NOT EXISTS` + guarded + ledger-baselined (j6).
- **IN-4** churn-scorer **kill path** — archive source, disable cron, Linear ticket, foreclose rebuild (C5 · D2).
- **IN-5** 17 known-dead tables — reversible DROP, backup-gated (C6 · D3-5a).
- **IN-6** 5 unknown-origin tables — provenance → capture → RENAME to `zzz_deprecated_<name>` → 90-day burn-in → separate founder-gated drop decision (C7 · D3-5b).
- **IN-7** Ledger reconcile: 9 rows + 10th (post-#724 merge) + the `supabase_migrations.schema_migrations` row for the re-adoption file (C1 · D4).
- **IN-8** Standing gates: `migration-drift-visibility.yml`, RLS coverage manual verification on branch, versioned waiver list, `scripts/db_preflight.cjs` surgical update (C8 · j4/q3/a3/d1).
- **IN-9** Edge-secret hardening for the cron-invoked functions, cron commands updated atomically (security rider · D5 · P6).

### Out of scope (D6)

- §17.4 Track-B founder packet (separate program).
- **Churn-scoring rebuild** — foreclosed with evidence (p1); capability-matrix gap stays open for normal prioritisation.
- Repo-wide RLS no-policy program (61 tables) — a separate effort.
- Normalising the waived benign variances (they are waived, not fixed).
- Migration-dir timestamp renames (two `20260710140000_*`, two `20260710150000_*`) — order deterministically by full-name sort; **defer** renaming (post-insert renames desync ledger rows), document only (d4).
- Any new backup or PII-redaction **infrastructure** (we reuse existing machinery, §6).

## 6. Existing capability review (do not rebuild)

| Capability                                                                                 | Where                                                                                                                                                               | Reuse                                                                                                                            |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Canonical audit logger (service-role, error-checked)                                       | `lib/security/audit-logger.ts:154-198` (`writeImmutable` → `if (error) throw error`, `logAuth`)                                                                     | C4 consolidation target (D1)                                                                                                     |
| Service-role Supabase client                                                               | `lib/supabase-server.ts:96-108` (`createServerClient`)                                                                                                              | C4 write path                                                                                                                    |
| Broken auth-event writer (to retire)                                                       | `lib/auth/monitoring.ts:263-285` (anon client, unchecked insert)                                                                                                    | C4 — fix call site then retire table                                                                                             |
| Prod-safe migrate wrapper                                                                  | `scripts/safe-migrate.sh` (`AFFECTED_TABLES`, covers 6 tables)                                                                                                      | j5 — extend or state non-coverage                                                                                                |
| Ledger verifier (EXTEND — authorized in-scope code change, exempt from reuse-only framing) | `scripts/db_ledger_check.cjs` (today: names only + `ORDER BY migration_name DESC LIMIT 20` off `rowCount` — **no checksum computation, cannot count 43**)           | build extends it: `count(*)` no LIMIT + sha256-vs-file-bytes + non-zero-on-mismatch + positive line (C1 post-apply, s5-residual) |
| Drop-candidate preflight                                                                   | `scripts/db_preflight.cjs:13-40` (26 hardcoded expected tables — the 17 known-dead drop candidates are a subset; 9 are live tables that must remain), EXPECTED list | q3/a3 surgical update                                                                                                            |
| Schema-drift checker                                                                       | `scripts/check-schema-drift.mjs` (fail-safe paths `:145-151,:186-193,:256-264`)                                                                                     | q4 — require POSITIVE stdout line                                                                                                |
| RLS coverage validator                                                                     | `scripts/validate-rls-coverage.js:27-39,82-89` (schema.prisma models only)                                                                                          | d3 — structurally blind to non-Prisma tables                                                                                     |
| Prisma-7 migrate-diff conventions                                                          | `.claude/rules/database/supabase-migrations.md:24-25`, DROP-filter `:59-65`                                                                                         | d1 waiver-list gate                                                                                                              |
| Real pg_dump backup                                                                        | `scripts/db/migrate.js:306-338` (`npm run db:backup`)                                                                                                               | o1 Phase-0 backup                                                                                                                |
| Per-function cron secret pattern                                                           | `lib/auth/cron-auth.ts`                                                                                                                                             | D5 `CRON_SECRET_<NAME>`                                                                                                          |
| Jest integration sandbox guard                                                             | `tests/integration/setup/sandbox-guard.ts:25-53` (`:5499`/`:6399`), `global-setup.ts:36-40`                                                                         | q1/q4/D7 verification lane                                                                                                       |
| Supabase MCP surface                                                                       | `get_edge_function`, `deploy_edge_function`, `create_branch`, `execute_sql`, `get_advisors`, `get_logs`                                                             | archive/deploy/branch-proof/re-verify                                                                                            |

**Do not build:** a new backup tool, a new audit sink, a new RLS framework, a new churn scorer, or a CLI edge-deploy path (none exists; MCP `deploy_edge_function` is the only route — o4).

## 7. Specialist board — receipt

`leveling_version: 1.0` · `board_version: 1.0` · Tier **T3** (axes F2 I2 N1 X2 S2, sum **9**; **I=2 and S=2 each auto-promote**). No project board override; no operator tier pin. **NEXUS wrapper** applied to all seats with the **Delegation AND Memory** sections stripped (Memory contradicts the leaf-agent guard). Seven seats convened in one parallel dispatch (models = requested intent; serving model not observable from output).

| Seat                   | Model req. | Verdict                                     | Conf. | Themes folded                                                                                                                                          |
| ---------------------- | ---------- | ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| architect              | Opus       | needs-work                                  | 0.80  | a1 cron-pairing · a2 auth consolidation · a3 preflight two-gate                                                                                        |
| security-reviewer      | Opus       | needs-work                                  | 0.84  | s1 RLS-mirror · s2 no anon insert · s3 PII posture · s4 edge secret · s5 ledger verify                                                                 |
| qa-verification-lead   | Opus       | needs-work                                  | 0.80  | q1 no prod write cred · q2 branch-DB proofs · q3 preflight · q4 fresh-sandbox+positive drift line · q5 ledger 43 sequencing + monitoring root-cause    |
| devils-advocate-judge  | Opus       | needs-work (score **61/100**, REDUCE SCOPE) | 0.78  | j1 never-drop-unknowns · j2 re-verify at execution · j3 auth keep-vs-kill first · j4 bounded-100% · j5 route via safe-migrate · j6 guarded re-adoption |
| product-manager        | Sonnet     | needs-work                                  | 0.78  | p1 foreclose churn rebuild · p2 split orphan gates · p3 explicit OUT list                                                                              |
| domain-specialist/data | Sonnet     | needs-work                                  | 0.72  | d1 Prisma-7 diff + waiver list · d2 RLS-missing · d3 coverage blind · d4 two-ledger policy                                                             |
| ops-cost-realist       | Sonnet     | needs-work                                  | 0.82  | o1 backup gate + read-only secret · o2 reversible-first · o3 cron.alter_job + archive · o4 canary edge rollout                                         |

**Divergence:** `verdict_split = 0.00` (7/7 needs-work — unanimous criticism; no pass, no fail). `fix_overlap` = **0.00 lexical / ≈0.30 canonical** (5 shared themes under distinct slugs: RLS-MIRROR s1×d2, REVERSIBLE-ORPHANS j1×o2×p2, LEDGER-VERIFY s5×q5×d4, EDGE-SECRET a1×s4×o4, BOUNDED-100% j4×q4). **Ramp decision:** split = 0 with non-pass verdicts → _unanimous-criticism_ rule → **fold ALL must_fix, no round 2**. **Hard floor:** no security verdict ≥0.8 fail → not triggered.

**One must_fix retired by evidence:** security's ledger-checksum-algorithm claim (that the method used git `hash-object` framing) is false — the method is sha256 of raw file bytes via `git show <blob> | sha256sum`, proven equal to Prisma's own checksums on the 3 prisma-self-applied rows (2026-07-09), and the data seat independently recomputed all 9 checksums at `d98289e1` matching byte-for-byte. The **residual** requirement — programmatic post-insert verification (`scripts/db_ledger_check.cjs`) — is kept as criterion 2.

**T3 adversarial verify pass (non-author, Opus):** 7 findings (3 blocking — ledger-verifier capability gap, verify_jwt posture inversion, F1 baseline arithmetic; 4 minor), ALL folded into this revision; criteria-completeness check passed (30/30 must_fix traced, no watering-down).

## 8. Judge challenge

Draft score **61/100 — REDUCE SCOPE**, scored against the _pre-synthesis_ shape (an unqualified "drop everything and hit 100%" sketch). All six judge must_fix are folded into named §15 criteria:

- **j1 → C6/C7 split + criteria 15/16/30.** Never DROP the 5 unknown-origin tables until provenance is established; reversible path only. Encoded as D3-5b (rename-not-drop, burn-in).
- **j2 → criterion 17.** Re-verify every point-in-time claim at execution time before any irreversible step: fresh row-counts, fresh ref-greps (including un-merged branches + Vercel cron handlers), confirm no other caller of churn-scorer.
- **j3 → D1 + criterion 9.** auth_events keep-vs-kill decided **before** wiring: KEEP the control, CONSOLIDATE into `audit_events_immutable`; the call site's runtime already supports a service-role client (`lib/supabase-server.ts:96-108`).
- **j4 → §15 whole + criteria 6/19/27.** Replace "100%" with bounded per-class proof + founder evidence artifacts + standing drift visibility (`migration-drift-visibility.yml`).
- **j5 → criterion 23.** Route prod applies through existing safety machinery: extend `scripts/safe-migrate.sh` `AFFECTED_TABLES` (currently 6 tables, none touched here) **or** explicitly state non-coverage with rationale.
- **j6 → criteria 1.** The re-adoption migration must be `CREATE IF NOT EXISTS` + guarded + ledger-baselined, or the founder apply breaks.

The judge's core challenge — _"is an unbounded 100%-cleanup on an internal 23-user tool worth the irreversibility risk?"_ — is answered by REDUCING to reversible-first handling everywhere (rename before drop, backup before drop, archive before disable), a bounded per-class 100% contract, and a strict two-founder-gate execution model. Present-tense risks (auth-events broken writer, DDL re-adoption) are ordered **before** dormant cleanup (PM sequencing).

### 8b. Adversarial verify pass (T3-mandatory)

Runs post-draft, non-author model, opus-adversary style. Expected probe surfaces and pre-registered responses (to be reconciled before emission):

- "43 rows claimed before #724 merges" → criterion 29 forbids it; the 10th checksum is computed from the merged blob (ledger STEP 4).
- "monitoring.ts fix claims persistence but never proves RLS-denied insert now surfaces" → criterion 10 mandates a new branch-run integration test (zero existing coverage).
- "rename keeps the table visible to PostgREST/advisors" → D3-5b keeps it in `public` deliberately (avoids `SET SCHEMA`'s silent visibility change) and relies on a 90-day zero-access log burn-in, not on invisibility.
- "safe-migrate covers none of these tables, so j5 is vacuous" → criterion 23 accepts an explicit non-coverage statement as satisfying j5, provided the rationale is recorded.

Any surviving adversary finding is folded here before the spec is emitted.

## 9. Proposed solution (phases)

Eight audit classes (C1–C8) + one security rider, delivered in eight phases (§17 has the ordered sequence). The shape:

1. **Safety + provenance first (P0).** Backup evidence, confirm `PROD_DB_READONLY_URL` is populated, run provenance queries against `supabase_migrations.schema_migrations` for the 5 unknown-origin tables, capture schema + `pg_policies` for the 5 re-adopted tables and the orphans into committed audit files, and archive the churn-scorer deployed source via MCP `get_edge_function` into a committed repo file. Nothing irreversible happens in P0.
2. **Merge #724 (P1, owner gate).** Brings C2 + ledger script + `supabase/` purge onto main; unlocks the 10th ledger checksum (computed from the merged blob).
3. **Build the present-tense fixes (P2 auth consolidation, P3 re-adoption migration).** Both are code + branch-proof; both address live-facing risk (broken auth writer; schema divergence) ahead of dormant cleanup.
4. **The founder session F1 (P4).** One appended SQL-editor script (D4) executes all prod DDL + ledger rows + cron disable + orphan handling + verify SELECTs, backup-gated and re-verified at execution.
5. **Repo follow-through (P5).** `scripts/db_preflight.cjs` surgical edit, stale edge-fn dir deletion after fresh ref-grep, Vercel-canonical doc note, `safe-migrate.sh` `AFFECTED_TABLES` extension, waiver-list file, Linear tickets, `SCRIPTS.md`.
6. **Edge hardening (P6, founder gate F2).** Two-step rollout (D5), canary-first (o4).
7. **Close-out (P7).** Proof-checklist artifact + a T+90 burn-in calendar for the deferred drops.

Data decisions (authoritative, D1–D3):

- **C4 auth_events (D1):** consolidate into `audit_events_immutable` via `auditLogger.logAuth`; error-check with `.throwOnError()` / returned-`{error}` check; hash email (sha256), truncate IP to /24, keep `type/method/provider/timestamp/session_id`, drop-or-truncate `user_agent`; inherit `AUDIT_LOG_RETENTION_DAYS=90`; retire the `auth_events` table. Satisfies j3 + a2 + s2 + s3.
- **C5 churn-scorer (D2):** KILL — archive source to repo (o3) → `cron.alter_job(1, active := false)` in F1 → function deletion optional in the same founder session via dashboard (no MCP delete tool); Linear ticket records the kill; capability-matrix gap stays open.
- **C6/C7 orphans (D3):** 5a (17 known-dead) = direct `DROP TABLE IF EXISTS` in F1, gated on P0 backup + execution-time re-verification (j2) + a belt-and-braces `pg_dump --schema-only` capture; DDL is verbatim-recoverable from `supabase/migrations/20250115000001_unified_schema.sql`. 5b (5 unknown-origin) = provenance lookup FIRST, capture schema+policies via `execute_sql`/`pg_dump`, reversible `ALTER TABLE ... RENAME TO zzz_deprecated_<name>` (stays in `public` — avoids `SET SCHEMA`'s silent PostgREST/advisor-visibility change), 90-day zero-access burn-in via logs, then a **separate** founder-gated DROP decision.

## 10. UX

No end-user UX surface — this is an internal data-plane remediation on a 23-user tool. The operator-facing surfaces are:

- **Founder SQL session (F1):** a single, ordered, commented script the founder pastes into the Supabase SQL editor. Sections are clearly delimited (reconcile DDL → ledger rows → `schema_migrations` row → `cron.alter_job` disable → 5a DROPs → 5b RENAMEs → verify SELECTs). The verify SELECTs echo `43` ledger rows, 0 orphaned known-dead tables, and the renamed set, so the founder sees the state without a second tool.
- **Founder edge session (F2):** set per-function `CRON_SECRET_<NAME>` secrets + update the cron command bodies; a short runbook with the exact MCP `deploy_edge_function` calls and the 200/401 smoke commands. F2 is a founder-authorized action executed live in the founder's presence via MCP (classifier-gated) — no autonomous step runs it unattended, and no prod **database** write credential is involved.
- **Reviewer surface:** the §15 proof checklist maps each criterion to its evidence artifact (branch-run test output, `scripts/db_ledger_check.cjs` stdout, filtered-diff output, `get_logs` excerpts, committed capture files). "Done" is legible without re-running anything.
- **Standing visibility:** `migration-drift-visibility.yml` posts drift status on schedule going forward — the operator learns of recurrence without an audit.

## 11. Technical design

**F1 script (D4 — one founder touchpoint), in order:**

1. **Reconcile DDL** — the re-adoption migration body (C3): `CREATE TABLE IF NOT EXISTS` for the 5 tables, each followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements **mirrored from live prod `pg_policies`** (pulled in P0, not guessed — s1/d2). `milestone_events`' non-conventional policy (no `TO` clause, `org = auth.uid()`) is mirrored **as-is** and logged in the decision list. Guarded and idempotent (j6).
2. **Ledger rows (\_prisma_migrations)** — the 9 rows from `docs/db/ledger-reconcile-2026-07-11.sql` + the 10th (re-adoption migration, checksum from the merged #724 blob). `WHERE NOT EXISTS` guard is correct because `_prisma_migrations` has **no unique constraint** on `migration_name` (d4). Idempotent (2nd run inserts 0).
3. **schema_migrations row** — the re-adoption file, if delivered under `supabase/migrations`, also gets its `supabase_migrations.schema_migrations` row (d4: every hand-applied file gets a row in the ledger matching its tree).
4. **`cron.alter_job(1, active := false)`** — NOT `unschedule`; the job row is the only surviving definition (no `cron.schedule` in any migration — o3).
5. **5a DROPs** — `DROP TABLE IF EXISTS` for the 17 known-dead, after the in-session `pg_dump --schema-only` capture.
6. **5b RENAMEs** — `ALTER TABLE ... RENAME TO zzz_deprecated_<name>` for the 5 unknown-origin.
7. **Verify SELECTs** — count `_prisma_migrations` = 43; confirm the 17 are gone and the 5 are renamed; list the 5 re-adopted tables' `rowsecurity = true`.

**F1 script skeleton** (illustrative shape the founder pastes; exact DDL filled from the P0 captures — never guessed):

```sql
BEGIN;
-- [0] belt-and-braces: pg_dump --schema-only already captured off-DB in P0; re-verify counts:
--     expect 17 known-dead present, 5 unknown-origin present, _prisma_migrations = 33 (prod baseline;
--     F1 performs the full 33→43 transition in one session: 9 backlog rows + the 10th post-merge reconcile row).

-- [1] C3 re-adoption (CREATE IF NOT EXISTS + RLS ENABLE + policies MIRRORED from P0 pg_policies pull)
CREATE TABLE IF NOT EXISTS platform_algorithms (/* verbatim from archived DDL :18-123 */);
ALTER TABLE platform_algorithms ENABLE ROW LEVEL SECURITY;
CREATE POLICY /* mirrored from prod pg_policies */ ON platform_algorithms ...;
-- ... ranking_signals, signal_weights, source_provenance, milestone_events (L1: mirror as-is) ...

-- [2] C1 ledger: 9 rows from docs/db/ledger-reconcile-2026-07-11.sql + 10th (merged-#724 blob checksum)
INSERT INTO _prisma_migrations (id, migration_name, checksum, finished_at, applied_steps_count)
SELECT ... WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = ...); -- L3, idempotent

-- [3] supabase_migrations.schema_migrations row if the re-adoption file lives under supabase/migrations (d4)

-- [4] C5 kill: disable the failing nightly cron (NOT unschedule — job row is the only definition)
SELECT cron.alter_job(1, active := false);

-- [5] C6 5a: 17 known-dead DROPs (recoverable from 20250115000001_unified_schema.sql)
DROP TABLE IF EXISTS <known_dead_1>; -- ...x17

-- [6] C7 5b: 5 unknown-origin reversible renames (stay in public — L5)
ALTER TABLE client_churn_risk RENAME TO zzz_deprecated_client_churn_risk; -- ...x5

-- [7] verify SELECTs (echo state to the founder)
SELECT count(*) FROM _prisma_migrations;                 -- expect 43
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN (<5 re-adopted>); -- expect all true
COMMIT;
```

**Ledger policy (write it down, d4):** manual founder apply is the prod mechanism for this program; every hand-applied file gets a ledger row in the tree matching its location (`prisma/migrations` → `_prisma_migrations`; `supabase/migrations` → `supabase_migrations.schema_migrations`). Duplicate-timestamp dirs order deterministically by full-name sort — **defer** renaming, document only (post-insert renames would desync ledger rows).

**C4 consolidation (code, P2):** replace the `lib/auth/monitoring.ts:263-281` anon-client insert with a call to `auditLogger.logAuth` (service-role via `createServerClient`), moving PII minimisation (sha256 email, /24 IP) into the mapping. Because `writeImmutable` already does `if (error) throw error` (`audit-logger.ts:173`), RLS denial now surfaces instead of being swallowed. A new branch-run integration test asserts an RLS-denied write raises (zero existing coverage — q5 root-cause).

**migrate-diff gate (d1):** use Prisma-7 flags (`--from-config-datasource` / `--to-schema` per `.claude/rules/database/supabase-migrations.md:24-25`; repo pins prisma 7.7.0), pipe through the documented DROP-line filter (`:59-65` — raw diff emits `DROP TABLE` for all 63 non-Prisma tables), and compare the remainder against a **versioned, machine-diffable waiver list** (audit §2 benign-variance items + the 7 SQL-only partial/camelCase indexes). The waiver list is the testable gate, not the diff tool.

**db_preflight surgical edit (a3/q3):** `scripts/db_preflight.cjs:13-40` hardcodes 26 expected tables (the 17 known-dead drop candidates are a subset; 9 are live tables that must remain) and carries an EXPECTED list mixing live and dead entries — edit surgically to match the post-remediation reality, ordered to land **with/before** the founder session. This repo edit (owner gate) and the prod DROP (founder gate) are one logical change across two gates.

**Edge hardening (D5, P6):** all six functions currently run **`verify_jwt=false`** (unauthenticated triggers). The load-bearing edge control is an in-handler **constant-time** per-function secret compare — flipping to `verify_jwt=true` is **insufficient** on its own because the public anon key is a valid JWT that passes the platform gate (s4); per-function scoped `CRON_SECRET_<NAME>` mirroring `lib/auth/cron-auth.ts`. Rollout is four moves: (1) deploy handlers in **log-only** mode (accept all, log missing/bad secret); (2) set per-function secrets + update cron command bodies **atomically** so each carries **both** the anon JWT (to pass the platform gate) **and** the per-function secret (a1 — else the nightly callers 401); (3) flip handlers to **enforce**; (4) set `verify_jwt=true` as defense-in-depth **after** the cron commands already carry both tokens. Canary `process-publish-queue` first (highest-frequency, `*/15min`) with correct-secret=200 + wrong-secret=401 smokes + `get_logs` over the next scheduled fire, then batch the remaining 4 (o4).

## 12. Security

- **RLS mirrored, never guessed (s1/d2).** The archived DDL for `platform_algorithms`/`ranking_signals`/`signal_weights`/`source_provenance` (`.claude/archived/2026-04-27/sql-drift/prisma-root/migration-2026-04-02-syn603-algorithm-kb.sql:18-123`) has **zero RLS**. The re-adoption file ENABLEs RLS + policies pulled from live prod `pg_policies`. `milestone_events`' non-conventional client SELECT policy is mirrored as-is and recorded.
- **No anon/authenticated INSERT on the auth path (s2).** The C4 fix is service-role/consolidation **only**; any anon or authenticated INSERT policy is explicitly **rejected** (public-key spam / PII-injection surface). Evidence the DB logging is not currently load-bearing: nothing reads it; brute-force detection is in-memory; Sentry is a stub (s3).
- **PII posture (s3).** Hash email (sha256), truncate IP to /24, keep `type/method/provider/timestamp/session_id`, drop-or-truncate `user_agent`; retention inherits `AUDIT_LOG_RETENTION_DAYS=90`. No new PII-redaction infrastructure.
- **Edge secret is the load-bearing control (s4).** Current posture: all six functions run **`verify_jwt=false`** (no platform JWT gate at all). Constant-time compare of a per-function `CRON_SECRET_<NAME>` is the real control; `verify_jwt=true` alone would **not** gate, because the public anon key is a valid JWT that passes it. F2 sets `verify_jwt=true` as defense-in-depth only **after** the cron commands carry both the anon JWT and the per-function secret. Paired with the cron command update (a1).
- **No prod database write credential in any autonomous step (q1).** The prod-touching scripts (`scripts/check-schema-drift.mjs`, `scripts/db_ledger_check.cjs`, `scripts/db_preflight.cjs`, `safe-migrate.sh`) have **no port guard** — so they are used **read-only** here; all prod **DB** mutation lands inside founder gate F1, and F2's edge deploys/cron updates are founder-authorized live MCP actions (classifier-gated, never unattended). The jest integration lane's `sandbox-guard.ts:25-53` hard-fails unless `DATABASE_URL` contains `:5499/` and `REDIS_URL` `:6399`, and `global-setup.ts:36-40` pins `DIRECT_URL` — prod is structurally unreachable from the test lane.
- **Ledger post-insert verification (s5-residual).** The build **extends** `scripts/db_ledger_check.cjs` — today it does **no** checksum computation and its query is `ORDER BY migration_name DESC LIMIT 20` off `rowCount`, so it **cannot count 43** (this extension is an authorized in-scope code change, exempt from the §6 reuse-don't-rebuild framing). Extended to (a) `SELECT count(*)` with no LIMIT, (b) recompute sha256 of each `migration.sql`'s bytes (`git show HEAD:prisma/migrations/<name>/migration.sql | sha256sum`, or Node `crypto`+`readFileSync`) and compare to each ledger row's checksum, (c) exit **non-zero** with a diff on any mismatch, and print a positive line (`[ledger-check] ✓ 43/43 checksums match`). It confirms count 33→43, names, and checksums vs file bytes programmatically (not by eye).

**Logged decisions register** (recorded in the F1 decision list + the P0 capture files, so nothing non-obvious is silent):

| ID  | Decision                                                                                                            | Rationale / seat                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| L1  | `milestone_events` mirrored with its non-conventional SELECT policy (no `TO`, `org=auth.uid()`) as-is               | Mirror prod, don't "fix" (s1)                                       |
| L2  | Checksum method = sha256 of raw file bytes (`git show \| sha256sum`), not `hash-object` framing                     | Proven equal to Prisma's own (§7)                                   |
| L3  | Ledger guard `WHERE NOT EXISTS` on `migration_name` (no unique constraint exists)                                   | d4                                                                  |
| L4  | Duplicate-timestamp migration dirs ordered by full-name sort; renames **deferred**                                  | Post-insert rename desyncs ledger (d4)                              |
| L5  | C7 tables stay in `public` under `zzz_deprecated_` (no `SET SCHEMA`)                                                | `SET SCHEMA` silently changes PostgREST/advisor visibility (d-seat) |
| L6  | `safe-migrate.sh` coverage: state extension OR explicit non-coverage (currently 6 unrelated tables)                 | j5                                                                  |
| L7  | churn function deletion is optional in F1 via dashboard (no MCP delete tool); cron disable is the load-bearing kill | o3 / D2                                                             |

## 13. Verification plan

Four environments, matched to claim class (proof-discipline; T3 sandbox-policy):

- **(i) Unit** — `jest.worktree.cjs`, no DB. Mapping/PII-minimisation for C4 (email hashed, IP truncated), waiver-list parsing, script-shape assertions.
- **(ii) Integration** — `docker-compose.test.yml` sandbox, ports `:5499`/`:6399`, tmpfs; guard = `sandbox-guard.ts` hard-fail on non-sandbox URLs; teardown `sandbox:down -v`. **MANDATE** a fresh `sandbox:down -v && sandbox:up` before the lane (q4). The C4 monitoring-path insert-under-RLS test and the reconcile-migration idempotence run here where a Prisma DB exists.
- **(iii) Branch** — Supabase MCP `create_branch` (applies the full migration tree to a fresh DB; `confirm_cost` — cheap; `delete_branch` teardown). **Classes 6 and 7 are unprovable in the `prisma db push` sandbox** (it lacks raw-SQL RLS policies and the non-Prisma tables — q2), so RLS-mirror verification, `migrate diff` runs, idempotence loop-tests, and `rls:adversarial` (promoted to branch-run for this program) all execute here. `scripts/validate-rls-coverage.js` is **structurally blind** to non-Prisma tables (`:27-39,82-89` build the uncovered list from `schema.prisma` models only — d3), so manual `pg_policies` verification on the branch is the only real check for the 5 re-adopted tables.
- **(iv) Prod** — READ-ONLY via MCP `execute_sql` for re-verification (fresh row-counts, fresh policy pulls, `get_advisors`, `get_logs`). All prod **writes** are founder-gated L3 human criteria.

**Final gate (q4):** fresh `sandbox:down -v && sandbox:up` → `test:integration`; require `check-schema-drift`'s **POSITIVE** stdout line `"[drift-check] ✓ no schema drift"` — exit 0 alone can mean skipped (fail-safe paths at `:145-151,:186-193,:256-264`).

**Claim-class labels (q5):** every claim is tagged `{proven}` (sandbox/branch, this session), `{proven-on-branch}` (Supabase branch DB), or `{proven-after-founder-gate}` (needs F1/F2). The **43-row ledger claim is `{proven-after-founder-gate}` and is never asserted pre-apply** — the 10th checksum is computed from the merged #724 blob (ledger STEP 4).

## 14. Loop & stress testing

Branch/sandbox lane:

1. **Reconcile migration applied twice** on a branch — 2nd run is a no-op (`CREATE IF NOT EXISTS` + guarded).
2. **Ledger INSERT twice** — 2nd run inserts 0 rows (`WHERE NOT EXISTS` guard; no unique constraint on `migration_name`).
3. **Re-adoption file applied twice** — RLS enable + policy create are idempotent.
4. **monitoring-path insert under RLS** on a branch — RLS-denied write now **raises** (was silently swallowed); a mocked-success path persists a minimised row.
5. **Wrong-secret 401 canary** — `process-publish-queue` with a bad `CRON_SECRET` returns 401; correct returns 200; `get_logs` over the next `*/15min` fire confirms no legitimate 401.
6. **Idempotent re-run of the whole F1 script** on a branch — second execution changes nothing (all guards hold), proving the founder can safely re-run on error.
7. **Fresh-sandbox drift** — after `sandbox:down -v && sandbox:up`, `check-schema-drift` prints the positive line, not a skip.

## 15. Acceptance criteria — the 100/100 contract

Each criterion is traceable to an originating seat must_fix or a phase, and carries its proof class. "100%" = **all 30 criteria satisfied at their designated gate** (D6).

**C1 — Ledger parity**

1. The re-adoption migration is `CREATE IF NOT EXISTS` + guarded + ledger-baselined; a fresh founder apply cannot break. `{proven-on-branch}` [judge j6]
2. The **extended** `scripts/db_ledger_check.cjs` (built to `count(*)` with no LIMIT + recompute sha256 of each `migration.sql`'s bytes vs the ledger row's checksum + exit non-zero with a diff on mismatch) prints its **positive** stdout line `[ledger-check] ✓ 43/43 checksums match` post-apply (10th checksum from the merged #724 blob) — that positive line is **required**; exit-0 alone is insufficient. `{proven-after-founder-gate}` [security s5-residual / qa q5]
3. Every hand-applied file gets a ledger row in the tree matching its location (`prisma/migrations` → `_prisma_migrations`; `supabase/migrations` → `supabase_migrations.schema_migrations`); the ledger policy is written into the spec/runbook. `{proven}` (policy) / `{proven-after-founder-gate}` (rows) [data d4]
4. The `WHERE NOT EXISTS` ledger guard is correct (no unique constraint on `migration_name`) and idempotent — 2nd run inserts 0 (loop-tested). `{proven-on-branch}` [data d4]

**C2 — Schema column parity**

5. The migrate-diff gate uses Prisma-7 flags + the DROP-line filter and compares the remainder against a versioned waiver list; the remainder is empty. `{proven-on-branch}` [data d1]
6. "100%" is expressed as bounded per-class proof + founder evidence artifacts + a standing `migration-drift-visibility.yml`, not an unqualified claim. `{proven}` [judge j4]

**C3 — Prod-only table re-adoption**

7. The re-adoption migration ENABLEs RLS + policies **mirrored from live prod `pg_policies`** (pulled, not guessed) for all 5 tables; `milestone_events`' non-conventional policy is mirrored as-is and logged in the decision list. `{proven-on-branch}` [security s1 / data d2]
8. Because `scripts/validate-rls-coverage.js` is blind to non-Prisma tables, the 5 tables' RLS is verified by **manual `pg_policies` inspection on a Supabase branch DB**; classes 6/7 proofs run there, not in the `prisma db push` sandbox. `{proven-on-branch}` [data d3 / qa q2]

**C4 — auth_events consolidation**

9. auth-event logging is consolidated into `audit_events_immutable` via `auditLogger.logAuth` (service-role, error-checked with `.throwOnError()`/returned-error check); the `auth_events` table is retired (joins the deprecation path). `{proven}` [architect a2 / judge j3 / D1]
10. The `lib/auth/monitoring.ts` insert path checks the returned `{error}`; a **new branch-run integration test** proves an RLS-denied insert now raises instead of being silently swallowed (zero prior coverage). `{proven-on-branch}` [qa q5 root-cause]
11. PII posture applied: email hashed (sha256), IP truncated to /24, `type/method/provider/timestamp/session_id` kept, `user_agent` dropped/truncated; 90-day retention inherited. `{proven}` [security s3]
12. The C4 fix admits **no** anon/authenticated INSERT policy — service-role/consolidation only. `{proven}` [security s2]

**C5 — churn-scorer kill**

13. churn-scorer is KILLED: source archived to repo, `cron.alter_job(1, active := false)` in F1, a Linear ticket records the kill decision, the capability-matrix gap stays open, and the rebuild is foreclosed with evidence — no silent delete. `{proven}` (repo/ticket) / `{proven-after-founder-gate}` (cron) [pm p1 / D2]
14. The deployed churn-scorer source is archived via MCP `get_edge_function` into a committed `supabase/functions/_archived/churn-scorer/index.ts` **before** anything is touched. `{proven}` [ops o3]

**C6 — 17 known-dead orphans**

15. The 17 known-dead tables are dropped via `DROP TABLE IF EXISTS` in F1, gated on P0 backup + execution-time re-verification + a belt-and-braces `pg_dump --schema-only` capture; DDL is confirmed verbatim-recoverable from `supabase/migrations/20250115000001_unified_schema.sql`. `{proven-after-founder-gate}` [judge j1 / ops o2 / D3-5a]

**C7 — 5 unknown-origin orphans**

16. The 5 unknown-origin tables are **never dropped** before (a) provenance lookup in `supabase_migrations.schema_migrations`, (b) schema+policy capture to a committed audit file, (c) reversible `RENAME TO zzz_deprecated_<name>` (staying in `public`), and (d) a 90-day zero-access burn-in; the actual DROP is a **separate** founder-gated decision. `{proven-after-founder-gate}` [judge j1 / pm p2 / D3-5b]
17. Before **any** irreversible step, every point-in-time claim is re-verified at execution: fresh row-counts, fresh ref-greps (incl. un-merged branches + Vercel cron handlers), and confirmation that no other caller of churn-scorer exists. `{proven-after-founder-gate}` [judge j2]

**C8 — Repo hygiene + standing gates**

18. Phase-0 backup gate satisfied: founder-confirmed PITR **or** `npm run db:backup` (real pg_dump, `scripts/db/migrate.js:306-338`) with the artifact retained off-DB; `PROD_DB_READONLY_URL` confirmed populated so `migration-drift-visibility.yml` actually runs. `{proven-after-founder-gate}` [ops o1]
19. `migration-drift-visibility.yml` is left behind as a standing gate; drift is visible on schedule going forward. `{proven}` [judge j4]
20. The legacy `supabase/` purge (PR #724) lands; the repo has a single canonical migration source; a Vercel-canonical doc note + `SCRIPTS.md` entry are added. `{proven}` [C8]
21. `scripts/db_preflight.cjs:13-40` (26 hardcoded expected tables — the 17 known-dead drop candidates are a subset; 9 are live tables that must remain) and its EXPECTED list are updated **surgically** in the same change, ordered to land with/before the founder session (one logical change across two gates). `{proven}` [qa q3 / architect a3]
22. No autonomous step holds a prod WRITE credential; the final gate mandates a fresh `sandbox:down -v && sandbox:up` before `test:integration` and requires `check-schema-drift`'s POSITIVE stdout line (exit 0 alone insufficient — fail-safe paths). `{proven}` [qa q1/q4]
23. Prod applies are routed through existing safety machinery: `safe-migrate.sh` `AFFECTED_TABLES` is extended to cover the touched tables **or** explicit non-coverage is stated with rationale (it currently covers 6 tables, none touched here). `{proven}` [judge j5]

**Cross-cutting**

24. The single founder session F1 executes reconcile DDL + ledger rows + `schema_migrations` row + `cron.alter_job` disable + 5a DROPs + 5b RENAMEs + verify SELECTs, in that order, backup-gated and re-verified at execution. `{proven-after-founder-gate}` [D4 / judge j2]
25. Edge hardening ships: current posture is `verify_jwt=false` on all six functions; the load-bearing control is an in-handler **constant-time** per-function `CRON_SECRET_<NAME>` compare (`verify_jwt=true` alone is insufficient — the public anon key is a valid JWT that passes it); rollout is log-only → set secrets + update cron atomically (each command carries **both** the anon JWT and the per-function secret) → enforce → set `verify_jwt=true` as defense-in-depth last; canary `process-publish-queue` first with 200/401 smokes + `get_logs`, then batch the remaining 4. F2's edge-function deploys and cron-command updates are founder-**authorized** actions executed live in the founder's presence via MCP `deploy_edge_function` (classifier-gated), never run unattended. `{proven-after-founder-gate}` (F2) [security s4 / ops o4 / D5]
26. Nightly pg_cron callers are **not** 401'd: cron command bodies are updated **atomically** with the handler deploy (paired, not sequenced apart). `{proven-after-founder-gate}` [architect a1]
27. All 8 audit classes are closed, each with proof at its designated class; the OUT-OF-SCOPE list (§5) is honoured (no churn rebuild, no repo-wide RLS program, no benign-variance normalisation, no timestamp renames). `{mixed per class}` [D6]
28. Loop tests green (§14): reconcile migration twice (2nd no-op), ledger INSERT twice (2nd 0 rows), re-adoption twice, monitoring RLS insert on branch, wrong-secret 401 canary, whole-F1 re-run no-op. `{proven-on-branch}` [D7 / §14]
29. No "100%"/"43 rows"/"completely cut off" is claimed pre-apply; claims are correctly classed; the 43-row ledger is unreachable until #724 merges (10th checksum from the merged blob). `{proven}` (discipline) [judge j2 / qa q5]
30. Reversible-first throughout: no irreversible DROP without backup + re-verification; C7 uses rename-not-drop; burn-in precedes any unknown-origin drop; archive precedes cron disable. `{proven-after-founder-gate}` [ops o1/o2 / judge j1]

## 16. /goal command

```
/goal Implement docs/specs/spm-parity-remediation-2026-07-11.md to 100/100: P0 safety+provenance (backup + read-only-secret confirm + provenance queries + policy/schema captures + churn source archive) → P1 merge #724 (owner) → P2 auth-event consolidation → P3 re-adoption migration (RLS mirrored) → P4 founder session F1 (reconcile DDL + ledger 43 + cron disable + 5a DROP + 5b RENAME) → P5 repo follow-through (preflight edit, stale-fn delete, waiver list, safe-migrate, tickets, SCRIPTS.md) → P6 edge hardening (F2) → P7 close-out + T+90 burn-in; done when all §15 criteria (1–30) hold with per-class proof classes {proven | proven-on-branch | proven-after-founder-gate}; prod writes only via founder gates F1 (single SQL session) and F2 (edge secrets + cron); verification per §13 environments (sandbox :5499 / Supabase branch / prod-read-only).
```

## 17. Implementation sequence

Time-box: **4–6 net-new builder-days** (PM). Present-tense risks (auth-events, DDL re-adoption) ordered before dormant cleanup.

- **P0 — Safety + provenance (build now, read-only prod).** Backup evidence (o1: PITR confirm **or** `db:backup` artifact off-DB); confirm `PROD_DB_READONLY_URL` is populated (founder question — not repo-verifiable); provenance queries on `supabase_migrations.schema_migrations` for the 5 unknown-origin tables; capture the 5 re-adopted tables' schema + `pg_policies` and the orphans' schema into committed audit files; archive churn-scorer source via MCP `get_edge_function` → committed `supabase/functions/_archived/churn-scorer/index.ts`. [criteria 14, 16(a-b), 17, 18]
- **P1 — Merge #724 (owner gate).** Brings C2 + ledger script + `supabase/` purge onto main; unlocks the 10th checksum. [criteria 5, 20]
- **P2 — auth consolidation (build + branch-proof).** Rewire `monitoring.ts` → `auditLogger.logAuth`; PII minimisation; error-check; new branch-run RLS-denied test; retire `auth_events`. [criteria 9, 10, 11, 12]
- **P3 — re-adoption migration (build + branch-proof).** `CREATE IF NOT EXISTS` + RLS ENABLE + policies mirrored from prod; branch DB proof + `migrate diff` vs waiver list. [criteria 1, 7, 8]
- **P4 — Founder session F1 (D4 script) + post-verification.** Reconcile DDL + ledger 43 + `schema_migrations` row + `cron.alter_job` disable + 5a DROPs + 5b RENAMEs + verify SELECTs; then `db_ledger_check` 43/43, `get_advisors`, filtered-diff vs waiver list. [criteria 2, 3, 4, 13(cron), 15, 24]
- **P5 — Repo follow-through.** `scripts/db_preflight.cjs` surgical edit; delete the ~20 stale fn dirs after a fresh ref-grep; Vercel-canonical doc note; `safe-migrate.sh` `AFFECTED_TABLES` extension (or non-coverage statement); waiver-list file; Linear tickets (churn kill, capability-matrix gap, C7 burn-in calendar); `SCRIPTS.md`. [criteria 13(ticket), 19, 21, 22, 23]
- **P6 — Edge hardening (founder gate F2).** Two-step rollout, canary `process-publish-queue` first, then batch 4. [criteria 25, 26]
- **P7 — Close-out.** Proof-checklist artifact mapping every §15 criterion to evidence; T+90 burn-in calendar decisions (5b drops + churn function delete + `auth_events` table drop). [criteria 27, 28, 29, 30]

**Deferred / documented (not blocking):** migration-dir timestamp renames (document, don't rename); the T+90 irreversible drops (calendar item, separate founder gate).

## 18. Session-handoff seed

- **Gate state:** main `d98289e1`; PR #724 (`chore/supabase-parity-20260711`) CI green, **unmerged** (carries the audit doc, reconcile migration, ledger script, `supabase/` purge — none on main yet); local gate 590 suites / 6335 tests green.
- **Two founder gates:** F1 = one appended SQL-editor session (reconcile DDL + ledger 43 + cron disable + 5a DROP + 5b RENAME + verify SELECTs); F2 = edge secrets + cron command updates. Both are L3 human criteria; no autonomous step holds a prod write credential.
- **First command next session:** `git fetch` → `gh pr view 724` → read this spec §17 **P0** (safety + provenance) and execute it read-only before touching #724.
- **Memory:** `synthex-prod-migration-gate`, `synthex-parity` (this program). Live evidence anchors: churn-scorer 500-to-cron-caller (upstream route-layer 404 `/api/internal/churn-scorer`) @ 2026-07-11 02:00:03 UTC; `cron.job` jobid 1 active; prod `_prisma_migrations` 33 rows → target 43.

## 19. Final recommendation

**APPROVE BUILD — conditional.** §15 (criteria 1–30) is the 100/100 contract. The judge's draft score **61/100 REDUCE SCOPE** was scored against the pre-synthesis shape (unbounded "drop everything, hit 100%"); all six judge must_fix (j1–j6) are folded into named criteria, as are every architect, QA, security, ops, PM, and data must_fix. The board was **unanimously critical** (7/7 needs-work) with no security hard-floor triggered; the ramp rule folded all findings with no round 2.

**Honest ceiling note:** criteria behind founder gates can only reach `{proven-after-founder-gate}` in this session — the 43-row ledger, the F1 DDL, the cron disable, and the edge enforce-flip are not claimable as done until F1/F2 execute. What this spec deliberately does **not** promise: a rebuilt churn scorer, a repo-wide RLS program, or immediate deletion of the 5 unknown-origin tables (rename + 90-day burn-in first). The remaining work is reversible-first, evidence-anchored, reuses existing machinery (§6), and is branch-provable end-to-end without touching prod outside the two founder gates.

**Post-verify:** the T3 adversarial verify pass (§8b) is **complete** — 7 findings (3 blocking, 4 minor) folded into this revision; the **APPROVE BUILD — conditional** recommendation stands post-verify.
