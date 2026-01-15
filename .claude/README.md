# Unite-Group AI Architecture

**Version:** 2.0.0
**Project:** NodeJS-Starter-V1 Hybrid Architecture
**Strategy:** Australian-First, Truth-First, SEO-Dominant

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Routing Logic](#routing-logic)
4. [Australian Context System](#australian-context-system)
5. [Truth Finder System](#truth-finder-system)
6. [SEO Intelligence](#seo-intelligence)
7. [Hook Lifecycle](#hook-lifecycle)
8. [File Structure](#file-structure)
9. [Quick Reference](#quick-reference)
10. [Development Workflow](#development-workflow)

---

## Overview

The Unite-Group AI Architecture is a hybrid system that preserves the strengths of NodeJS-Starter-V1 while adding comprehensive Australian-first context, truth verification, and SEO intelligence.

### Core Principles

1. **Australian-First**: en-AU defaults everywhere (language, dates, currency, regulations)
2. **Truth-First**: NO content publishes without verification (4-tier source hierarchy)
3. **SEO-Dominant**: Complete market takeover (Brisbane → Queensland → Australia → NZ → Global)
4. **Verification-First**: Independent verification, evidence-based, no self-attestation
5. **Design-Forward**: 2025-2026 aesthetic (Bento grids, glassmorphism, NO Lucide icons)

### Key Metrics

- **Agents**: 19 (8 full implementations, 11 stubs)
- **Skills**: 35+ (8 new, 12 migrated, 15+ refactored)
- **Hooks**: 10 (2 blocking: pre-publish, pre-deploy)
- **Data Files**: 3 (trusted sources, design tokens, verified claims)
- **Rules**: 5 path-specific auto-loading rules (383 lines preserved)
- **CLAUDE.md**: Reduced 70% (159 → 48 lines)

---

## Architecture Components

### 1. Agents (`.claude/agents/`)

Specialized agents handle specific domains. Each agent has:
- YAML frontmatter (name, type, role, priority, skills, hooks)
- Purpose and capabilities
- Integration points
- Example workflows

#### Priority Agents (Full Implementations)

**Orchestrator** (`orchestrator/agent.md`)
- **Role**: Master coordinator
- **Priority**: 1 (Critical)
- **Preserves**: 605 lines of orchestration logic from ORCHESTRATOR_PRIMER.md
- **Skills**: orchestration.skill.md, verification-first.skill.md
- **Patterns**: Plan→Parallelize→Integrate, Sequential with Feedback, Specialist Delegation

**Standards** (`standards/agent.md`)
- **Role**: Australian Context & Design Guardian
- **Priority**: 1 (Critical)
- **Auto-load**: true (fires on every response via pre-response.hook)
- **Skills**: australian-context.skill.md, design-system.skill.md
- **Enforces**: en-AU spelling, DD/MM/YYYY dates, AUD currency, 2025-2026 design, NO Lucide icons

**Verification** (`verification/agent.md`)
- **Role**: Independent Quality Gatekeeper
- **Priority**: 1 (Critical)
- **Blocking**: true (can block deployments)
- **Preserves**: VERIFICATION.md philosophy (Prove It Works, Honest Failure, No Assumptions)
- **Tiers**: Quick (30s), Standard (2-3min), Full (5-10min), Production (15-20min)

**Truth Finder** (`truth-finder/agent.md`)
- **Role**: Fact Verification & Source Validation
- **Priority**: 2 (High)
- **Blocking**: true (blocks content via pre-publish.hook if confidence <75%)
- **Data Source**: `.claude/data/trusted-sources.yaml`
- **Skills**: truth-finder.skill.md
- **System**: 4-tier source hierarchy, confidence scoring, publishing thresholds

**SEO Intelligence** (`seo-intelligence/agent.md`)
- **Role**: Search Dominance Strategy
- **Priority**: 2 (High)
- **Market Focus**: Australian (Brisbane primary)
- **Skills**: search-dominance.skill.md, blue-ocean.skill.md, geo-australian.skill.md
- **Strategy**: GEO optimization, Blue Ocean discovery, competitive gap analysis

**Spec Builder** (`spec-builder/agent.md`)
- **Role**: Requirements Gathering via 6-Phase Interview
- **Priority**: 3 (Standard)
- **Method**: Vision → Users → Technical → Design → Business → Implementation
- **Output**: spec.md file with complete requirements

**Env Wizard** (`env-wizard/agent.md`)
- **Role**: Environment Setup & API Configuration
- **Priority**: 3 (Standard)
- **Flow**: Detect → Guide → Test → Write → Verify
- **Services**: Supabase, Anthropic, Google, Vercel, DataForSEO, etc.

**Rank Tracker** (`rank-tracker/agent.md`)
- **Role**: 24/7 Ranking Monitoring & Alerts
- **Priority**: 3 (Standard)
- **Market**: Australian SERPs (Brisbane, Sydney, Melbourne)
- **Features**: Real-time tracking, SERP features, competitor positions, alerts

#### Stub Agents (Future Implementations)

- `frontend-specialist` - React/Next.js/Tailwind development
- `backend-specialist` - FastAPI/LangGraph/Agents development
- `database-specialist` - Supabase/Migrations/RLS
- `test-engineer` - E2E, unit, integration testing
- `deploy-guardian` - Deployment safety and rollback
- `docs-writer` - Documentation generation
- `code-reviewer` - Code quality and standards
- `refactor-specialist` - Code improvement and optimization
- `bug-hunter` - Issue investigation and resolution
- `performance-optimizer` - Speed and efficiency improvements
- `security-auditor` - Security scanning and hardening

### 2. Skills (`skills/`)

Reusable knowledge modules organized by category. All skills use `.skill.md` extension.

#### By Category

**Australian (2 skills)**
- `australian-context.skill.md` (Priority 1, auto-load)
  - en-AU spelling, dates, currency, phone, addresses
  - Australian regulations (Privacy Act 1988, WCAG 2.1 AA)
  - Default locations (Brisbane → Sydney → Melbourne)
- `geo-australian.skill.md` (Priority 2)
  - GEO optimization for Australian market
  - Australian keywords and locations

**Context (2 skills)**
- `orchestration.skill.md` (Priority 1)
  - Multi-agent coordination patterns
  - Context partitioning strategies
  - Token optimization
- `project-context.skill.md` (Priority 2)
  - NodeJS-Starter-V1 specific knowledge
  - Stack, migrations, conventions

**Design (3 skills)**
- `design-system.skill.md` (Priority 1, auto-load)
  - 2025-2026 aesthetic (Bento grids, glassmorphism)
  - Locked design tokens (`.claude/data/design-tokens.json`)
  - NO Lucide icons - AI-generated custom only
- `foundation-first.skill.md` (Priority 2)
  - 7-layer foundation (psychology → personas → journeys)
  - 8 missing states checklist
  - Australian cultural psychology
- `tailwind.skill.md` (Priority 3)
  - Tailwind v4 patterns
  - Custom utilities and plugins

**Verification (3 skills)**
- `verification-first.skill.md` (Priority 1)
  - 4 verification tiers
  - Evidence collection
  - Independent verification (no self-attestation)
- `truth-finder.skill.md` (Priority 2)
  - Claim extraction and classification
  - Source validation and confidence scoring
  - Citation generation
- `error-handling.skill.md` (Priority 3)
  - Australian-friendly error messages
  - Error recovery patterns

**Search Dominance (3 skills)**
- `search-dominance.skill.md` (Priority 2)
  - SEO takeover strategy (Brisbane → AU → NZ → Global)
  - Keyword strategy and competitive analysis
- `blue-ocean.skill.md` (Priority 2)
  - Opportunity discovery and scoring
  - Heat signature scanning
- `rank-monitoring.skill.md` (Priority 3)
  - Real-time ranking checks
  - Alert configuration

**Backend (3 skills)**
- `advanced-tool-use.skill.md` (Priority 2)
  - Context-efficient tool management (85% token savings)
  - Australian context tools (ABN validation)
- `langgraph.skill.md` (Priority 3)
  - LangGraph workflow patterns
  - Multi-agent coordination
- `fastapi.skill.md` (Priority 3)
  - FastAPI patterns with Australian context
  - Privacy Act 1988 compliance

**Frontend (2 skills)**
- `nextjs.skill.md` (Priority 3)
  - Next.js 15 patterns with 2025-2026 design
  - Australian context utilities
- `components.skill.md` (Priority 4)
  - Component patterns and best practices

**Database (2 skills)**
- `supabase.skill.md` (Priority 3)
  - Supabase patterns with Australian compliance
  - RLS, audit logging (7-year retention)
- `migrations.skill.md` (Priority 3)
  - Migration patterns with Australian fields
  - Phone, state, postcode, ABN columns

**Workflow (2 skills)**
- `feature-development.skill.md` (Priority 3)
  - 6-phase workflow with Australian context
  - TDD with Australian data
- `bug-fixing.skill.md` (Priority 3)
  - 7-phase workflow with Australian fixes
  - Date formatting bug patterns

#### Skill Loading Rules

1. **Auto-load** (Priority 1): Load on every response via `pre-response.hook`
   - australian-context.skill.md
   - design-system.skill.md
   - verification-first.skill.md

2. **On-demand** (Priority 2+): Load when agent dispatched or skill referenced
   - Orchestrator loads orchestration.skill.md
   - SEO tasks load search-dominance.skill.md, blue-ocean.skill.md
   - Backend tasks load langgraph.skill.md, fastapi.skill.md

3. **Dependencies**: Skills can require other skills via `requires:` in YAML frontmatter
   - post-skill-load.hook automatically loads dependencies

### 3. Hooks (`.claude/hooks/`)

Automatic triggers that fire at specific lifecycle events. 2 hooks are **BLOCKING** (can prevent actions).

#### Hook Lifecycle

```
User Request
    ↓
[pre-response.hook] ← Loads Australian context EVERY response
    ↓
Orchestrator Routing
    ↓
[pre-agent-dispatch.hook] ← Context partitioning before subagent spawn
    ↓
Agent Execution
    ↓
[post-code.hook] ← Type check, lint after code generation
    ↓
[post-verification.hook] ← Evidence collection after verification
    ↓
[pre-commit.hook] ← Verification check before git commit
    ↓
[pre-deploy.hook] ← E2E, Lighthouse, security (BLOCKING)
    ↓
[pre-publish.hook] ← Truth Finder verification (BLOCKING)
    ↓
[post-session.hook] ← Update PROGRESS.md at session end
```

#### Blocking Hooks

**pre-publish.hook.md** (BLOCKING)
- **Trigger**: Before publishing content (blog posts, marketing, video scripts)
- **Actions**:
  1. Invoke Truth Finder agent
  2. Check confidence score (require ≥75%)
  3. Generate citations
  4. Apply Australian context (final check)
- **On Failure**: BLOCK publication, generate detailed report, list unverified claims
- **Override**: Requires human approval

**pre-deploy.hook.md** (BLOCKING)
- **Trigger**: Before deployment to production
- **Actions**:
  1. Full E2E test suite (Playwright)
  2. Lighthouse audit (>90 all scores)
  3. Security scan (no exposed secrets, dependency vulnerabilities)
  4. Environment validation (all env vars set, API connections working)
  5. SEO verification (schema valid, meta tags, sitemap, robots.txt)
- **On Failure**: BLOCK deployment, generate failure report, suggest remediation
- **Evidence Required**: All checks must PASS with evidence

#### Non-Blocking Hooks

- **pre-response.hook**: Loads Australian context on EVERY response
- **post-code.hook**: Type check, lint after code generation (Tier A verification)
- **pre-commit.hook**: Verification check before git commit (Tier B verification)
- **post-skill-load.hook**: Loads dependent skills automatically
- **pre-agent-dispatch.hook**: Context partitioning before subagent spawn
- **post-verification.hook**: Evidence collection after verification
- **pre-seo-task.hook**: Loads Australian market context for SEO tasks
- **post-session.hook**: Updates PROGRESS.md at session end

### 4. Data Files (`.claude/data/`)

**trusted-sources.yaml** (70 lines)
- **Purpose**: 4-tier source hierarchy for Truth Finder
- **Tiers**:
  - Tier 1 Primary (95-100%): .gov.au, legislation.gov.au, abs.gov.au, standards.org.au
  - Tier 2 Authoritative (80-94%): .edu.au, insurancecouncil.com.au, iicrc.org
  - Tier 3 Reputable (60-79%): ted.com, industry bodies
  - Tier 4 Supporting (40-59%): abc.net.au, wikipedia.org (verify elsewhere)
- **Never Use**: Blogspot, Medium (unless verified expert)
- **Confidence Modifiers**: +10 per additional source (max +30), +15 primary source, -50 unverifiable

**design-tokens.json** (180 lines)
- **Purpose**: Locked design system for 2025-2026 aesthetic
- **Contents**:
  - Colors: Primary #0D9488 (teal), semantic colors
  - Typography: Inter (sans), Cal Sans (heading), JetBrains Mono (mono)
  - Spacing: 8px base, 0.25rem unit
  - Border radius: 6px sm → 24px 2xl
  - Shadows: Soft colored (NEVER pure black) - rgba(13, 148, 136, 0.1)
  - Iconography: NO Lucide (deprecated), AI-generated custom only
  - Glassmorphism: rgba(255, 255, 255, 0.7), backdrop-blur 10px
  - Micro-interactions: hover-scale 1.02, 150ms transitions

**verified-claims.json** (10 lines)
- **Purpose**: Cache for verified claims to avoid re-verification
- **Structure**: `{ "version": "1.0.0", "claims": [] }`
- **Updated By**: Truth Finder agent after verification

### 5. Rules (`.claude/rules/`)

Path-specific auto-loading rules (preserved from original architecture):
- `development/workflow.md` - Development commands and conventions
- `frontend/nextjs.md` - Next.js 15 patterns and anti-patterns
- `backend/fastapi.md` - FastAPI patterns
- `database/supabase.md` - Supabase and RLS patterns
- `agents/langgraph.md` - LangGraph workflow patterns

**Total**: 5 rules, 383 lines preserved

---

## Routing Logic

### Entry Point: CLAUDE.md (48 lines)

The lean router at the root dispatches to specialized agents based on task type:

```
User Request
    ↓
CLAUDE.md (Quick Routing)
    ↓
    ├─ Frontend? → .claude/agents/frontend-specialist/
    ├─ Backend? → .claude/agents/backend-specialist/
    ├─ Database? → .claude/agents/database-specialist/
    ├─ SEO? → .claude/agents/seo-intelligence/
    └─ Content? → .claude/agents/truth-finder/
    ↓
Orchestrator Agent (Master Coordinator)
    ↓
    ├─ Load relevant skills (Priority 1 auto-load)
    ├─ Partition context (provide only relevant info)
    ├─ Spawn subagents (parallel when possible)
    └─ Integrate results (merge outputs)
    ↓
Verification Agent (Independent Check)
    ↓
Output to User
```

### Orchestrator Patterns

**Pattern 1: Plan→Parallelize→Integrate**
```python
# For independent subtasks (no dependencies)
plan = create_execution_plan(task)
subagents = [spawn_subagent(subtask) for subtask in plan.subtasks]
results = await asyncio.gather(*[agent.execute() for agent in subagents])
integrated = merge_results(results)
verification = await independent_verify(integrated)
```

**Pattern 2: Sequential with Feedback**
```python
# For dependent subtasks (one feeds into next)
for subtask in subtasks:
    result = await execute_subtask(subtask)
    next_subtask.context = result  # Feed result to next subtask
    verification = await verify_intermediate(result)
```

**Pattern 3: Specialist Delegation**
```python
# For specialized domains (SEO, Truth Finder, etc.)
specialist = select_specialist(task.domain)
specialist.load_skills(task.required_skills)
result = await specialist.execute(task)
verification = await independent_verify(result)
```

---

## Australian Context System

### Core Defaults (en-AU)

**Language**: Australian English ALWAYS (unless explicit override)
- Spelling: colour, organisation, licence, metre, centre, analyse, prioritise
- Terminology: mobile (not cell), suburb (not neighborhood), footpath (not sidewalk)
- Voice: Professional but approachable, tradie-friendly

**Date & Time**
- Format: DD/MM/YYYY (e.g., 08/01/2025)
- Time: 12-hour with am/pm (e.g., 2:30 pm)
- Timezones: AEST/AEDT (Sydney), ACST/ACDT (Adelaide), AWST (Perth), AEST (Brisbane - no DST)

**Currency**
- Currency: AUD ($)
- Format: $1,234.56 (comma thousands separator, 2 decimal places)
- GST: 10% (inclusive pricing required by law)
- Display: $2,500.00 + $250.00 GST = $2,750.00 Total

**Phone Numbers**
- Mobile: 04XX XXX XXX (e.g., 0412 345 678)
- Landline: (0X) XXXX XXXX (e.g., (02) 1234 5678)
- Validation: /^04\d{8}$/ for mobile, /^0[2-8]\d{8}$/ for landline

**Addresses**
- Format: Street, Suburb STATE POSTCODE
- Example: 42 Queen Street, Brisbane City QLD 4000
- States: QLD, NSW, VIC, SA, WA, TAS, NT, ACT
- Postcodes: 4-digit (0200-9999)

### Australian Regulations

**Privacy Act 1988**
- Data collection: Consent required, purpose limitation
- Data retention: 7 years for financial records
- Data breach: Notify OAIC within 30 days if serious breach
- Cross-border: EU adequacy decision (GDPR compliant)

**WCAG 2.1 AA**
- Accessibility: Level AA compliance mandatory for government sites
- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Keyboard navigation: All functionality accessible via keyboard
- Screen reader: ARIA labels and semantic HTML

**Australian Standards**
- NCC (National Construction Code): Building standards
- AS/NZS 3666: Air handling and water systems
- AS 4654: Waterproofing standards
- WHS Act 2011: Work Health and Safety
- SafeWork Australia: Workplace safety guidelines

**Insurance & Restoration**
- ICA (Insurance Council of Australia): Industry body
- AFCA (Australian Financial Complaints Authority): Dispute resolution
- General Insurance Code: Consumer protections
- IICRC (Institute of Inspection, Cleaning and Restoration Certification): Industry standards

### Australian Context Utilities

Complete utility library in `apps/web/src/lib/australian-context.ts` (320 lines):

**Date Functions**
- `formatDateAU(date)` → "08/01/2025"
- `formatDateTimeAU(date)` → "08/01/2025, 2:30 pm"

**Currency Functions**
- `formatCurrencyAUD(amount)` → "$2,500.00"
- `calculateGST(amount)` → amount × 0.10
- `calculateTotalWithGST(amount)` → amount + GST

**Phone Functions**
- `formatPhoneAU(phone)` → "0412 345 678" or "(02) 1234 5678"
- `isValidAustralianMobile(phone)` → boolean
- `isValidAustralianLandline(phone)` → boolean
- `isValidAustralianPhone(phone)` → boolean

**Address Functions**
- `formatPostcode(code)` → "4000" (4 digits)
- `isValidPostcode(code)` → boolean
- `getStateName(code)` → "Queensland"
- `getAustralianTimezone(state)` → "Australia/Brisbane"
- `formatAustralianAddress({street, suburb, state, postcode})` → "42 Queen Street, Brisbane City QLD 4000"

**Business Functions**
- `formatABN(abn)` → "12 345 678 901"
- `validateABN(abn)` → boolean (with checksum validation)
- `formatACN(acn)` → "123 456 789"
- `validateACN(acn)` → boolean

---

## Truth Finder System

### Core Principle

**NO CLAIM PUBLISHES WITHOUT VERIFICATION**

The Truth Finder system ensures all published content is factually accurate, properly sourced, and confidence-scored.

### 4-Tier Source Hierarchy

**Tier 1: Primary Sources (95-100% confidence)**
- Australian Government: *.gov.au (100%), legislation.gov.au (100%), abs.gov.au (100%)
- Standards: standards.org.au (100%), iicrc.org (95%)
- Courts: federalcourt.gov.au (100%), austlii.edu.au (95%)
- **Prioritize**: Australian sources over international

**Tier 2: Authoritative Sources (80-94% confidence)**
- Industry Bodies: insurancecouncil.com.au (85%), restorationindustry.org (85%)
- Universities: *.edu.au (80%)
- **Note**: Verify speaker credentials for expert content

**Tier 3: Reputable Sources (60-79% confidence)**
- Educational: ted.com (70%, verify speaker credentials)
- Industry Publications: Trade journals, professional magazines
- **Note**: Cross-reference with Tier 1/2 sources

**Tier 4: Supporting Sources (40-59% confidence)**
- News: abc.net.au (60%), major news outlets
- Wikipedia: wikipedia.org (50%, use for leads only, verify elsewhere)
- **Note**: NEVER use as primary source, always verify

**Never Use (0% confidence)**
- Blogspot: *.blogspot.com
- Medium: medium.com (unless verified expert author)
- Unverified blogs, forums, social media

### Confidence Scoring

**Formula**: `Base Score + Modifiers`

**Base Score**: Source tier confidence (40-100%)

**Modifiers**:
- `+10` per additional source (max +30)
- `+15` primary source (government, court, standard)
- `+10` recent data (<1 year)
- `+15` peer-reviewed publication
- `+10` verified expert author
- `-20` single source only
- `-15` outdated data (>3 years)
- `-25` known bias
- `-15` contradicting sources found
- `-50` unverifiable claim

**Example**:
```
Claim: "GST in Australia is 10%"
Source: legislation.gov.au (Tier 1, 100%)
Modifiers: +15 (primary source), +10 (recent data)
Final Confidence: 100% + 15% + 10% = 125% (capped at 100%)
Status: VERIFIED ✅
```

### Publishing Thresholds

**95-100% (Verified)**
- Publish freely
- Citation: Optional for common knowledge
- Label: None required

**80-94% (High Confidence)**
- Publish with citation
- Citation: Required, journalistic style
- Label: None required

**60-79% (Moderate Confidence)**
- Publish with disclaimer
- Citation: Required, academic style
- Label: "Based on industry research" or "According to available data"

**40-59% (Low Confidence)**
- Publish with strong disclaimer
- Citation: Required, full academic
- Label: "Estimates suggest" or "Industry sources indicate"

**<40% (Unverified)**
- **BLOCK PUBLICATION** ❌
- Require human approval to override
- Generate detailed report with unverified claims

### Integration with Hooks

**pre-publish.hook.md** (BLOCKING)
1. Extracts all claims from content
2. Classifies risk level (CRITICAL, HIGH, MEDIUM, LOW)
3. Searches for sources in trusted-sources.yaml hierarchy
4. Calculates confidence score with modifiers
5. Checks against publishing thresholds
6. Generates citations if confidence ≥60%
7. **BLOCKS** publication if confidence <40% or CRITICAL claims <95%
8. Generates detailed report for human review

---

## SEO Intelligence

### Mission

**Complete search market dominance** - The ONLY acceptable outcome is TAKEOVER.

### Market Focus

**Primary**: Brisbane, Queensland
**Secondary**: Sydney (NSW), Melbourne (VIC)
**Expansion**: Queensland → Eastern Seaboard → Australia-wide → New Zealand → Global

### GEO (Generative Engine Optimization)

**Content Format**:
- Question-answer format: "What is water damage restoration?" → Clear definition
- Definitions first: Lead with concise explanations
- Comparison tables: "Water damage vs flood damage" → Structured data
- Step-by-step: "How to prevent water damage" → Numbered lists
- Statistics: "Water damage costs Australians $X" → Cited data

**Schema Markup**:
- FAQPage: For common questions
- HowTo: For process guides
- Article: For blog posts (with Australian author, datePublished in ISO 8601)
- LocalBusiness: For business pages (Australian address/phone format)

**E-E-A-T Signals**:
- **Experience**: IICRC certification, years in business, project portfolio
- **Expertise**: Industry credentials, Standards Australia compliance
- **Authoritativeness**: Industry body memberships (ICA, AFCA)
- **Trustworthiness**: Australian certifications, customer reviews, Privacy Act compliance

### Blue Ocean Discovery

**Opportunity Scoring**:
```
Formula: (Volume × Growth × Gap) / Competition

Thresholds:
- 80+ → IMMEDIATE ACTION (create content today)
- 60-79 → HIGH PRIORITY (queue for this week)
- 40-59 → QUEUE (add to backlog)
- <40 → MONITOR (revisit quarterly)
```

---

## Hook Lifecycle

### Complete Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User Request                                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ [pre-response.hook]                                              │
│ - Load australian-context.skill.md (EVERY response)             │
│ - Load design-system.skill.md (EVERY response)                  │
│ - Load verification-first.skill.md (EVERY response)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Orchestrator Agent                                               │
│ - Create execution plan                                         │
│ - Select specialist agents                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ [pre-agent-dispatch.hook]                                        │
│ - Provide only relevant context                                 │
│ - Pre-load required skills                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Specialist Agent Execution                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ [post-code.hook] (IF code generated)                            │
│ - Type check, lint, format                                      │
│ Status: Tier A Verification (Quick 30s)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ [post-verification.hook]                                         │
│ - Collect evidence                                              │
│ - Update PROGRESS.md                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ [pre-deploy.hook] (IF deployment) ⚠️ BLOCKING                   │
│ - E2E tests, Lighthouse >90, security scan                      │
│ On Failure: BLOCK DEPLOYMENT ❌                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ [pre-publish.hook] (IF content) ⚠️ BLOCKING                     │
│ - Truth Finder verification (confidence ≥75%)                   │
│ On Failure: BLOCK PUBLICATION ❌                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
NodeJS-Starter-V1/
├── CLAUDE.md (48 lines) - Lean router
├── PROGRESS.md - Implementation dashboard
├── .claude/
│   ├── README.md (THIS FILE)
│   ├── agents/ (19 agents)
│   │   ├── orchestrator/agent.md
│   │   ├── standards/agent.md
│   │   ├── verification/agent.md
│   │   ├── truth-finder/agent.md
│   │   ├── seo-intelligence/agent.md
│   │   └── [14 more...]
│   ├── hooks/ (10 hooks)
│   │   ├── pre-response.hook.md
│   │   ├── pre-publish.hook.md ⚠️ BLOCKING
│   │   ├── pre-deploy.hook.md ⚠️ BLOCKING
│   │   └── [7 more...]
│   ├── data/ (3 files)
│   │   ├── trusted-sources.yaml
│   │   ├── design-tokens.json
│   │   └── verified-claims.json
│   ├── rules/ (5 rules)
│   │   ├── development/workflow.md
│   │   ├── frontend/nextjs.md
│   │   ├── backend/fastapi.md
│   │   ├── database/supabase.md
│   │   └── agents/langgraph.md
│   └── commands/ (5 commands)
├── skills/ (35+ skills)
│   ├── INDEX.md
│   ├── australian/
│   │   ├── australian-context.skill.md
│   │   └── geo-australian.skill.md
│   ├── verification/
│   │   ├── verification-first.skill.md
│   │   ├── truth-finder.skill.md
│   │   └── error-handling.skill.md
│   └── [6 more categories...]
└── apps/
    ├── web/ (Next.js 15)
    │   └── src/
    │       ├── components/JobCard.tsx
    │       ├── lib/australian-context.ts
    │       └── styles/design-system.css
    └── backend/ (FastAPI + LangGraph)
```

---

## Quick Reference

### Common Commands

```bash
# Development
pnpm dev                          # All services
pnpm dev --filter=web             # Frontend only

# Testing
pnpm turbo run test               # All tests

# Quality
pnpm turbo run type-check lint    # All checks
```

### Australian Context

**Date**: DD/MM/YYYY (08/01/2025)
**Currency**: $1,234.56 + GST (10%) = $1,357.96
**Phone**: 0412 345 678 (mobile)
**Address**: 42 Queen Street, Brisbane City QLD 4000
**Spelling**: colour, organisation, licence

### Truth Finder

**Tier 1**: .gov.au (100%)
**Tier 2**: .edu.au (80%)
**Tier 3**: Industry (60-79%)
**Tier 4**: News (40-59%)

**Thresholds**:
- 95%+ → Publish
- <40% → BLOCK ❌

### Design System

**Layout**: Bento grid
**Surface**: Glassmorphism
**Primary**: #0D9488 (teal)
**Icons**: NO Lucide - AI-generated custom only
**Shadows**: Soft colored (NEVER pure black)

---

## Development Workflow

### Feature Development

1. **Requirements** (Spec Builder) → spec.md
2. **Design** (Foundation-First) → 7-layer foundation
3. **Implementation** (Specialist Agents) → Code
4. **Verification** (post-code, pre-commit hooks)
5. **Deployment** (pre-deploy hook - BLOCKING)
6. **Publishing** (pre-publish hook - BLOCKING)

### SEO Task

1. **Load Context** (pre-seo-task.hook)
2. **Execute** (SEO Intelligence Agent)
3. **Monitor** (Rank Tracker Agent)

---

## Troubleshooting

### Skills not loading
- Check `.skill.md` extension
- Verify YAML frontmatter valid
- Check priority (1 = auto-load)

### Hook not firing
- Check `.hook.md` extension
- Verify trigger condition
- Check blocking flag

### Truth Finder blocking
- Review trusted-sources.yaml
- Check confidence score
- Manually verify claim

### Australian context missing
- Verify pre-response.hook firing
- Check australian-context.skill.md priority
- Check utility imports

---

🦘 **Australian-first. Truth-first. SEO-dominant. Design-forward.**

*Complete Unite-Group AI Architecture documentation.*
