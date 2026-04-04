# Platform ↔ Brand Intelligence Integration Contract

> **SYN-490** | Created: 2026-03-29 | Owner: Technical Architect

This document defines the integration boundary between the **Synthex marketing platform** (Next.js dashboard, 32 files) and the **brand intelligence pipeline** (UNI-1661, multi-agent orchestration system).

## Boundary Rule

**All data exchange between platform and pipeline MUST go through `shared/types/`.**

Direct imports across the boundary are prohibited. If a dashboard component needs pipeline data, it imports from `shared/types/` and reads from the agreed data sources below.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SYNTHEX MARKETING PLATFORM                       │
│                    (Next.js / Vercel / Supabase)                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Client       │  │ Analytics    │  │ Dashboard Components     │  │
│  │ Dashboard    │  │ Engine (GA4) │  │ (brand profile viewer,   │  │
│  │              │  │              │  │  content calendar,       │  │
│  │              │  │              │  │  health scores)          │  │
│  └──────┬───────┘  └──────────────┘  └────────────┬─────────────┘  │
│         │                                          │                │
│         │         ┌────────────────────┐           │                │
│         └────────►│  shared/types/     │◄──────────┘                │
│                   │  (TypeScript       │                            │
│                   │   interfaces)      │                            │
│                   └────────┬───────────┘                            │
│                            │                                        │
├────────────────────────────┼────────────────────────────────────────┤
│         INTEGRATION BOUNDARY (this document)                        │
├────────────────────────────┼────────────────────────────────────────┤
│                            │                                        │
│                   ┌────────┴───────────┐                            │
│                   │  Supabase Tables   │                            │
│                   │  + File Storage    │                            │
│                   └────────┬───────────┘                            │
│                            │                                        │
│  ┌──────────────┐  ┌──────┴───────┐  ┌──────────────────────────┐  │
│  │ Orchestrator │  │ Brand        │  │ Content     │ SEO        │  │
│  │ (Opus 4.6)  │──│ Analyst      │  │ Strategist  │ Specialist │  │
│  │              │  │ (Sonnet 4.6) │  │ (Sonnet)    │ (Haiku)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│                    BRAND INTELLIGENCE PIPELINE                      │
│                    (Agent SDK / File-based / Cron)                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Sources & Ownership

| Data | Written by | Read by | Storage | Type |
|------|-----------|---------|---------|------|
| Client roster | Platform (onboarding) | Pipeline (every run) | `clients/active-clients.json` | `ClientRoster` |
| Brand profile | Pipeline (Brand Analyst) | Platform (dashboard) | `clients/{id}/brand-profile/active.json` | `BrandProfile` |
| Content intelligence | Pipeline (Content Strategist) | Platform (calendar view) | `clients/{id}/content/intelligence-{date}.json` | `ContentIntelligence` |
| Content queue items | Pipeline (Compliance Guardian) | Platform (review UI) | `clients/{id}/content/queue/`, `/approved/`, `/review/` | `ContentQueueItem` |
| Health scores | Pipeline (Health Monitor) | Platform (admin dashboard) | `clients/{id}/health/health-score-log.json` | `HealthScoreLog` |
| Pipeline run metrics | Pipeline (Orchestrator) | Platform (admin dashboard) | `logs/platform-summary-{run_id}.json` | `PipelineRunSummary` |
| Admin dashboard state | Pipeline (Senior PM) | Platform (admin page) | `platform/admin-dashboard-state.json` | `AdminDashboardState` |
| SEO intelligence | Pipeline (SEO Specialist) | Platform (SEO view) | Appended to `active.json` | `SEOIntelligence` |

## API Routes

### Platform → Pipeline (triggers)

| Route | Method | Purpose | Request Type | Response Type |
|-------|--------|---------|-------------|---------------|
| `/api/pipeline/trigger` | POST | Manually trigger a pipeline run | `{ mode: 'full' \| 'discovery' \| 'enforce', client_id?: string }` | `{ run_id: string, status: 'started' }` |
| `/api/pipeline/status` | GET | Check current run status | Query: `?run_id=xxx` | `PipelineRunSummary \| { status: 'running', progress: number }` |

### Pipeline → Platform (data delivery)

The pipeline does NOT call platform API routes. Instead, it writes to the file-based storage locations listed above. The platform reads these files on demand (SSR) or via polling (client-side refresh).

### Platform → Supabase (existing)

All existing platform data (users, campaigns, analytics, experiments) remains in Supabase. The brand intelligence pipeline does NOT read from or write to Supabase directly.

## File vs. Supabase Decision

| In Supabase (relational, multi-user) | In File Storage (pipeline-managed, versioned) |
|--------------------------------------|-----------------------------------------------|
| User accounts & auth | Brand profiles (versioned JSON) |
| Campaign data | Content intelligence |
| Analytics & attribution | Pipeline run logs |
| Billing & subscriptions | Health score history |
| Experiment engine state | CEO Board decision memos |

**Why file storage for the pipeline?** The Agent SDK orchestrator operates on the filesystem. Agents write JSON outputs to disk. Introducing Supabase writes into agent runs would add latency, error surface, and cost. The platform reads these files at render time.

**Future migration path:** When client count exceeds ~50, pipeline outputs should migrate to Supabase for query performance. The `shared/types/` interfaces remain the same — only the read/write layer changes.

## Import Enforcement

To prevent spaghetti dependencies, the following convention must be enforced in code review:

```
✅ ALLOWED:
import { BrandProfile, ContentIntelligence } from '@/shared/types';
import { BrandProfile } from '@/shared/types/brand-intelligence';

❌ PROHIBITED:
import { something } from '@/clients/cli_001/brand-profile/active';
import { orchestrator } from '@/synthex_orchestrator';
import { agentDef } from '@/subagents';
```

Recommended ESLint rule (add when pipeline code lands):

```js
// eslint.config.js — add to rules
'no-restricted-imports': ['error', {
  patterns: [
    { group: ['**/clients/**'], message: 'Import brand intelligence data through shared/types/ instead.' },
    { group: ['**/synthex_orchestrator*'], message: 'Pipeline internals are not accessible from the platform.' },
    { group: ['**/subagents*'], message: 'Pipeline internals are not accessible from the platform.' },
  ],
}],
```
