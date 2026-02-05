# SYNTHEX File Structure Documentation

**Generated:** 2026-02-05
**Phase:** Discovery (G1)
**Swarm Build System:** v1.0

---

## Overview

| Metric | Value |
|--------|-------|
| TypeScript Files | 878 |
| JavaScript Files | 315 |
| React Components | 117 |
| API Endpoints | 143 |
| Markdown Docs | 622 |
| Prisma Models | 30 |

---

## Root Directory Structure

```
C:\Synthex\
├── .claude/                    # Claude Code configuration
├── .claude-session/            # Session persistence data
├── .github/                    # GitHub Actions workflows
├── .hive-mind/                 # Swarm coordination data
├── .husky/                     # Git hooks
├── .next/                      # Next.js build output
├── .planning/                  # Planning documents
├── .playwright-mcp/            # Playwright MCP config
├── .storybook/                 # Storybook configuration
├── .superdesign/               # Design iterations
├── .swarm/                     # Swarm build system data
├── .turbo/                     # Turborepo cache
├── .vercel/                    # Vercel deployment config
├── _framework/                 # Framework utilities
├── agents/                     # AI agent definitions
├── api.legacy/                 # Legacy API (deprecated)
├── app/                        # Next.js App Router
├── components/                 # React components
├── config/                     # Configuration files
├── data/                       # Static data files
├── database/                   # Database utilities
├── deployment/                 # Deployment scripts
├── docs/                       # Documentation
├── hooks/                      # React hooks
├── ISSUES/                     # Issue tracking
├── lib/                        # Core libraries
├── middleware/                 # Express middleware
├── monitoring/                 # Monitoring tools
├── nginx/                      # Nginx configuration
├── node_modules/               # Dependencies
├── packages/                   # Monorepo packages
├── plans/                      # Planning documents
├── playwright-report/          # Test reports
├── prisma/                     # Database schema
├── public/                     # Static assets
├── reports/                    # Generated reports
├── scripts/                    # Build/deploy scripts
├── sdk/                        # SDK code
├── ship-audit/                 # Audit logs
├── skills/                     # Claude skills
├── specs/                      # Specifications (this dir)
├── src/                        # Source code
├── stories/                    # Storybook stories
├── storybook-static/           # Built Storybook
├── supabase/                   # Supabase config
├── Synthex/                    # Synthex subdirectory
├── templates/                  # Email/content templates
├── tests/                      # Test suites
├── tmp/                        # Temporary files
└── types/                      # TypeScript types
```

---

## Key Directories

### `/app` - Next.js App Router

Primary application directory using Next.js 14 App Router.

```
app/
├── (auth)/                     # Authentication route group
├── (onboarding)/               # Onboarding flow
├── _login_disabled/            # Disabled login page
├── about/                      # About page
├── analytics/                  # Analytics dashboard
├── api/                        # API routes (143 endpoints)
│   ├── ab-testing/             # A/B testing endpoints
│   ├── activity/               # Activity tracking
│   ├── admin/                  # Admin endpoints
│   ├── ai/                     # AI content generation
│   ├── ai-content/             # AI content operations
│   ├── analytics/              # Analytics endpoints
│   ├── auth/                   # Authentication endpoints
│   ├── backup/                 # Backup operations
│   ├── brand/                  # Brand generation
│   ├── cache/                  # Cache management
│   ├── campaigns/              # Campaign management
│   ├── competitors/            # Competitor analysis
│   ├── content/                # Content management
│   ├── cron/                   # Scheduled tasks
│   ├── dashboard/              # Dashboard data
│   ├── email/                  # Email operations
│   ├── health/                 # Health checks
│   ├── integrations/           # Third-party integrations
│   ├── library/                # Content library
│   ├── mobile/                 # Mobile API
│   ├── monitoring/             # System monitoring
│   ├── notifications/          # Notification system
│   ├── onboarding/             # Onboarding flow
│   ├── organizations/          # Org management
│   ├── patterns/               # Pattern analysis
│   ├── performance/            # Performance metrics
│   ├── personas/               # AI personas
│   ├── platforms/              # Platform metrics
│   ├── psychology/             # Psychology analysis
│   ├── quotes/                 # Quotes API
│   ├── rate-limit/             # Rate limiting
│   ├── reporting/              # Report generation
│   ├── research/               # Research endpoints
│   ├── scheduler/              # Post scheduling
│   ├── social/                 # Social media posting
│   ├── stats/                  # Statistics
│   ├── stripe/                 # Payment processing
│   ├── tasks/                  # Task management
│   ├── team/                   # Team management
│   ├── teams/                  # Teams (extended)
│   ├── trending/               # Trending content
│   ├── user/                   # User management
│   ├── webhooks/               # Webhook handlers
│   ├── white-label/            # White-label config
│   └── ws/                     # WebSocket endpoint
├── api-reference/              # API documentation
├── auth/                       # Auth pages
├── blog/                       # Blog pages
├── brand-generator/            # Brand generator
├── careers/                    # Careers page
├── case-studies/               # Case studies
├── changelog/                  # Changelog page
├── components/                 # Page-level components
├── dashboard/                  # Dashboard pages
├── demo/                       # Demo page
├── docs/                       # Documentation pages
├── features/                   # Features page
├── forgot-password/            # Password reset
├── pricing/                    # Pricing page
├── privacy/                    # Privacy policy
├── roadmap/                    # Roadmap page
├── support/                    # Support page
├── terms/                      # Terms of service
├── test-ai/                    # AI testing page
├── test-login/                 # Login testing
├── test-social/                # Social testing
├── globals.css                 # Global styles (37KB)
├── layout.tsx                  # Root layout
├── page.tsx                    # Home page (48KB)
└── providers.tsx               # Context providers
```

### `/components` - React Components

```
components/
├── 3d/                         # Three.js 3D components
├── analytics/                  # Analytics components
├── error-states/               # Error state components
├── examples/                   # Example components
├── icons/                      # Custom icons
├── marketing/                  # Marketing components
├── onboarding/                 # Onboarding wizard
├── skeletons/                  # Loading skeletons
├── strategic-marketing/        # Marketing strategy
├── stripe/                     # Stripe components
├── ui/                         # UI primitives (Radix-based)
├── AIABTesting.tsx             # A/B testing component
├── AIContentStudio.tsx         # Content studio
├── AIHashtagGenerator.tsx      # Hashtag generation
├── AIPersonaManager.tsx        # Persona management
├── AIWritingAssistant.tsx      # Writing assistant
├── ApprovalWorkflow.tsx        # Approval workflow
├── CollaborationTools.tsx      # Team collaboration
├── CommandPalette.tsx          # Command palette (cmdk)
├── CompetitorAnalysis.tsx      # Competitor analysis
├── CustomReportBuilder.tsx     # Report builder
├── DashboardWidget.tsx         # Dashboard widgets
├── PostScheduler.tsx           # Post scheduling
├── PredictiveAnalytics.tsx     # Predictive analytics
├── RealTimeAnalytics.tsx       # Real-time analytics
├── RichTextEditor.tsx          # Rich text editor
├── ROICalculator.tsx           # ROI calculator
├── SentimentAnalysis.tsx       # Sentiment analysis
├── WorkflowAutomation.tsx      # Workflow automation
└── [40+ more components]
```

### `/lib` - Core Libraries

```
lib/
├── ai/                         # AI service integrations
├── alerts/                     # Alert system
├── analytics/                  # Analytics tracking
├── api/                        # API utilities
├── auth/                       # Authentication logic
├── batch/                      # Batch processing
├── cache/                      # Cache management
├── data/                       # Data utilities
├── database/                   # Database helpers
├── email/                      # Email services
├── i18n/                       # Internationalization
├── industries/                 # Industry presets
├── metrics/                    # Metrics collection
├── middleware/                 # Middleware utilities
├── monitoring/                 # Monitoring tools
├── multi-tenant/               # Multi-tenancy
├── oauth/                      # OAuth utilities
├── observability/              # Observability
├── scalability/                # Scaling utilities
├── schemas/                    # Validation schemas
├── security/                   # Security utilities
├── services/                   # Business services
├── social/                     # Social media APIs
├── stripe/                     # Stripe integration
├── testing/                    # Test utilities
├── webhooks/                   # Webhook handlers
├── websocket/                  # WebSocket utilities
├── prisma.ts                   # Prisma client
├── redis-client.ts             # Redis client
├── redis-unified.js            # Unified Redis
├── supabase.ts                 # Supabase client
└── utils.ts                    # Utility functions
```

### `/prisma` - Database Schema

```
prisma/
├── migrations/                 # Database migrations
├── schema.prisma               # Main schema (30 models)
├── schema.dev.prisma           # Development schema
├── schema.sqlite.prisma        # SQLite schema
├── seed.js                     # Database seeding
└── seed.ts                     # TypeScript seeding
```

### `/tests` - Test Suites

```
tests/
├── agents/                     # Agent tests
├── api/                        # API tests
├── e2e/                        # End-to-end tests
├── fixtures/                   # Test fixtures
├── integration/                # Integration tests
├── k6/                         # Load tests (k6)
├── load/                       # Load test scripts
├── playwright/                 # Playwright tests
├── strategic-marketing/        # Marketing tests
├── unit/                       # Unit tests
├── jest.setup.js               # Jest configuration
├── setup.js                    # Test setup
└── setup.ts                    # TypeScript setup
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Project dependencies and scripts |
| `tsconfig.json` | TypeScript configuration (strict mode enabled) |
| `next.config.mjs` | Next.js configuration |
| `tailwind.config.cjs` | Tailwind CSS configuration |
| `postcss.config.cjs` | PostCSS configuration |
| `jest.config.js` | Jest test configuration |
| `playwright.config.ts` | Playwright configuration |
| `vercel.json` | Vercel deployment config |
| `turbo.json` | Turborepo configuration |
| `eslint.config.js` | ESLint configuration |

---

## File Type Distribution

| Extension | Count | Description |
|-----------|-------|-------------|
| `.ts` | 600+ | TypeScript source files |
| `.tsx` | 280+ | React TypeScript components |
| `.js` | 200+ | JavaScript files |
| `.jsx` | 115+ | React JavaScript components |
| `.md` | 622 | Documentation files |
| `.css` | 50+ | Stylesheet files |
| `.json` | 100+ | Configuration files |
| `.sql` | 20+ | Database scripts |
| `.py` | 30+ | Python automation scripts |

---

## Notes

1. **Large Home Page:** `app/page.tsx` is 48KB, indicating a complex landing page
2. **Rich Component Library:** 117 React components with comprehensive UI coverage
3. **Extensive API Surface:** 143 API endpoints covering all major features
4. **Multiple Configuration Variants:** Several config files for different environments
5. **Legacy Code:** `api.legacy/` directory indicates migration from older architecture
