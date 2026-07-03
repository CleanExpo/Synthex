# Synthex Connections Audit & Reconcile — 2026-06-25

> Live walk-through of every business's social/marketing connectors in the
> `platform_connections` table (Supabase prod `znyjoyjsvjotlzjppzal`), joined to
> `organizations`. Evidence-tagged per `.claude/rules/fabel-evidence-standard.md`.
> No token _values_ were ever read — only reference signals (presence of a refresh
> token, expiry, last-sync), exactly as `app/api/command-centre/connection-spine`
> does.

## Method `[VERIFIED]`

- Queried `platform_connections` ⨝ `organizations` for all rows.
- Liveness test per connector = **(a)** `last_sync` recency, **(b)** `expires_at`
  vs now, **(c)** `refresh_token` present (NULL-check only). A connector is LIVE
  when it either has a non-expired token _or_ a working refresh token that
  produced a fresh `expires_at` at the last sync. It is STALE when `expires_at`
  is stuck _before_ the most recent `last_sync` despite a refresh token existing
  — that means the refresh **failed** (grant revoked/expired) and only a human
  re-OAuth can fix it. Neither code nor a CLI can refresh a dead grant.

## Priority businesses (owner: "CARSI, RestoreAssist, DR are the 3 I need tested and live")

### CARSI — fully live on every connected channel ✅

| Connector               | Status                 | Evidence                                                               |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Google Analytics        | ✅ LIVE                | refresh ok, token to 2026-06-25 23:30 UTC, synced 2026-06-25 22:00 UTC |
| Google Business Profile | ✅ LIVE                | refresh ok, synced 2026-06-25 22:00 UTC                                |
| Google Drive            | ✅ LIVE                | refresh ok, synced 2026-06-25 22:00 UTC                                |
| Search Console          | ✅ LIVE                | refresh ok, synced 2026-06-25 22:00 UTC                                |
| LinkedIn                | ✅ LIVE                | no refresh token; **hard-expires 23/08/2026** → reconnect before then  |
| YouTube                 | ✅ LIVE                | refresh ok, refreshed to 2026-06-25 22:43 UTC                          |
| Facebook                | ✗ inactive placeholder | never OAuth-connected; reconnect only if wanted                        |
| Instagram (`carsi_aus`) | ✗ inactive             | real account, deactivated; reconnect to re-enable                      |

### RestoreAssist — live except YouTube ⚠️

| Connector                                            | Status                  | Evidence                                                                                           |
| ---------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Google Analytics / Business / Drive / Search Console | ✅ LIVE                 | all refresh ok, synced 2026-06-25 22:00 UTC                                                        |
| LinkedIn                                             | ✅ LIVE                 | hard-expires **20/08/2026** → reconnect before then                                                |
| **YouTube**                                          | ⚠️ **RECONNECT**        | token stuck expired (2026-06-25 19:01 UTC) despite the 2026-06-25 22:00 UTC sync — refresh failing |
| Facebook / Instagram                                 | ✗ inactive placeholders | reconnect only if wanted                                                                           |
| Reddit                                               | ✗ inactive + expired    | reconnect only if wanted                                                                           |

### Disaster Recovery — live except YouTube + Reddit ⚠️

| Connector                                            | Status                   | Evidence                                                                                           |
| ---------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| Google Analytics / Business / Drive / Search Console | ✅ LIVE                  | all refresh ok, synced 2026-06-25 22:00 UTC                                                        |
| LinkedIn                                             | ✅ LIVE                  | hard-expires **11/08/2026** → reconnect before then                                                |
| **YouTube**                                          | ⚠️ **RECONNECT**         | token stuck expired (2026-06-25 19:01 UTC) despite the 2026-06-25 22:00 UTC sync — refresh failing |
| **Reddit**                                           | ⚠️ **RECONNECT**         | active but token expired 2026-06-13 UTC, refresh failing                                           |
| Facebook                                             | ✗ inactive + expired     | reconnect only if wanted                                                                           |
| Instagram                                            | ✗ inactive, never synced | reconnect only if wanted                                                                           |

## Human reconnect checklist (only a person can do these — OAuth grant)

These three are the ONLY blockers to "all tested and live" for the priority 3:

- [ ] **DR → YouTube** — dashboard → switch to _Disaster Recovery_ → Integrations → YouTube → **Reconnect**
- [ ] **DR → Reddit** — same path → Reddit → **Reconnect**
- [ ] **RestoreAssist → YouTube** — switch to _RestoreAssist_ → YouTube → **Reconnect**

After each reconnect, confirm `expires_at` moves to the future and `last_sync`
updates on the next cron pass. (Optional: also reconnect Facebook/Instagram per
business if those channels are in scope — they are inactive placeholders as of this audit.)

## Reddit target subreddits (per business) `[VERIFIED]`

The target subreddit is a **per-post value** (`subreddit` → Reddit's `sr` param in
`lib/social/reddit-service.ts`), NOT a field stored on the connection — the
connection metadata only holds the account identity. This table records the
intended business→subreddit mapping; nothing reads it as an automatic default
today.

| Business          | Target subreddit          | Reddit connection                                  | Posting account                                         | Status                                   |
| ----------------- | ------------------------- | -------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| Disaster Recovery | `r/Disaster_Recovery_Qld` | exists; scope `read submit identity` (`submit` ✅) | `u/International-Dish56` (Phill McGurk)                 | token expired → **reconnect** then ready |
| CARSI             | `r/CARSIGeneral`          | **none — Reddit not connected for CARSI**          | TBD (must moderate/be allowed to post in the subreddit) | **connect Reddit for CARSI** first       |

> Note: `u/International-Dish56` is also linked to RestoreAssist's (inactive)
> Reddit row; its metadata carries an `ownedPagePolicy` publish block
> (`publishReadiness: blocked`) that DR's connection does not.

## Reconcile performed (authorised: "Report + full reconcile") `[VERIFIED]`

Purged **5** already-soft-deleted, postless drift/orphan rows (invisible to the
app, zero dependent `platform_posts`, none in the priority 3). SQL recorded in
`connections-reconcile-2026-06-25.sql`. Post-run verification: **0 soft-deleted
and 0 orphan rows remain** in `platform_connections` across all orgs; all live
connections untouched.

| Row id                      | Org             | Platform        | Why removed                                                                                                          |
| --------------------------- | --------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `cmor42tz4000104jp1tiolzcj` | (no owning org) | googleanalytics | soft-deleted + postless; owning org link already removed (NULL org alone isn't the rule — the `deleted_at` guard is) |
| `pc_nrpg_ga_001`            | NRPG            | googleanalytics | superseded by active personal row                                                                                    |
| `be113f9a-…1f44`            | NRPG            | googlebusiness  | superseded by active personal row                                                                                    |
| `pc_nrpg_searchconsole_001` | NRPG            | searchconsole   | superseded by active personal row                                                                                    |
| `cmpd4o677000004l76a0cx0t7` | Unite-Group     | googleanalytics | superseded by active row                                                                                             |

## Non-priority orgs (state after reconcile, for completeness)

- **NRPG** (5 active): GA/GBP/SC/Drive live (personal acct); LinkedIn inactive+expired; YouTube ×… expired → reconnect; FB/IG inactive.
- **Synthex** (3 active): GA/GBP/SC live; LinkedIn + YouTube inactive+expired.
- **Unite-Group** (5 active): GA/GBP/Drive/SC live; LinkedIn inactive+expired; YouTube expired → reconnect.
- **CCW** (1 active): only Google Analytics connected — sparsest org.

## googleworkspace/cli — investigated, recommend **do NOT install** `[VERIFIED]`

Owner asked whether `https://github.com/googleworkspace/cli` would "ensure all
connects correctly." Findings:

1. It's a **standalone Rust CLI** (binary `gws`) for **Workspace** APIs — Gmail,
   Calendar, Drive, Sheets, Docs, Admin SDK. A laptop/CI/server-shell tool, **not
   a server-side library** and not embeddable in a Vercel-deployed Next.js app.
2. **Scope mismatch:** it does **not** cover GA4, Search Console, or Google
   Business Profile — 3 of Synthex's 4 Google connectors. The one it does cover
   (Drive) Synthex already runs server-side and syncs daily.
3. Its own auth model (local OAuth / service account / gcloud) is orthogonal to —
   and conflicts with — the Supabase-only auth rule.
4. Pre-v1.0, "expect breaking changes", "not an officially supported Google
   product."

**Conclusion:** it would add **zero** capability Synthex lacks and cannot
participate in the production connection flow. The Google connectors are already
healthy (all synced 2026-06-25 UTC). The real gaps are the **expired social tokens**
(YouTube/Reddit), which a CLI cannot fix — they need human re-OAuth. This is a
`dependency-discipline` "no invaders" decline with no offsetting benefit.
