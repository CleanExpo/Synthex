---
name: north-star
description: >-
  The engineering navigation layer for Synthex — holds the mission, the current course, the
  rules of the ship, and routes work to the right existing specialist. Load at the START of
  any planning, prioritisation, "what's next", roadmap, scope, or new-feature decision.
  NEVER let work drift off the critical path or add capabilities the ship already carries
  (see dependency-discipline). NEVER claim done without the verification gate. NEVER merge to
  production or change prod data without a human gate. ALWAYS trace a task to the NorthStar,
  the live Linear epic, and an existing system before writing code.
metadata:
  author: synthex
  version: '1.0'
  type: governance-skill
  triggers:
    - what's next
    - whats next
    - roadmap
    - prioritise
    - are we on track
    - keep on course
    - north star
    - plan the next
    - scope decision
    - new feature
  requires:
    - dependency-discipline
    - foundation-keeper
    - senior-strategist
  context: fork
---

# North Star — keep the ship pointing north

The captain for ENGINEERING direction. The operator is not a software engineer; this skill
is how a swarm of senior engineers keeps the project comprehensive, advanced, and on course
**using only what the ship already carries** — no invaders.

## 1. The North Star (mission)

Synthex is a production-grade, white-label **AI marketing automation platform** for small
businesses (synthex.social), serving paying clients (CCW, Disaster Recovery, CARSI,
RestoreAssist; more as they come online). The engineering North Star:

> A **secure, reliable, client-working** platform whose **autonomous agentic systems**
> (content studio, marketing intelligence, autopilot) deliver measurable client outcomes —
> phone calls, bookings, ranking, visibility — with a human in the loop on anything client-facing.

Every decision answers: **does this make a paying client's product work better, and is it on the critical path?** If not, it waits.

## 2. Where the truth lives (read before deciding)

- **Mission / identity:** `CLAUDE.md`, `CONSTITUTION.md`, `../Unite-Hub/.portfolio/PORTFOLIO.yaml`, `.planning/`.
- **Live backlog + course:** Linear — Synthex team (`SYN`). Active epics: **SYN-994** (production-readiness), **SYN-1005** (client content studio), **SYN-989** (marketing intelligence).
- **What the ship carries (env/secrets):** Vercel production env + Railway — read with `npx vercel env ls` / Railway MCP. NEVER hardcode secrets; they live in the platform dashboards only.
- **The crew (specialists):** `.claude/skills/` — route to these, don't reinvent (§5).

## 3. Rules of the ship (non-negotiable — proven this programme)

1. **Verification gate.** Before any "done": run `npm run type-check && npm run lint && npm test` and paste real pass/fail counts. Banned: "should work", "probably passes", "seems correct", "likely fixed".
2. **Human gate at the waterline.** Never merge to production or change production data without explicit human sign-off. PRs end at a human review/merge gate; prod DB DDL is CEO-gated.
3. **No fabricated data.** Metrics (traffic, CTR, views, rankings) are real or marked `DATA_REQUIRED`. Never invent numbers in client-facing output or reports.
4. **Evidence before fix.** Root-cause from real evidence (logs, DB, repro). If the cause can't be confirmed, improve observability — don't ship a guess. (See the autopilot triage, SYN-999.)
5. **One PR at a time.** Small, focused, reviewable PRs on feature branches; don't stack unmerged work. Keep `main` clean; never leave uncommitted changes.
6. **Org-scope every query.** Multi-tenant: every Prisma query carries `organizationId`. Supabase-only auth.
7. **DB migrations (Prisma 7 + dotenvx):** apply via Supabase MCP `apply_migration` (preferred) or `npx dotenvx run -- npx prisma db execute` — **never** `db push`, **never** `--url` (removed in Prisma 7). See `database/supabase-migrations`.
8. **Australian English** in all content + UI.

## 4. No invaders (the core directive)

The ship already carries everything it needs. **Never add a new npm dependency, external SaaS,
framework, datastore, or auth system** to solve a problem an existing system already solves.
Before integrating anything new, prove it isn't already here. This is enforced by the
[[dependency-discipline]] skill — load it on any "add / install / integrate / we need a tool" request.

## 5. The crew — route work to existing specialists (don't reinvent)

| Work                      | Route to                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Architecture / patterns   | `architecture-enforcer`, `code-architect`                                                                |
| Security / SSRF / authz   | `security-hardener`, `route-auditor`, `auth-patterns`                                                    |
| DB / migrations / schema  | `database-prisma`, `sql-hardener`                                                                        |
| Tests / coverage / gates  | `api-testing`, `qa-sentinel`, `verify`                                                                   |
| Deploy / build / prod     | `build-orchestrator`, `ship-loop-*`                                                                      |
| SEO / GEO / AEO           | `local-seo-agent`, `google-search-console`, `algorithm-knowledge-base`, `agentic-marketing-intelligence` |
| Client video/voice studio | `client-content-studio`, `heygen-avatar`, `video-engine`, `content-pipeline`                             |
| Social distribution       | `social-integrations`, `platform-content-adaptor`                                                        |
| Brand / content / voice   | `business-dna`, `brand-voice-enforce`, `senior-copywriter`, `synthex-standards`                          |
| Strategy / orchestration  | `senior-strategist`, `foundation-keeper`, `boardroom`                                                    |
| Codebase scan / health    | `project-scanner`                                                                                        |

If a capability is missing, prefer **extending an existing skill** over creating a new one.

## 6. Decision protocol (run for every task)

```
1. NORTH STAR — does this serve a paying client's working product? (else defer)
2. COURSE     — which live Linear epic/issue does it advance? (else: why now?)
3. NO INVADER — does it reuse what we carry? new dep/SaaS -> STOP, see dependency-discipline
4. SPECIALIST — which existing skill owns this? route there
5. GATE       — verifiable (type-check+lint+test) AND human-gated for prod?
6. EVIDENCE   — grounded in real logs/DB/code, not assumption?
```

## 7. Current course (keep honest — verify against Linear before trusting)

> Last re-synced against Linear **2026-06-24** (first-hand). The whole SYN-994
> production-readiness ship-gate is **Done** — do not re-open these from this list;
> re-verify in Linear before trusting any line below.

- **Shipped to production (verified Done in Linear):** SYN-994 ship-gate in full — P0 SSRF-IPv6 (SYN-995), IDOR comments fix + regression (SYN-996/997), GA4 hourly self-heal (SYN-998), SSRF defence-in-depth (SYN-1001), cron 500 triage (SYN-999), Upstash rate-limit + outage-masking fix (SYN-1004), LinkedIn refresh-token handling (SYN-1003), Google token-refresh + health monitoring (SYN-1013), critical behavioural test coverage (SYN-1000), governance skills (SYN-1011). Plus the verification lane: authority-sources contract (SYN-1039, #585), deploy-readiness routine (SYN-694, #585), quotes IDOR regression (#586).
- **Open — needs the operator (no chat-pasting of secrets; dashboard/OAuth only):** `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` + GSC/GA4 property access, studio go-live keys (`RA_HEYGEN_AVATAR_ID`, `RA_CONSENT_REF`), LinkedIn OAuth reconnect, sign-offs on SYN-1046 (CCW email) + SYN-914 (DR→shared Supabase migration).
- **Open — CEO-gated production changes:** SYN-1012 (auto-publish failure-modes State-1/State-6 — live client-publish path), SYN-1002 (prod DB migration baseline), SYN-914 (DR Supabase migration DDL).
- **Open — operator-gated marketing execution:** CCW Roadshow publishing (SYN-1044/1045/1047 social, SYN-1046 email) — need live social connections + Phill sign-off.
- **Open — autonomous:** the safe ticketed backlog is currently **exhausted**. Next autonomous value is the SYN-694 follow-up (Linear-keeper auto-post for the readiness packet) and net-new test-coverage slices on org-scoped routes (the SYN-997 IDOR pattern). SYN-1021 (OAuth replay protection) lives in **Unite-Hub**, not this repo.

> A stale chart sinks ships. Re-sync §7 against Linear whenever you plan.
