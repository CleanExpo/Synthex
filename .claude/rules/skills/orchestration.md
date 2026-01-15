---
paths: skills/**/*.md
---

# Skills and Agent Orchestration Rules

## Skill System

Skills define agent behaviors with YAML frontmatter + Markdown:

```markdown
---
name: skill-name
version: 1.0.0
description: What this skill teaches agents to do
priority: 1-10  # Lower = higher priority
triggers:
  - keyword1
  - keyword2
requires:
  - core/VERIFICATION.md
---

# Skill Content
```

## Priority System

| Priority | Usage | Example |
|----------|-------|---------|
| 1 | Core orchestration | `ORCHESTRATOR.md` |
| 2 | Critical patterns | `VERIFICATION.md` |
| 3 | Domain-specific | `FASTAPI.md`, `NEXTJS.md` |
| 4-5 | Optional guidance | `CODING-STANDARDS.md` |

## Task Routing

```yaml
# Frontend tasks → frontend/*.md
triggers: [react, component, ui, tailwind, nextjs]

# Backend tasks → backend/*.md
triggers: [api, agent, fastapi, langgraph]

# Database tasks → database/*.md
triggers: [migration, supabase, database, sql]
```

## Key Skills

- **Orchestrator** (`ORCHESTRATOR.md`): Routes all tasks
- **Verification** (`core/VERIFICATION.md`): Verification-first approach
- **Long Running** (`backend/LONG-RUNNING-AGENTS.md`): Multi-session agents
- **Tool Use** (`backend/ADVANCED-TOOL-USE.md`): Tool calling patterns

## Critical Rules

- Always require `core/VERIFICATION.md`
- Use specific triggers, avoid generic ones
- Include verification criteria in all skills
- Chain dependencies correctly
