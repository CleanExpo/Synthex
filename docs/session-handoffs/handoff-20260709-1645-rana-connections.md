# Session Handoff — 2026-07-09 ~16:45 AEST — for Rana: finalise the connection packages

**Audience:** Rana (human developer), tasked by Phill with finalising the packages so all
projects are fully connected for live publishing.
**Repos:** CleanExpo/Synthex (`main` @ `c41f38a3`+), CleanExpo/CARSI (`main` @ `53313b65`).
**Author:** agent session 2026-07-09 (resumed from `handoff-20260709-1320`, CARSI repo).

## 1. Summary — what was done today

**Completed & verified:**

- **Synthex LinkedIn org-publishing machinery (E1–E5) merged + deployed** (#637):
  connect-time numeric org-id capture (`lib/social/linkedin-organization.ts`), manual
  override endpoint (`PATCH /api/auth/connections/[id]/organization`), LinkedIn IMAGE
  publishing (registerUpload→asset URN, https `res.cloudinary.com` only, fail-loud),
  campaign scheduler loader (`scripts/load-campaign-scheduler-payloads.ts`, dry-run default),
  readiness audit aligned to the live publish gate. 34 tests added; spec at
  `docs/specs/2026-07-09-carsi-linkedin-golive-spec.md`.
- **`LINKEDIN_ORGANIZATION_SOCIAL_ENABLED=true` set on Vercel Production** (live since the
  #637 deploy) — the OAuth flow now requests `w_organization_social`.
- **Build-log conflicts fixed + proven in the prod build log** (#638): single Prisma 7.7.0
  generate (stale `npx prisma@7.5.0` pin removed from `vercel.json` + `build:vercel:legacy`),
  `--legacy-peer-deps` dropped from installCommand (strict resolve verified clean-room),
  vulnerabilities 18 (1 high) → 7 low (dev-only nested esbuild).
- **Deploy workflow un-broken** (#639): was red since 2026-07-08 13:24 on the media gate —
  missing `.avif/.webp` sidecars for `public/invisible-line/images/act1–6.jpg` generated via
  `node scripts/optimize-media.mjs --write`. All Synthex main workflows green.
- **CI log hygiene**: actions bumped v4→v5 (Node 24) across all workflows; `eslint-env`
  comment replaced (ESLint v10 future-error).
- **CARSI #489 (CCW scrape) fixed + merged + deployed**: branch predated the 2026-07-08 main
  rewrite; rebuilt as a fast-forward merge whose diff = exactly the 2026-07-08 scrape refresh
  of `data/seed/ccw-products.json` (250 products; +Actichem Rust Remover 5L,
  −PowerClean BioClenz Ultra 1Kg). 12/12 checks → merged → DO deployment ACTIVE on
  `53313b65`, carsi.com.au 200.
- **Full-site IICRC compliance crawl**: 0 banned-terminology violations across all 80 live
  course pages + campaign pack; exposure quantified (71/80 pages show derived CEC hours —
  GP-498); COACH8 brand-exclusion sweep: 0 hits everywhere (standing rule: COACH8 must never
  appear in any branding).

**Partial / awaiting external:** LinkedIn + Meta connections (see §7 — the core of your task).
**Not touched:** blog/email owned-channel publishing (content ready, founder review gate);
GP-483 image pipeline; GP-498 founder data.

## 2. Where it started

Founder directive: "getting everything connected 100% correctly and stable so it is locked
in for Live use" → then "finish the facebook/instagram connection issues" → this handoff.
The H5 campaign (35 posts: 12 LinkedIn / 10 FB / 10 IG / blog / 2 emails) is scheduler-ready
in `docs/marketing-agency/campaigns/carsi-h5-launch-2026-07-08/`.

## 3. Decisions locked + what shipped

- Founder: merge-on-green authority was granted per-PR (637/638/639/489 — all merged).
- Founder: COACH8 excluded from all branding (priority, standing).
- **Do NOT unset `LINKEDIN_ORGANIZATION_SOCIAL_ENABLED`** as a workaround — member-scope
  connections post to the member's PERSONAL feed (non-numeric `profileId` → person URN).
- Shipped: everything in §1 is on `main` in both repos with prod deploys verified
  (Vercel READY / DO ACTIVE). Nothing is local-only except this handoff file.

## 4. Key files

| File                                                                                                                                                                                                                                                                    | Status                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Synthex `lib/social/linkedin-organization.ts`, `linkedin-service.ts`, `app/api/auth/connections/[connectionId]/organization/route.ts`, `lib/scheduling/campaign-payload-loader.ts`, `scripts/load-campaign-scheduler-payloads.ts`, `scripts/social-launch-readiness.ts` | Created/Modified — merged                                                              |
| Synthex `vercel.json` (buildCommand/installCommand), `package.json`                                                                                                                                                                                                     | Modified — merged                                                                      |
| Synthex `.github/workflows/*` (v5 actions), `public/invisible-line/images/*.{avif,webp}`                                                                                                                                                                                | Modified/Created — merged                                                              |
| CARSI `data/seed/ccw-products.json`                                                                                                                                                                                                                                     | Modified — merged + deployed                                                           |
| Synthex `docs/specs/2026-07-09-carsi-linkedin-golive-spec.md`                                                                                                                                                                                                           | Reference — merged                                                                     |
| CARSI `docs/specs/2026-07-09-iicrc-compliance-completion.md`                                                                                                                                                                                                            | Spec (uncommitted, in worktree `fable5-nexus-copywriter-3e6647`) — awaiting founder go |

## 5. Running state (verified)

- Vercel `synthex` production: READY on post-#639 main. DO `monkfish-app`: ACTIVE `53313b65`.
- Publish cron `*/5min` + `CRON_SECRET` set; `refresh-tokens`/`token-health` crons live.
- No local processes left running. Gate logs: see §6.
- KNOWN NOISE: `/api/cron/dr-gbp-oauth-refresh` 500s every run — missing `DR_GBP_OAUTH_*` +
  `VERCEL_TOKEN` envs. Pre-existing; needs creds added or the cron removed (founder call).

## 6. Verification — exact commands

```bash
# Synthex gates (run on main)
cd ~/Synthex && npm run type-check && npm run lint && npm test
# CARSI gates
cd <CARSI> && npm run type-check && npm run lint && npm run check:iicrc-terminology \
  && npm run check:iicrc-compliance && npm run test:unit
# Channel readiness (needs prod DATABASE_URL; local .env.local lacks it by design)
npx tsx scripts/social-launch-readiness.ts --stdout
# Connection truth (read-only, Supabase project znyjoyjsvjotlzjppzal):
#   platform_connections WHERE organization_id=<carsi org> AND platform='linkedin'
#   → need: scope LIKE '%w_organization_social%' AND profile_id ~ '^\d+$'
# Campaign loader (dry-run, prints plan, POSTs nothing)
npx tsx scripts/load-campaign-scheduler-payloads.ts
# Meta alignment probe (no login needed; expect Meta LOGIN page, not "Can't load URL")
curl -s "https://www.facebook.com/v18.0/dialog/oauth?client_id=1316892900613495&redirect_uri=https%3A%2F%2Fsynthex.social%2Fapi%2Fauth%2Fcallback%2Ffacebook&config_id=1544525556521302&response_type=code&state=probe"
```

Gate results at handoff: see the addendum at the bottom of this file (run on the exact
deployed tips).

## 7. THE TASK — connection finalisation matrix (what's left, per channel)

| Channel                   | Machinery                              | Blocker                                                                                                        | Who                                 |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **LinkedIn (CARSI page)** | ✅ deployed                            | **Community Management API approval** — Phill submitted the request 2026-07-09 ~16:15 AEST; LinkedIn reviewing | LinkedIn → then Phill reconnects    |
| **Facebook**              | ✅ config fully aligned (probe passes) | **Business Verification + App Review** (`pages_manage_posts`) + flip app Live + **rotate app secret**          | Meta console (app 1316892900613495) |
| **Instagram**             | ✅ same app/config                     | Same Meta gates + `instagram_content_publish`                                                                  | Meta console                        |
| **Blog + Email (owned)**  | ✅ content ready in campaign pack      | Founder review + send approval                                                                                 | Phill                               |

**LinkedIn sequence once approval lands:** Phill reconnects at
`synthex.social/dashboard/integrations` (as CARSI org owner) → verify DB row (org scope +
NUMERIC `profile_id`; the new callback auto-captures it; fallback = the override endpoint
with the numeric org id from the page admin view) → shadow post to `company/carsiaus` →
load 12 posts via the loader `--execute` (auth: `SYNTHEX_SESSION_COOKIE` env).

**Meta sequence:** Business Verification (Security Centre — multi-day, start first) → App
Review for the two publish permissions (justification drafts are in the 2026-07-09 session
notes; screen recording of connect→schedule→publish required) → switch app to Live →
**rotate the App Secret** and re-enter it in Synthex → Settings → Integrations → Platform
OAuth Credentials (both facebook AND instagram rows; owner types the secret). Interim: app
admins can dev-mode connect + test-publish now.

## 8. Pick up here (Rana)

1. **First command:** the Meta alignment probe in §6 — expect Meta's login page (proves App
   ID + config + App Domains + redirect URIs all agree; they did at 2026-07-09 16:00 AEST).
2. Read the five-gotcha playbook: `.claude/skills/connecting-meta-facebook-instagram/SKILL.md`
   (Synthex repo skill; gotchas 1/2/4/5 are why previous attempts failed).
3. Drive the Meta console items in §7 — they're the only FB/IG blockers left.
4. When LinkedIn approval lands, support Phill through the reconnect + verification above.
   **Do not redo:** anything in §1; do NOT rebase pre-rewrite CARSI branches (rebuild
   payload-only onto current main — that's how #489 was fixed); do NOT re-add `engines.npm`
   (CARSI) or `--legacy-peer-deps` / the `prisma@7.5.0` pin (Synthex); do NOT create Login
   configs on any app other than 1316892900613495.

## 9. Risk notes

- **The under-scoped LinkedIn connection trap:** connecting before scope/approval are ready
  stores `w_member_social` + a non-numeric member id → posts land on the PERSONAL feed.
  Today's active CARSI/RA/DR LinkedIn rows are all in that state — they must be REPLACED by
  reconnects, not reused. Never "fix" by disabling the org flag.
- Synthex prod DB is **snake_case** (`platform_connections.organization_id`) — Prisma
  camelCase queries fail in raw SQL.
- The scheduler API rejects `+10:00` offset datetimes (Zod `.datetime()`) and takes media as
  `metadata.images`, NOT top-level `mediaUrls` — the loader handles both; don't hand-POST.
- CARSI: pushing ANY branch auto-spawns a PR + preview; use tags to preserve SHAs. Local
  `~/CARSI` main checkout is stale/diverged — use worktrees.
- Local Synthex `node_modules` can silently lack the `@unite-group/control-module` git dep →
  phantom type-check failures; `npm install` first.
- IICRC AI Use Policy (published, licence-relevant): never feed IICRC standard text into AI
  tooling or reproduce it in course content; see CARSI spec
  `docs/specs/2026-07-09-iicrc-compliance-completion.md` (awaiting founder decisions).
- COACH8: never in any branding surface (founder priority rule; sweep before publishing).

## 10. Handoff quality check

Gates re-run on the deployed tips (addendum below) · every "shipped" claim has merge +
deploy evidence (PR #s, deployment states) · running-state claims verified this hour ·
deferred vs completed separated · first command provided.

Handoff complete. Next safe action: Rana runs the §6 probe + §8 step 2, then works the Meta console list; Phill watches for the LinkedIn approval email.

---

## Addendum — Phase-0 gate results (run 2026-07-09 ~16:50 AEST)

| Repo @ tip                   | Gates                                                                            | Result                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Synthex @ `cab61fe7d` (main) | type-check · lint · jest                                                         | **all exit 0 — Tests: 5232 passed, 5460 total (201 skipped, 27 todo)** |
| CARSI @ `53313b65` (main)    | type-check · lint · check:iicrc-terminology · check:iicrc-compliance · test:unit | **all exit 0 — 488/488 tests passed**                                  |

Note: Synthex main advanced during gating (`cab61fe7d` — credential-free DB ledger/preflight
helpers, another stream); gates were run on and pass at that tip.
