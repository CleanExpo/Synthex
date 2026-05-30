---
name: dependency-discipline
description: >-
  The "no invaders" gate for Synthex. The ship already carries everything it needs. NEVER add a
  new npm dependency, external SaaS, framework, datastore, or auth system to solve a problem an
  existing system already solves — adding one is a CEO-gated decision. ALWAYS prove the
  capability isn't already present (grep package.json, lib/, the skills list, Vercel env) before
  integrating anything new. Activate on ANY request to "add a package / install / npm i /
  integrate X / we need a tool / use library Y / add a provider / new database".
metadata:
  author: synthex
  version: '1.0'
  type: governance-skill
  triggers:
    - add a package
    - npm install
    - npm i
    - install a library
    - new dependency
    - integrate
    - we need a tool
    - add a provider
    - new database
    - new framework
  requires: []
  context: fork
---

# Dependency Discipline — no invaders board this ship

A new dependency is a passenger you feed forever: bundle size, serverless cold-starts, a
CVE surface, a migration tax, and one more thing that can break a paying client's product.
**The default answer to "let's add X" is NO** — because the ship almost certainly already
carries something that does it.

## The rule

Before adding ANY new npm package, external SaaS, framework, datastore, or auth system:

1. **Prove it isn't already here** (the checklist below). If it is — use it.
2. If a wired-up capability is *close*, **extend it** rather than add a rival.
3. If it is genuinely new and necessary, it is a **CEO-gated decision** — surface the
   trade-off (what it buys, bundle/cold-start cost, the maintenance tax, the alternative we
   already own) and wait for explicit human approval. Log the decision.

There is exactly one auth system (Supabase), one ORM (Prisma), one deploy target (Vercel +
Railway). Do not add a second of anything that already exists.

## What the ship already carries (check here first)

| Need | Already wired — use this |
|------|--------------------------|
| Auth / sessions | **Supabase** (only auth — never NextAuth/Clerk/Auth0/custom) |
| Database / ORM | **Supabase Postgres + Prisma 7** (+ pgvector for embeddings) |
| Hosting / cron / OG / ISR | **Vercel**; long-running services on **Railway** |
| LLMs | **Anthropic, OpenAI, OpenRouter, Google/Gemini, Perplexity** (keys in Vercel env) |
| AI voice (TTS / clone) | **ElevenLabs** (`lib/services/ai/voice-generation.ts`) |
| AI avatar video | **HeyGen** (`lib/marketing-agency/heygen`, `heygen-avatar` skill) |
| Video render / assembly | **Remotion + FFmpeg + Playwright** (`lib/video`, `video-engine`) |
| Web scrape | **Firecrawl** (`@mendable/firecrawl-js`) → native fetch fallback |
| Email | **Resend + SendGrid** (`lib/email/queue.ts`) |
| Billing | **Stripe** |
| Cache / queue / rate-limit | **Redis / Upstash** + **BullMQ** (`lib/rate-limit`, `lib/email/queue`) |
| Social distribution | **9 platforms** wired (`lib/social`) — twitter, linkedin, instagram, facebook, tiktok, youtube, pinterest, reddit, threads |
| Search / local SEO | **GSC + GBP** integrations (`lib/google`, `google-*` skills) |
| Errors | **Sentry** (client-side; server-side capture is intentionally off — use structured logging via `serializeError`) |
| State (frontend) | **React hooks + Server Components** — never Redux/Zustand |
| Data fetching (client) | **SWR** with `credentials:'include'` |
| Validation | **Zod** |
| UI | **Radix + shadcn/ui + Tailwind** |

## Before-you-add checklist

```bash
grep -i "<capability>" package.json            # already a dependency?
grep -rli "<capability>" lib app                # already wired in code?
npx vercel env ls | grep -i "<provider>"        # already have the keys/account?
# and scan the skill list — a specialist skill may already own this domain
```

If any hit → the capability exists. Use it. Stop.

## Hard NO (these are settled — do not re-litigate)

- ❌ A **second** auth / email / voice / video / LLM-gateway provider when one is wired.
- ❌ **Redux, Zustand, tRPC, GraphQL, Server Actions for mutations** — absent by design; mutations go through API routes (`architecture-enforcer`).
- ❌ **Any non-Supabase auth** (NextAuth, Clerk, Auth0, custom JWT issuance).
- ❌ A new ORM / query builder / migration tool alongside Prisma.
- ❌ `pnpm`/`yarn` — this project uses **npm**.
- ❌ Heavy deps that blow the 50 MB serverless function limit or the cold-start budget.

## When new genuinely IS justified

Rare, and always: (1) the checklist confirms nothing existing fits, (2) the cost is named
(bundle, cold-start, CVE surface, maintenance), (3) the alternative-we-own is named and
rejected for a concrete reason, (4) **explicit CEO approval**, (5) pinned exact version,
(6) the decision logged. Then — and only then — it boards.

> A comprehensive, advanced system isn't the one with the most packages. It's the one that
> does the most with the fewest moving parts it already trusts.
