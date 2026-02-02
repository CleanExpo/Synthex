# SYNTHEX SYSTEM ARCHITECTURE OVERVIEW
## Comprehensive Technical Documentation for AI Marketing Agency Platform

**Version**: 3.0  
**Last Updated**: 2026-02-02  
**Status**: Production Development Phase

---

## 1. EXECUTIVE SUMMARY

Synthex is a fully autonomous AI-powered marketing agency platform designed specifically for Small and Medium Businesses (SMBs). The platform replaces traditional $10,000+/month marketing agencies with an AI-driven system that operates 24/7 across all industries.

### Core Value Proposition
- **Complete Agency Replacement**: Strategy → Content → Scheduling → Analytics
- **Industry Specialization**: 50+ SMB verticals with specialized AI personas
- **Autonomous Operation**: Self-managing campaigns with minimal human intervention
- **Cost Efficiency**: $297/month vs $120,000/year traditional agency

---

## 2. SYSTEM ARCHITECTURE

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web App   │  │  Mobile App │  │  API Client │  │  Dashboard  │        │
│  │  (Next.js)  │  │  (React Nat)│  │  (REST/WS)  │  │  (Admin)    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼───────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      CDN / Edge         │
                    │    (Vercel + Upstash)   │
                    └────────────┬────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Next.js API Routes (/app/api/)                                         ││
│  │  ├── Rate Limiting (Upstash Redis)                                      ││
│  │  ├── Authentication (Supabase Auth)                                     ││
│  │  ├── Request Validation (Zod)                                           ││
│  │  └── Response Caching                                                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                      ORCHESTRATION LAYER (NEW)                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  AGENT ORCHESTRATOR                                                     ││
│  │  ├── Task Queue Manager (BullMQ)                                        ││
│  │  ├── Agent Assignment Engine                                            ││
│  │  ├── Context Sharing Bus                                                ││
│  │  └── Workflow State Machine                                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬─────────────┐│
│  │   STRATEGY   │   CONTENT    │  CAMPAIGN    │  ANALYTICS   │  COMPLIANCE ││
│  │    AGENT     │    AGENT     │   AGENT      │    AGENT     │    AGENT    ││
│  └──────────────┴──────────────┴──────────────┴──────────────┴─────────────┘│
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                        SERVICE LAYER                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  AI Service │  │  Social     │  │  Email      │  │  Analytics  │        │
│  │  (OpenRouter│  │  Integration│  │  Service    │  │  Service    │        │
│  │  Anthropic) │  │  (OAuth2)   │  │  (SendGrid) │  │  (Internal) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Content    │  │  Scheduling │  │  A/B Test   │  │  Reporting  │        │
│  │  Generator  │  │  Engine     │  │  Engine     │  │  Engine     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                        DATA LAYER                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  PRIMARY DATABASE (PostgreSQL + Prisma)                                 ││
│  │  ├── User/Auth Tables                                                   ││
│  │  ├── Campaign/Content Tables                                            ││
│  │  ├── Industry Specialization Tables                                     ││
│  │  ├── Agent State Tables                                                 ││
│  │  └── Analytics/Audit Tables                                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  CACHE LAYER (Redis/Upstash)                                            ││
│  │  ├── Session Store                                                      ││
│  │  ├── API Response Cache                                                 ││
│  │  ├── Agent Context Cache                                                ││
│  │  └── Rate Limiting                                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  OBJECT STORAGE (Cloudinary/S3)                                         │
│  │  ├── User Assets                                                        ││
│  │  ├── Generated Content                                                  ││
│  │  └── Media Library                                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14, React 18, TypeScript | SSR, SSG, API routes |
| **Styling** | Tailwind CSS, shadcn/ui | Component library, theming |
| **State Management** | Zustand, TanStack Query | Client state, server state |
| **Authentication** | Supabase Auth | JWT, OAuth, MFA |
| **Database** | PostgreSQL (Supabase) | Primary data store |
| **ORM** | Prisma 6.14 | Type-safe database access |
| **Cache** | Upstash Redis | Session, rate limiting, cache |
| **AI/ML** | OpenRouter, Anthropic, Google | Multi-model AI orchestration |
| **Queue** | BullMQ | Background job processing |
| **WebSocket** | Socket.io | Real-time updates |
| **Monitoring** | Sentry, LogRocket | Error tracking, session replay |
| **Deployment** | Vercel | Edge network, serverless |

---

## 3. CORE MODULES

### 3.1 Industry Specialization System

```typescript
// Industry Taxonomy (50+ SMB Verticals)
interface IndustryClassification {
  code: string;           // NAICS/SIC code
  name: string;           // Display name
  category: string;       // High-level category
  subIndustries: string[];
  kpis: IndustryKPI[];
  contentTemplates: Template[];
  aiPersona: AIPersona;
}

// Industry Categories
const INDUSTRY_CATEGORIES = {
  RETAIL: ['44-45', 'Clothing', 'Electronics', 'Home & Garden', 'Auto Parts'],
  PROFESSIONAL_SERVICES: ['54', 'Legal', 'Accounting', 'Consulting', 'Marketing'],
  HEALTHCARE: ['62', 'Dental', 'Medical', 'Mental Health', 'Chiropractic'],
  FOOD_SERVICE: ['72', 'Restaurants', 'Catering', 'Food Trucks', 'Bakeries'],
  REAL_ESTATE: ['53', 'Residential', 'Commercial', 'Property Management'],
  CONSTRUCTION: ['23', 'Residential', 'Commercial', 'Renovation', 'Landscaping'],
  // ... 40+ more categories
};
```

### 3.2 Agent Orchestration System

```typescript
// Agent Orchestrator Core
interface AgentOrchestrator {
  // Task Management
  enqueueTask(task: AgentTask): Promise<TaskId>;
  assignAgent(taskId: TaskId, agentType: AgentType): Promise<AgentId>;
  monitorProgress(taskId: TaskId): Observable<TaskStatus>;
  
  // Context Sharing
  shareContext(from: AgentId, to: AgentId, context: SharedContext): void;
  getSharedMemory(campaignId: string): CampaignMemory;
  
  // Workflow Control
  startWorkflow(workflow: WorkflowDefinition): Promise<WorkflowId>;
  pauseWorkflow(workflowId: WorkflowId): void;
  resumeWorkflow(workflowId: WorkflowId): void;
}

// Agent Types
enum AgentType {
  STRATEGY_ANALYST = 'strategy_analyst',
  CONTENT_CREATOR = 'content_creator',
  CAMPAIGN_MANAGER = 'campaign_manager',
  ANALYTICS_EXPERT = 'analytics_expert',
  GROWTH_HACKER = 'growth_hacker',
  COMPLIANCE_OFFICER = 'compliance_officer',
}
```

### 3.3 Autonomous Workflow Engine

```typescript
// Workflow Definition
interface WorkflowDefinition {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  onComplete?: WorkflowAction;
  onError?: WorkflowAction;
}

// Trigger Types
interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'manual' | 'metric_threshold';
  config: TriggerConfig;
}

// Workflow Step
interface WorkflowStep {
  id: string;
  name: string;
  agent: AgentType;
  action: string;
  inputs: Record<string, any>;
  outputs: string[];
  conditions?: StepCondition[];
  retryPolicy?: RetryPolicy;
}
```

---

## 4. DATABASE SCHEMA

### 4.1 Core Tables

```prisma
// User & Authentication
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  password        String?
  name            String?
  avatar          String?
  emailVerified   Boolean   @default(false)
  authProvider    String    @default("local")
  googleId        String?   @unique
  
  // Relations
  organization    Organization? @relation(fields: [organizationId], references: [id])
  organizationId  String?
  campaigns       Campaign[]
  industryProfile IndustryProfile?
  agentConfigs    AgentConfig[]
  apiKeys         ApiKey[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Industry Specialization
model IndustryProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Industry Classification
  primaryIndustry   String   // NAICS code
  subIndustry       String?
  businessType      String   // 'b2b', 'b2c', 'hybrid'
  businessSize      String   // 'solo', 'small', 'medium', 'large'
  
  // Business Details
  companyName       String
  description       String?
  targetAudience    Json?    // Demographics, psychographics
  competitors       String[]
  
  // AI Configuration
  brandVoice        Json?    // Tone, style guidelines
  contentPreferences Json?   // Preferred formats, topics
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Agent Configuration
model AgentConfig {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  agentType   String   // Enum: strategy, content, campaign, etc.
  isActive    Boolean  @default(true)
  autonomyLevel String @default("assisted") // 'manual', 'assisted', 'autonomous'
  
  // Agent-specific settings
  settings    Json?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([userId, agentType])
}

// Campaign & Content
model Campaign {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("draft") // draft, active, paused, completed
  
  // Relations
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  posts       Post[]
  workflows   Workflow[]
  
  // Campaign Settings
  goals       Json?    // KPIs, objectives
  schedule    Json?    // Posting schedule
  platforms   String[] // Target platforms
  
  // AI-Generated Data
  strategy    Json?    // AI strategy document
  analysis    Json?    // Performance analysis
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Workflow State
model Workflow {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  name        String
  status      String   @default("pending") // pending, running, paused, completed, error
  
  // Execution State
  currentStep String?
  progress    Float    @default(0)
  state       Json?    // Serialized workflow state
  
  // Logs
  logs        WorkflowLog[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model WorkflowLog {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  
  step        String
  agent       String?
  action      String
  status      String   // success, error, warning
  message     String
  metadata    Json?
  
  createdAt   DateTime @default(now())
}
```

---

## 5. API ARCHITECTURE

### 5.1 Endpoint Structure

```
/api/v1/
├── /auth                    # Authentication
│   ├── POST /login
│   ├── POST /register
│   ├── POST /logout
│   ├── POST /refresh
│   └── POST /reset-password
│
├── /onboarding              # Onboarding Flow
│   ├── GET /status
│   ├── POST /industry       # Industry selection
│   ├── POST /profile        # Business profile
│   ├── POST /goals          # Marketing goals
│   └── POST /complete
│
├── /industries              # Industry Data
│   ├── GET /                # List all industries
│   ├── GET /:code           # Industry details
│   ├── GET /:code/templates # Industry templates
│   └── GET /:code/kpis      # Industry KPIs
│
├── /agents                  # Agent Management
│   ├── GET /                # List user agents
│   ├── GET /:id/status      # Agent status
│   ├── POST /:id/activate   # Activate agent
│   ├── POST /:id/deactivate
│   └── POST /:id/configure
│
├── /workflows               # Workflow Engine
│   ├── GET /                # List workflows
│   ├── POST /               # Create workflow
│   ├── GET /:id             # Workflow details
│   ├── POST /:id/start
│   ├── POST /:id/pause
│   ├── POST /:id/resume
│   └── DELETE /:id
│
├── /campaigns               # Campaign Management
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   ├── PUT /:id
│   ├── DELETE /:id
│   └── POST /:id/generate   # AI generate content
│
├── /content                 # Content Management
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   ├── PUT /:id
│   ├── DELETE /:id
│   └── POST /:id/variations
│
├── /analytics               # Analytics & Reporting
│   ├── GET /dashboard
│   ├── GET /campaigns/:id
│   ├── GET /engagement
│   └── GET /export
│
├── /integrations            # Third-party Integrations
│   ├── GET /                # List connected platforms
│   ├── POST /:platform/connect
│   ├── DELETE /:platform/disconnect
│   └── GET /:platform/status
│
└── /webhooks                # Webhook Handlers
    ├── POST /stripe
    ├── POST /social/:platform
    └── POST /email
```

---

## 6. AGENT SYSTEM

### 6.1 Agent Capabilities

| Agent | Primary Role | Capabilities | Autonomy Level |
|-------|-------------|--------------|----------------|
| **Strategy Analyst** | Campaign Planning | Market research, competitor analysis, goal setting, KPI definition | High |
| **Content Creator** | Content Generation | Writing, visual design, video scripts, hashtag research | High |
| **Campaign Manager** | Execution | Scheduling, posting, A/B testing, optimization | Medium |
| **Analytics Expert** | Performance Analysis | Data analysis, reporting, insight generation | High |
| **Growth Hacker** | Audience Growth | Engagement tactics, follower growth, viral strategies | Medium |
| **Compliance Officer** | Quality Assurance | Platform guidelines, brand safety, content review | Low |

### 6.2 Agent Orchestration Flow

```
Campaign Request
      │
      ▼
┌─────────────────┐
│  ORCHESTRATOR   │◄──── Monitors all agents
│   (Conductor)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Strategy│ │Content │
│ Analyst│ │Creator │
└────┬───┘ └───┬────┘
     │         │
     └────┬────┘
          │
          ▼
   ┌─────────────┐
   │   Campaign  │
   │   Manager   │
   └──────┬──────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
┌────────┐ ┌────────┐
│Analytics│ │ Growth │
│ Expert │ │ Hacker │
└────────┘ └────────┘
```

---

## 7. SECURITY ARCHITECTURE

### 7.1 Authentication Flow

```
User Login
    │
    ▼
┌─────────────────┐
│ Supabase Auth   │
│ (OAuth/JWT)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Middleware      │
│ Validation      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Session│ │ API    │
│ Cookie │ │ Token  │
└────────┘ └────────┘
```

### 7.2 Security Measures

- **Rate Limiting**: 100 req/min per IP, 1000 req/min per user
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: Origin validation for mutations
- **Encryption**: AES-256 for sensitive data at rest

---

## 8. DEPLOYMENT ARCHITECTURE

### 8.1 Infrastructure

```
┌─────────────────────────────────────────┐
│           VERCEL EDGE                   │
│  ┌─────────────────────────────────┐   │
│  │  Next.js Application            │   │
│  │  - Serverless Functions         │   │
│  │  - Edge Middleware              │   │
│  │  - Static Assets                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│Supabase│  │Upstash   │  │Cloudinary│
│(Postgre)│  │(Redis)   │  │(Assets)  │
└────────┘  └──────────┘  └──────────┘
```

### 8.2 Environment Configuration

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Authentication
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# AI Providers
OPENROUTER_API_KEY="..."
ANTHROPIC_API_KEY="..."
GOOGLE_AI_API_KEY="..."

# Cache & Queue
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Storage
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Monitoring
SENTRY_DSN="..."
NEXT_PUBLIC_SENTRY_DSN="..."
```

---

## 9. MONITORING & OBSERVABILITY

### 9.1 Metrics

| Category | Metric | Alert Threshold |
|----------|--------|-----------------|
| **Performance** | API Response Time | > 500ms |
| **Performance** | Page Load Time | > 3s |
| **Reliability** | Error Rate | > 1% |
| **Reliability** | Uptime | < 99.9% |
| **Business** | Active Campaigns | Anomaly detection |
| **Business** | AI Generation Success | < 95% |

### 9.2 Logging

```typescript
// Structured Logging Format
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  action: string;
  userId?: string;
  campaignId?: string;
  agentId?: string;
  metadata: Record<string, any>;
  error?: ErrorDetails;
}
```

---

## 10. DEVELOPMENT GUIDELINES

### 10.1 Code Organization

```
/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── onboarding/        # Onboarding flow
│   └── ...
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── agents/           # Agent UI components
│   └── ...
├── lib/                   # Utilities & services
│   ├── ai/               # AI providers
│   ├── agents/           # Agent orchestration
│   ├── workflows/        # Workflow engine
│   └── ...
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript definitions
├── prisma/                # Database schema
└── docs/                  # Documentation
```

### 10.2 Naming Conventions

- **Files**: PascalCase for components, camelCase for utilities
- **Components**: PascalCase (e.g., `AgentDashboard`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAgent`)
- **API Routes**: kebab-case (e.g., `agent-config.ts`)
- **Database**: snake_case (e.g., `agent_config`)

---

## 11. TESTING STRATEGY

### 11.1 Test Pyramid

```
       /\
      /  \
     / E2E\        (5%)  - Critical user journeys
    /────────\        
   /Integration\  (15%)  - API, service integration
  /──────────────\
 /    Unit Tests   \ (80%) - Components, utilities
/────────────────────\
```

### 11.2 Test Categories

| Type | Tools | Coverage Target |
|------|-------|-----------------|
| Unit | Jest, React Testing Library | 80% |
| Integration | Jest, Supertest | 60% |
| E2E | Playwright | Critical paths |
| Visual | Storybook, Chromatic | All components |
| Performance | Lighthouse CI | > 90 score |

---

## 12. ROADMAP

### Phase 1: Foundation (Current)
- ✅ Core platform infrastructure
- ✅ Authentication & authorization
- ✅ Basic AI integration
- 🔄 Industry specialization system

### Phase 2: Intelligence (Next)
- 🔄 Agent orchestration layer
- 🔄 Autonomous workflow engine
- 🔄 Industry-specific AI personas
- ⏳ Advanced analytics

### Phase 3: Scale (Future)
- ⏳ Multi-tenant architecture
- ⏳ White-label capabilities
- ⏳ Advanced compliance automation
- ⏳ Enterprise features

---

**Document Owner**: Technical Architecture Team  
**Review Cycle**: Monthly  
**Next Review**: 2026-03-02
