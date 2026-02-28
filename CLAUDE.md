# Synthex

AI-powered marketing automation platform. Next.js 15 full-stack app deployed on Vercel.

## Project Identity

- **Name**: Synthex
- **Stack**: Next.js 15 (App Router), TypeScript 5, Prisma 6, PostgreSQL (Supabase)
- **Deployment**: Vercel (serverless), deploys from repo root
- **Node**: 22.x
- **OS**: Windows 11 (PowerShell)

## Directory Structure

```
C:\Synthex\                      # Repository root = app root
├── app/                         # Next.js App Router
│   ├── (auth)/                  #   Auth routes (login, signup)
│   ├── (onboarding)/            #   Onboarding flow
│   ├── dashboard/               #   Main app (30+ sub-pages)
│   ├── api/                     #   API routes (65+ categories)
│   └── layout.tsx               #   Root layout
├── components/                  # React components (35+ modules)
│   ├── ui/                      #   Radix UI primitives
│   ├── dashboard/               #   Dashboard widgets
│   └── ...                      #   Feature-specific components
├── lib/                         # Shared utilities & services
│   ├── auth/                    #   NextAuth.js + JWT
│   ├── ai/                      #   OpenRouter, Anthropic, Google AI
│   ├── social/                  #   Platform integrations
│   ├── stripe/                  #   Billing & subscriptions
│   ├── email/                   #   SendGrid, Resend, Nodemailer
│   ├── cache/                   #   Redis (Upstash)
│   ├── prisma.ts                #   Prisma client instance
│   └── supabase.ts              #   Supabase client
├── prisma/                      # Schema (67 models) & migrations
├── middleware.ts                # Auth, CSP, security headers
├── config/                      # App config, feature flags, rate limits
├── hooks/                       # React hooks
├── styles/                      # Tailwind CSS
├── types/                       # TypeScript type definitions
├── scripts/                     # Utility scripts (db, deploy, validate)
├── public/                      # Static assets
├── .claude/                     # Claude Code integration
│   ├── skills/                  #   Skill definitions (SKILL.md)
│   ├── agents/                  #   Agent definitions (AGENT.md)
│   ├── hooks/                   #   PowerShell hook scripts
│   ├── knowledge/               #   Persistent knowledge base
│   └── rules/                   #   Context rules by domain
├── .planning/                   # GSD planning system
│   ├── ROADMAP.md               #   10-phase hardening roadmap
│   ├── PROJECT.md               #   Project charter
│   ├── STATE.md                 #   Current progress
│   └── phases/                  #   Phase plans & summaries
├── next.config.mjs              # Next.js configuration
├── vercel.json                  # Vercel config (crons, headers, regions)
├── tsconfig.json                # TypeScript config
└── package.json                 # Dependencies & 65 scripts
```

## Commands

```bash
# Development
npm run dev                      # Start dev server (Turbo)
npm run dev:next                 # Next.js dev server directly
npm run dev:full                 # Dev server + WebSocket server

# Build
npm run build                    # next build
npm run build:vercel             # prisma generate + next build (Vercel)
npm run build:fresh              # Clean cache + build

# Database
npx prisma generate              # Generate Prisma client
npx prisma db push               # Push schema to database
npm run db:migrate:dev           # Create development migration
npm run db:migrate:deploy        # Deploy migrations to production
npm run db:studio                # Prisma Studio GUI
npm run db:validate              # Validate + generate schema

# Testing
npm test                         # Jest unit tests
npm run test:watch               # Jest watch mode
npm run test:coverage            # Tests with coverage
npm run e2e                      # Playwright E2E tests
npm run e2e:ui                   # Playwright UI mode

# Quality
npm run type-check               # tsc --noEmit
npm run lint                     # next lint
npm run format                   # Prettier

# Storybook
npm run storybook                # Dev on port 6006
npm run build-storybook          # Build static

# Deploy
npm run deploy:prod              # vercel --prod --yes
npm run release:check            # Full pre-release validation
```

## Data Models (Prisma — 67 models)

**Auth & Users**: User, Account, Session, OAuthPKCEState, Role, UserRole
**Organizations**: Organization, TeamInvitation, BusinessOwnership
**Campaigns**: Campaign, Post, CalendarPost, Project, Task
**Content**: Quote, QuoteCollection, Persona, BrandGeneration
**Platforms**: PlatformConnection, PlatformPost, PlatformMetrics
**Analytics**: AnalyticsEvent, SentimentAnalysis, SentimentTrend, EngagementPrediction
**A/B Testing**: ABTest, ABTestVariant, ABTestResult
**Reports**: Report, ScheduledReport, ReportTemplate, ReportDelivery
**Competitors**: TrackedCompetitor, CompetitorSnapshot, CompetitorPost, CompetitorAlert, CompetitorComparison
**Billing**: Subscription
**Collaboration**: ContentShare, ContentComment, ContentAccessLog, TeamNotification
**AI**: AIConversation, AIMessage
**Retention**: AIWeeklyDigest, UserHealthScore, UserStreak, UserAchievement, Referral, UserLoyaltyTier, FeedbackSurvey
**SEO/Authority**: AuthorProfile, SEOAudit, GEOAnalysis, GEOResearchReport, VisualAsset, LocalCaseStudy, ArticleAuthor
**Psychology**: PsychologyPrinciple, PsychologyMetric, UserPsychologyPreference
**System**: ApiUsage, AuditLog, PermissionAudit, Notification

## Platforms (9)

YouTube, Instagram, TikTok, X (Twitter), Facebook, LinkedIn, Pinterest, Reddit, Threads.

## Architecture Notes

- **Routing**: Next.js App Router — all pages in `app/`, API routes in `app/api/`
- **Auth**: NextAuth.js v4 with Prisma adapter, JWT + Google/GitHub OAuth
- **Database**: Prisma ORM with PostgreSQL via Supabase (driver adapters for pooler)
- **Payments**: Stripe with webhooks, subscription tiers, billing portal
- **AI**: OpenRouter (primary), Anthropic SDK, Google AI SDK, OpenAI SDK, Vercel AI SDK
- **Caching**: Upstash Redis (serverless) + ioredis
- **Jobs**: BullMQ for background task queues
- **Email**: SendGrid + Resend + Nodemailer
- **Monitoring**: Sentry (errors), PostHog (analytics)
- **State**: Zustand (client), TanStack Query + SWR (async)
- **UI**: Radix UI primitives, Tailwind CSS, Framer Motion, Recharts, Lucide icons
- **Forms**: React Hook Form + Zod validation
- **Rich text**: TipTap editor
- **Testing**: Jest (unit), Playwright (E2E), Storybook (visual)
- **Build**: Turbo for task orchestration

## Vercel Crons

| Schedule | Route | Purpose |
|----------|-------|---------|
| Hourly | `/api/reports/scheduled/execute` | Execute scheduled reports |
| Every 30 min | `/api/competitors/track/execute` | Track competitor changes |
| Daily 2am | `/api/cron/health-score` | Calculate user health scores |
| Weekly Mon 8am | `/api/cron/weekly-digest` | Send weekly digest emails |
| Every 6 hours | `/api/cron/proactive-insights` | Generate proactive insights |

## Environment Files

```
.env.example     # Template (committed) — single source of truth for required vars
.env.test        # Test defaults (committed)
.env             # Local development (gitignored)
.env.local       # Next.js local overrides (gitignored)
```

Production secrets are managed in Vercel dashboard, not in files.

## Claude Code Integration

Claude Code tools are split across two tiers — project-level (Synthex-specific) and user-level (general-purpose, shared across all projects).

### Project-level (`.claude/`) — Synthex-specific only
- **4 agents**: build-engineer, code-architect, qa-sentinel, senior-reviewer
- **15 skills**: api-testing, architecture-enforcer, build-orchestrator, client-manager, client-retention, code-review, database-prisma, design, platform-showcase, project-scanner, route-auditor, security-hardener, spec-generator, sql-hardener, ui-ux
- **Hooks**: PowerShell scripts for build validation, pre-commit checks
- **Rules**: Domain-specific context (frontend, backend, database, operations, etc.)
- **Knowledge base**: Persistent research in `.claude/knowledge/`

### User-level (`~/.claude/`) — General-purpose, available everywhere
- **17 agents**: hive-mind orchestrator, blog suite (4), marketing (4), SEO/research (3), video/visual (3), content (2)
- **34 skills**: blog suite (14), SEO (8), video/visual (3), research (3), meta (5), visual-generator

### Memory
- Lives in `.claude/memory/` (committed to git, shared across machines)
  - `MEMORY.md` — Project state, current priorities, user preferences
  - `agents-and-skills.md` — Full agent/skill inventory
  - `linear-backlog.md` — Linear issue snapshot (update after each sprint)

**Important**: Always read `.claude/memory/MEMORY.md` at the start of a session for cross-machine context. Update it when priorities change or significant work completes.

## Planning System

GSD (Get Shit Done) planning lives in `.planning/`:
- `ROADMAP.md` — 10-phase hardening roadmap (30 plans total)
- `PROJECT.md` — Project charter, requirements, constraints
- `STATE.md` — Current progress, velocity metrics, decisions
- Phase plans in `phases/<phase-number>-<name>/`
