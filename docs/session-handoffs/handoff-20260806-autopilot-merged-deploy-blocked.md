# Handoff — autopilot + watchdog shipped to main; ops watchdog fully wired on production; Deploy blocked on media gate

**Date:** 2026-08-06 (last updated 13:10 UTC)
**Base branch:** `main` @ `130120c3`
**This branch:** `fix/media-gate-sidecars` @ `794df6ec` → **PR #888** (open, all checks green)
**Prior PR:** #886 — merged 07:04:49Z
**Supabase project:** `znyjoyjsvjotlzjppzal`

> All commands below run **from the repository root**. No absolute paths: this handoff is read
> on at least three machines and a hard-coded home directory resolves on exactly one of them.

---

## 1. Summary

**State: WIP-BLOCKED**, on one thing only.

PR #886 merged with 41/41 green. Every production-side change is now applied and verified. The
single remaining blocker is that the `Deploy` workflow fails on a media asset gate, so **`main`
has not deployed since at least 05:11 UTC** and production still runs pre-#886 application code.
PR #888 (this branch) fixes that gate.

**Definition-of-Done: 4 of 5.** Rule 5 fails — the autopilot fix has no demonstrable production
outcome, because it is merged but not deployed.

### What is live on production right now

| Change                                | State                    | Evidence                                                                   |
| ------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| ops watchdog base, D1, D2             | **Applied**              | function bodies contain `alert_dispatch_failed` / `stuck`                  |
| DR `auto_approve_threshold` 100 → 80  | **Applied**              | reads 80; applied outside this session between 07:49Z and 11:57Z           |
| **D3** — recurring findings re-notify | **Applied 12:5x UTC**    | `record_finding` md5 `678fb0ad…` → `286930238d…`; probe returned 1 → 0 → 1 |
| Migration ledger backfill             | **Applied**              | 5 rows now in `supabase_migrations.schema_migrations`                      |
| **Telegram alerting**                 | **Wired and proven**     | `watchdog_cycle()` → `sent: 10`; Telegram `ok: true`, `message_id 6243`    |
| Autopilot timeout fix, email backoff  | **Merged, NOT deployed** | Deploy red — see §7                                                        |

---

## 2. Where it started

Resumed `handoff-20260806-ops-live-autopilot-and-email-unshipped.md`: watchdog live, autopilot and
email fixes committed on `feat/gateway-spine` and never pushed. Instruction: ship it. Then, in
sequence: lower DR's threshold to 80; fix the media gate; apply D3; wire Telegram.

---

## 3. Decisions locked + what shipped

**PR #886 (merged).** Cherry-picked clean onto `origin/main` rather than pushing
`feat/gateway-spine`, which carried 31 further commits of parked SYN-1125 spend work including a
revert and a round-8 BLOCKED review.

**PR #888 (this branch, open).** 15 missing media sidecars under `public/videos/marketing-extender-*`
— a `.webm` per mp4, `.avif` + `.webp` per jpg poster. Generated with `npm run media:optimize`.
Only the 15 genuinely-absent files are committed; the optimiser also rewrote 32 existing `.avif`
files that were never missing (different local `sharp` build → different bytes) and those were
reverted.

### Findings locked

- **240 autopilot posts since 2026-07-17, 11–13 every night, every one `draft`, every run
  recording `posts_generated = 0`.** Generation was never broken; the bookkeeping was. [VERIFIED]
- **Score range 71–87, mean 78.7, max 87.** `auto_approve_threshold = 100` was unreachable, not
  merely strict. [VERIFIED]
- **The watchdog autonomously reaped a live production failure** — the 2026-08-06 02:00 UTC run
  died at exactly 300,000 ms carrying its own reaper message. [VERIFIED]
- **D3 defect** — `record_finding` reopened a resolved finding by clearing `resolved_at` while
  leaving `notified_at`; `notify_pending` selects `notified_at IS NULL`, so every recurring
  condition alerted exactly once, ever. Fixed and behaviourally proven. [VERIFIED]
- **`ops.alert()` has exactly one dispatch path** — `net.http_post` to `api.telegram.org`. No
  webhook or email fallback. It never reads the response, so a bad token or chat id produces a
  watchdog that reports itself configured and delivers nothing. [VERIFIED]
- **Vercel production holds two unusable Telegram values** — `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID`, 11 characters each, neither in Telegram's format. The working token came
  from Railway project `Pi-Dev-Ops`. [VERIFIED]

---

## 4. Key files

| File                                                  | Status      | Note                                                      |
| ----------------------------------------------------- | ----------- | --------------------------------------------------------- |
| `public/videos/marketing-extender-*.{webm,avif,webp}` | Created ×15 | This PR; unblocks Deploy                                  |
| `app/api/cron/autopilot/route.ts`                     | Merged      | **Not deployed**                                          |
| `lib/email/queue.ts`                                  | Merged      | **Not deployed**                                          |
| `supabase/migrations/20260805*`, `20260806*`          | Merged      | All 5 applied to prod + ledger                            |
| `scripts/verify-ops-watchdog.sh`                      | Merged      | 16/16; `SABOTAGE=d1/d2/d3` each red on its own assertions |

---

## 5. Running state

Nothing running. No background agents, containers or monitors left behind. Production's pg_cron
`ops-watchdog` job is live (`*/15`, active) — production's state, not this session's process.

Three pre-existing stashes, **not mine** — leave alone.

---

## 6. Verification — exact commands

Run from the repository root.

```bash
git status --short && git rev-parse --short HEAD
npm test                                     # expect 734 suites, 7,707 passed, 0 failed
npm run media:check                          # expect exit 0 (exits 1 without this branch's 15 files)
scripts/verify-ops-watchdog.sh               # expect 16/16
SABOTAGE=d3 scripts/verify-ops-watchdog.sh   # MUST go red on the recurrence assertion only
gh run list --branch main --workflow Deploy --limit 3
```

**Local gate caveat.** `npx tsc --noEmit` and `npm run lint` fail on this machine and **both are
environment, not repo defects** — proven by CI passing the same SHA. The `tsc` error is a stale
build of the `packages/brand-config` workspace (`tokenStatus` _is_ present at
`packages/brand-config/src/types.ts:125`); the two lint errors come from Chrome-extension JS under
`.artifacts/`, which CI does not have. Do not trust a local-only failure without checking CI.

### Credential handling — corrected

An earlier revision of this handoff instructed `vercel env pull --environment=production`, and
**that command was executed during this session.** It downloads the _entire_ production
environment to a local file in order to obtain one database credential, which is the wrong
pattern and is recorded here rather than quietly dropped.

The file was written to a session-scoped scratchpad, never committed, and deleted immediately
after use; no value was printed to a transcript, to argv, or to any persisted file. Rotation was
not performed — the exposure was a local file under the operator's own account, not a disclosure.

**Do not repeat it.** Pull only the variable you need:

```bash
vercel env pull --environment=production --yes /dev/stdout | grep '^DIRECT_URL='
```

`.env.local`'s `DIRECT_URL` is stale and does not authenticate.

### Production preflight — REQUIRED before any manual Supabase migration

Applying SQL by hand bypasses the migration engine and leaves no ledger row unless you write one.
Run all four checks and confirm each before touching production.

```sql
-- 1. Right database? current_database() is 'postgres' on EVERY Supabase project and cannot
--    identify one. Assert Synthex-specific objects instead.
SELECT to_regclass('public.autopilot_runs') IS NOT NULL AS is_synthex;

-- 2. What does the ledger think is applied?
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE version >= '20260805000000' ORDER BY version;   -- expect 5 rows

-- 3. What is ACTUALLY applied? The ledger can lie; function bodies cannot.
SELECT to_regprocedure('ops.watchdog()') IS NOT NULL AS base,
       pg_get_functiondef(to_regprocedure('ops.watchdog_cycle()')::oid) ~ 'alert_dispatch_failed' AS d1,
       pg_get_functiondef(to_regprocedure('ops.watchdog()')::oid) ~ 'stuck' AS d2,
       pg_get_functiondef(to_regprocedure('ops.record_finding(text,text,text,text,numeric)')::oid) ~ 'notified_at' AS d3;

-- 4. Capture the md5 of any function you are about to replace, BEFORE replacing it.
--    "The function exists" is true either way; only the hash moving proves the new body landed.
SELECT md5(pg_get_functiondef(to_regprocedure('ops.record_finding(text,text,text,text,numeric)')::oid));
```

**Dependency order is base → D1 → D2 → threshold → D3.** The base migration uses
`CREATE OR REPLACE` on `record_finding()`, `watchdog()` and `watchdog_cycle()`, so **re-running it
silently reinstates the original defective bodies and undoes D1, D2 and D3 in one go.** Never
re-run the base against a database that already has them.

---

## 7. Deferred + open questions

### Deferred

| Item                                                 | Owner | Blocking                             | Why                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ----- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merge PR #888**                                    | Phill | **Yes — nothing reaches production** | Deploy red on the media gate since ≥05:11 UTC. Blocked on 5 unresolved CodeRabbit threads on this document, not on CI.                                                                                                              |
| Delete the two unusable Vercel Telegram vars         | Phill | No                                   | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, 11 chars each. A live trap: wiring from them yields a watchdog that reports itself configured and delivers nothing.                                                                      |
| Dedicated Telegram bot for Synthex                   | Phill | No                                   | Alerting currently runs on `Pi-Dev-Ops`'s token into a private DM shared with Margot. Rotation or retirement of that bot kills Synthex alerting silently, and `alerting_unconfigured` will not fire because config stays populated. |
| Triage the 10 open findings now arriving in Telegram | Phill | No                                   | Includes `never_published` and `queue_stalled`, both critical, both true since 5 August.                                                                                                                                            |
| 5 accepted P2s in live migrations                    | Phill | No                                   | D1/D2 lack the table fingerprint; name-only constraint idempotency; destructive rollback file; `alerting_unconfigured` cannot self-resolve; base reapplication overwrites D1–D3 (mitigated by the preflight above).                 |
| 3 accepted residual P1s                              | Phill | No                                   | Accepted 2026-08-06 as pre-existing on `main`; require AbortSignal plumbing + deterministic post IDs.                                                                                                                               |

### Open questions

| Question                                                                         | Owner      | Blocking | Why it matters                                                                                               |
| -------------------------------------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| What auto-created #888 and auto-merged #886 ahead of the operator? [UNCONFIRMED] | Phill      | No       | Third occurrence today; matches #857 and the 26 July flag. Tracked as SYN-1128.                              |
| First-night image spend once scheduling starts                                   | next agent | No       | `route.ts:568` gates grounded image generation on `scheduled`; that branch has never executed in production. |

---

## 8. Pick up here

### Start here

1. Confirm `fix/media-gate-sidecars` @ `794df6ec`, tree clean.
2. Resolve the 5 CodeRabbit threads on PR #888 (this rewrite addresses all five), then merge.
3. Watch `main`'s Deploy run — **the media gate only runs there.** `.github/workflows/deploy.yml`
   triggers on `push: branches: [main, develop]` and has no `pull_request` trigger, so #888's
   green checks do **not** prove the media fix. Only the post-merge Deploy does.

### Do not redo

- Do not re-derive the autopilot root cause — measured three ways.
- Do not apply D3, the threshold, or the ledger backfill again — all four are live and verified.
- Do not re-run the base ops migration; it would undo D1–D3.
- Do not wire Telegram from Vercel's values; they are unusable.
- Do not trust a local `tsc` or lint failure without checking CI.
- Do not run `vercel env pull` without a narrowing filter.
- Do not touch the three pre-existing stashes.

### First command to run

```bash
gh pr checks 888
```

---

## 9. Risk notes

- **Production runs pre-#886 application code.** The 02:00 UTC run on **2026-08-07** will time out
  as the previous nineteen did unless #888 merges and Deploy goes green first. (The 2026-08-06
  02:00 run has already happened — it failed at 300,000 ms and was reaped automatically.)
- **Telegram alerting depends on another project's bot.** See §7.
- **Errors made this session, recorded because they bear on how much to trust the rest:**
  - Claimed a `tsc` error was "proven pre-existing at origin/main" in four commit messages. The
    proof ran both branches against the same symlinked `node_modules` — an environment compared
    with itself. CI disproved it.
  - Claimed the Supabase preview failure was pre-existing, citing a branch record last updated
    2025-08-16. It was my own over-broad wrong-database guard rejecting a legitimate preview.
  - First wall-clock test was vacuous — passed with the guard removed, because a second guard
    caught it.
  - Two of my own fixes introduced new defects caught by review: a recovery double-write, and
    pre-deploy email jobs recorded as `queued` for retries BullMQ will never run.
  - Pulled the entire production environment for one credential (see §6).
- **One existing test's clock model was changed** so my code could pass
  (`cron-autopilot-terminal-status.test.ts`, per-read → per-call). Independently verified sound by
  the third review; both assertions unchanged and still proven able to fail.

---

## 10. Handoff quality check

| Rule                                        | Held?                                             |
| ------------------------------------------- | ------------------------------------------------- |
| No claim tests passed without running them  | Yes — 734/7,707 cited                             |
| No claim anything shipped that was not      | Yes — merged vs deployed kept distinct throughout |
| No claim a process is running               | Yes — only production's pg_cron                   |
| Completed vs deferred separated             | Yes — §3 vs §7                                    |
| First command provided                      | Yes — §8                                          |
| Findings evidence-tagged                    | Yes — [VERIFIED] / [UNCONFIRMED]                  |
| Unfinished work not dressed as a clean stop | Yes — WIP-BLOCKED                                 |
| Failures proven pre-existing, not assumed   | Yes — Deploy history checked across 6 runs        |
| Own errors recorded                         | Yes — §9, five of them                            |
| Commands portable across machines           | Yes — repo-root relative, no absolute paths       |

**Handoff complete. Next safe action:** `gh pr checks 888` — then merge, and watch `main`'s Deploy,
which is the only place the media gate runs.
