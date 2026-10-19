# Synthex — read this first

**What Synthex is (FD-8, founder, 19/10/2026).** Unite Group's INTERNAL AI-driven marketing agency for
Unite-Group Nexus (synthex.social). Not a client-facing product or SaaS: operators use it to run content,
SEO, social and reporting for the group's businesses. Stripe product billing, subscriptions, pricing pages
and "going public" are out of scope (P10 retired). Never raise them as blockers. Cost metering, spend
quotas and per-organisation attribution ARE in scope as safety infrastructure.

**Metric of record.** Synthex earns nothing itself. It succeeds when a Unite Group business gains paying
customers or MRR (Unite-Group `NORTH-STAR.md`). Focus until 18/11/2026 (FD-10): CARSI paid enrolments and
RestoreAssist trials. In every handoff, name the client metric the change moves, or say "none: internal
plumbing". Per-client metric definitions and where each is read: OPEN, not yet recorded here.

**Authority.** `docs/governance/CONSTITUTION.md` overrides this file. Decisions: `DECISIONS.md` (FD-\* rows
are the founder's). Long-form conventions: `docs/governance/CLAUDE.md` (reference only; parts are stale,
e.g. it says Prisma 6). Fleet: `scripts/fleet/README.md`, `scripts/fleet/policy.json`. Always-on rules:
`.claude/rules/`.

## Stack (re-derive from package.json)

Next.js 16 App Router · React 19 · TypeScript 5 · Prisma 7.7 · Postgres on Supabase · Vercel · Node 22.x ·
npm only. Dev: `npm run dev` (port 3008). New worktree: `bash scripts/worktree-bootstrap.sh`.

## Rules that cost real time when broken

- Real images only: `lib/services/ai/image-generation.ts` is the sole entry; no owned references means
  BLOCKED (`.claude/rules/real-images-only.md`).
- Honest status: a failed or unprovisioned read or write never looks like success
  (`lib/api/not-provisioned.ts`, 503 `FEATURE_NOT_PROVISIONED`).
- Before touching a route, read `.planning/ROUTE_REFERENCE.md` for its path, auth level and `lib/auth/`
  function. Request auth: `getUserIdFromRequestOrCookies` (`lib/auth/jwt-utils.ts`).
- Mutating routes validate input (`lib/api/define-route.ts`); data is organisation-scoped.
- "Live" means https://synthex.social/api/health reports the merge SHA as `buildId`, not a green CI job
  (FD-9). A merge to main deploys through the Vercel Git integration.
- Protected paths (`scripts/fleet/policy.json`) change only in a declared fleet commit or with the
  founder's `human-required` label.
- AU English, AUD, DD/MM/YYYY.

## Gates

`npm run type-check && npm run lint && npm test`; Vercel builds with `npm run build:vercel`. Tag claims per
`.claude/rules/fabel-evidence-standard.md`. CI fails if this file goes missing or becomes a symlink.
