---
name: skill-manager
description: >-
  Analyze any project's skill ecosystem, identify missing capabilities, suggest
  improvements, and generate new skills on demand. Use this skill whenever the user
  mentions skills, capabilities, gaps, missing features, skill audit, skill health,
  or wants to add new agent capabilities to their project. Also trigger when the user
  says "scan my project", "what skills am I missing", "generate a skill for X",
  "skill catalog", or "skill health check". This is a meta-skill that manages all
  other skills — use it aggressively whenever skill management is implied.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: meta-skill
  triggers:
    - skills
    - capabilities
    - gaps
    - missing features
    - skill audit
    - skill health
    - scan my project
    - what skills am I missing
    - generate a skill
    - skill catalog
    - skill health check
---

# Skill Manager

## Purpose

A project-agnostic skill management system that analyzes any agent project,
identifies capability gaps, suggests improvements, and generates properly structured
skills on demand. Works across any project that uses file-based skill directories.

## When to Use

Activate this skill when:
- User mentions skills, capabilities, or gaps
- User asks "scan my project" or "what skills do I have?"
- User requests "generate a skill for X"
- User wants a skill catalog or health check
- Skill ecosystem needs auditing or strengthening
- New agent capabilities need to be added

## When NOT to Use This Skill

- When the user needs to execute an existing skill (use that skill directly)
- When the task is pure code implementation with no skill management aspect
- When the user asks about a specific skill's content (just read it)
- Instead use: The specific skill referenced, or code-review for code quality

## Quick Start

When invoked, determine which mode the user needs:

| User Says | Mode | Action |
|-----------|------|--------|
| "Scan my project" / "What skills do I have?" | **Analyze** | Full project scan + gap analysis |
| "What am I missing?" / "Suggest skills" | **Suggest** | Gap analysis + ranked recommendations |
| "Generate a skill for X" / "Create a skill" | **Generate** | Create a complete skill package |
| "Show me available skills" / "Skill catalog" | **Catalog** | Display the reference skill catalog |
| "Check my skills" / "Skill health" | **Health Check** | Validate existing skill quality |
| No specific request | **Analyze** | Default to full analysis |

---

## Mode 1: Analyze (Project Context Scan)

Build a complete picture of the current project before doing anything else.

### Step 1: Discover the skills directory

Check these paths in order and use the first one that exists:
1. `.claude/skills/`
2. `skills/`
3. `agents/skills/`
4. `/mnt/skills/user/`
5. `/mnt/skills/`
6. Any path the user specifies

If no skills directory exists, note this — the project has zero skills installed.

### Step 2: Inventory installed skills

For each subdirectory containing a `SKILL.md` file:
1. Parse the YAML frontmatter to extract: name, description, version, category
2. Note the presence of `scripts/`, `references/`, `assets/` subdirectories
3. Record what this skill does based on its description and triggers
4. Check for any dependencies declared in the frontmatter

Build a list of installed skills grouped by category.

### Step 3: Scan project context

Look for signals that reveal the project's nature and needs:

**Agent configuration:**
- Agent role definitions (PM agents, engineer agents, etc.)
- Workflow configurations, orchestration files
- System prompts, agent instructions

**Technology stack:**
- `package.json` → Node.js ecosystem
- `requirements.txt` / `pyproject.toml` → Python ecosystem
- `Dockerfile` / `docker-compose.yml` → Containerized deployment
- `.github/workflows/` → CI/CD pipelines
- `prisma/` / database configs → Data layer
- `.env.example` → Environment configuration
- `tsconfig.json` → TypeScript
- `next.config.*` / `nuxt.config.*` → Frontend frameworks

**Integration signals:**
- MCP configuration files (`.mcp.json`, `mcp.config.*`)
- API route files, webhook handlers
- Third-party service configs (Stripe, SendGrid, etc.)

### Step 4: Present the Project Context Summary

Output a structured summary:

```
PROJECT CONTEXT SUMMARY
=======================

Skills Installed: [count]
  [Category]: [skill-name], [skill-name]
  [Category]: [skill-name]
  (none detected) — if no skills found

Agent Roles Detected: [list or "none detected"]

Technology Stack: [detected technologies]

Integration Points: [APIs, services, databases detected]

Workflows Configured: [any orchestration/workflow files found]
```

Then automatically proceed to Mode 2 (Suggest) unless the user only asked for a scan.

---

## Mode 2: Suggest (Gap Analysis + Recommendations)

Compare what exists against what should exist using three layers of rules.

### Layer 1: Dependency Check (Critical Priority)

For every installed skill, check if its declared dependencies are also installed.
If a required dependency is missing, flag it as **CRITICAL**.

### Layer 2: Complementary Pair Rules (High Priority)

Apply these rules — and reason about additional project-specific rules:

```
IF has_skill(api-*) AND NOT has_skill(error-handling)
→ SUGGEST error-handling (confidence: 95%)

IF has_skill(data-*) AND NOT has_skill(data-validation)
→ SUGGEST data-validation (confidence: 90%)

IF has_agent_role(engineer) AND NOT has_skill(code-review)
→ SUGGEST code-review (confidence: 80%)

IF file_exists(docker*) AND NOT has_skill(deployment)
→ SUGGEST deployment (confidence: 75%)

IF has_api_routes AND NOT has_skill(rate-limiting)
→ SUGGEST rate-limiting (confidence: 75%)

IF has_skill(scheduling OR orchestration) AND NOT has_skill(logging)
→ SUGGEST logging (confidence: 90%)

IF has_skill(logging) AND NOT has_skill(monitoring)
→ SUGGEST monitoring (confidence: 70%)

IF has_mcp_config AND NOT has_skill(mcp-management)
→ SUGGEST mcp-management (confidence: 70%)
```

**Important**: These rules are a starting point. Use reasoning to identify
project-specific gaps outside these rules.

### Layer 3: Category Coverage Check (Medium Priority)

Foundational categories that should have at least one skill:

- **Error Handling & Resilience**
- **Observability** — At minimum logging; ideally monitoring
- **Configuration Management** — Environment handling, secrets

### Present Recommendations

Rank all suggestions by: `priority_weight × confidence × context_relevance`

Group into three tiers:

```
⚠️  CRITICAL GAPS (must address)
💡 RECOMMENDED ADDITIONS
📋 NICE TO HAVE

🔗 SKILL RELATIONSHIP MAP
    [existing-skill] ──requires──→ [suggested-skill]
    [existing-skill] ──complements──→ [suggested-skill]
```

---

## Mode 3: Generate (Create a New Skill)

### Step 1: Confirm understanding

Briefly confirm: what the skill does, when it triggers, category, dependencies.

### Step 2: Match existing conventions

If skills already exist, match their style (frontmatter fields, detail level,
directory structure). If none exist, use canonical structure.

### Step 3: Generate the complete skill package

```
[skill-name]/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Optional: executable code
├── references/           # Optional: docs loaded on demand
└── assets/               # Optional: templates, configs
```

### SKILL.md Template

```yaml
---
name: [lowercase-hyphenated-name]
description: >-
  [What this skill does. When to use it. Trigger phrases.
  Max ~500 characters.]
metadata:
  author: synthex
  version: "1.0"
  type: [skill-type]
  triggers:
    - [trigger phrase 1]
    - [trigger phrase 2]
  requires:
    - [dependency skill path if any]
---
```

Followed by sections: Purpose, When to Use, When NOT to Use, Instructions
(numbered imperative steps), Input/Output Specification tables, Error Handling,
Examples.

### Quality Checklist

- [ ] SKILL.md is under 500 lines
- [ ] Every instruction step is imperative and numbered
- [ ] "When NOT to Use" section is included
- [ ] Description includes trigger phrases
- [ ] One skill = one job
- [ ] All external dependencies listed
- [ ] Style matches existing skills

---

## Mode 4: Catalog (Browse Available Skill Templates)

### Reference Skill Catalog

#### Error Handling & Resilience
| Skill | Description | Complexity | Complements |
|-------|-------------|------------|-------------|
| error-handling | Structured error catching and recovery | Moderate | logging, api-connector |
| retry-logic | Exponential backoff for transient failures | Simple | error-handling |
| circuit-breaker | Prevent cascading failures | Moderate | error-handling, monitoring |

#### API & Integration
| Skill | Description | Complexity | Complements |
|-------|-------------|------------|-------------|
| api-connector | REST API client patterns | Moderate | error-handling, rate-limiting |
| webhook-handler | Receive and process webhooks | Moderate | error-handling, logging |
| rate-limiting | Throttle requests | Simple | api-connector |

#### Data Processing
| Skill | Description | Complexity | Complements |
|-------|-------------|------------|-------------|
| data-validation | Input validation and sanitization | Moderate | data-transformation |
| batch-processing | Process large datasets in chunks | Complex | logging, error-handling |

#### Orchestration & Workflow
| Skill | Description | Complexity | Complements |
|-------|-------------|------------|-------------|
| task-orchestration | Multi-step workflow coordination | Complex | logging, error-handling |
| scheduling | Time-based task scheduling | Moderate | logging, monitoring |

#### Observability & DevOps
| Skill | Description | Complexity | Complements |
|-------|-------------|------------|-------------|
| logging | Structured logging with levels | Simple | monitoring |
| monitoring | Metrics, thresholds, health | Moderate | logging, alerting |
| deployment | Build, deploy, rollback procedures | Complex | health-checks, logging |

---

## Mode 5: Health Check (Validate Existing Skills)

For each installed skill, check:

1. **Frontmatter completeness** — Are `name` and `description` present?
2. **Description quality** — Includes trigger phrases? Both "when to use" and "when not to use"?
3. **Dependency satisfaction** — All declared dependencies installed?
4. **Instruction quality** — Steps imperative and numbered?
5. **Negative triggers** — "When NOT to Use" section present?
6. **Size check** — SKILL.md under 500 lines?
7. **Overlap detection** — Any duplicate functionality?
8. **Script validity** — If `scripts/` exists, are files valid?

Present results as:

```
SKILL HEALTH REPORT
===================

✅ [skill-name] — Healthy
   All checks passed.

⚠️  [skill-name] — Issues Found
   - Missing "when NOT to use" section
   - Suggestion: [specific improvement]

❌ [skill-name] — Critical Issues
   - Required dependency [X] is not installed
   - SKILL.md exceeds 500 lines without references
```

---

## Skill Relationship Reference

```
error-handling:
  complements: [api-connector, data-processing, webhook-handler]
  required_by: [api-connector, retry-logic]

logging:
  complements: [ALL]
  required_by: [monitoring, alerting, status-reporting]

monitoring:
  requires: [logging]
  complements: [alerting, health-checks]

api-connector:
  requires: [error-handling]
  complements: [retry-logic, rate-limiting, authentication]

authentication:
  complements: [session-management, access-control, encryption]

data-validation:
  complements: [data-transformation, input-sanitization]

deployment:
  requires: [health-checks]
  complements: [monitoring, configuration-management]

task-orchestration:
  complements: [logging, scheduling, queue-management, error-handling]
```

---

## Behavioral Rules

1. **NEVER hardcode project names, domains, or paths** — discover dynamically
2. **NEVER assume the project's purpose** — infer from the scan
3. **Always present actionable recommendations** — not just observations
4. **Match existing conventions** — follow the project's style when generating
5. **If no existing skills** — use canonical structure from this document
6. **Catalog is a starting point** — use reasoning for project-specific gaps
7. **Prioritize high-impact, low-effort skills first**
8. **Ask before generating** — present suggestions, let user choose
9. **One skill = one job** — suggest splitting if scope is too broad
10. **Be pushy with descriptions** — broad triggers ensure reliable activation
