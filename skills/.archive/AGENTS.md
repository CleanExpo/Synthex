# Skills AGENTS.md

> Agent behavior definitions and orchestration rules

## Package Identity

| Attribute | Value |
|-----------|-------|
| Purpose | Define AI agent behaviors and patterns |
| Format | YAML frontmatter + Markdown |
| Routing | Orchestrator matches tasks to skills |

## Skill Structure

```
skills/
├── ORCHESTRATOR.md         # Master task router (priority: 1)
├── audit/                  # Audit and verification
│   └── VERIFICATION-PROTOCOL.md
├── backend/                # Backend development
│   ├── ADVANCED-TOOL-USE.md
│   ├── AGENTS.md
│   ├── FASTAPI.md
│   ├── LANGGRAPH.md
│   └── LONG-RUNNING-AGENTS.md
├── core/                   # Universal patterns
│   ├── CODING-STANDARDS.md
│   ├── ERROR-HANDLING.md
│   ├── FOUNDATION-FIRST.md
│   └── VERIFICATION.md
├── database/               # Database skills
│   ├── MIGRATIONS.md
│   └── SUPABASE.md
├── devops/                 # Infrastructure
│   ├── DEPLOYMENT.md
│   └── DOCKER.md
├── frontend/               # Frontend development
│   ├── COMPONENTS.md
│   ├── NEXTJS.md
│   └── TAILWIND.md
└── marketing/              # Marketing content
    ├── BUSINESS-CONSISTENCY.md
    ├── COPYWRITING.md
    └── VISUAL-CONTENT.md
```

## Skill File Format

### ✅ DO: Proper Skill Structure

```markdown
---
name: skill-name
version: 1.0.0
description: What this skill teaches agents to do
author: Your Team
priority: 1-10  # Lower = higher priority
triggers:
  - keyword1
  - keyword2
requires:
  - core/VERIFICATION.md
  - core/ERROR-HANDLING.md
---

# Skill Title

## Purpose
Why this skill exists and when to use it.

## Patterns
Concrete examples of correct behavior.

## Anti-Patterns
Examples of what NOT to do.

## Verification
How to verify the skill was applied correctly.
```

### ❌ DON'T: Anti-patterns

```markdown
-- BAD: Missing frontmatter
# Just a title with no metadata

-- BAD: No triggers (won't be routed)
---
name: orphan-skill
---

-- BAD: No verification criteria
# Skill that can't be validated

-- BAD: Too generic (matches everything)
triggers:
  - code
  - fix
  - help
```

## Priority System

| Priority | Usage | Example |
|----------|-------|---------|
| 1 | Core orchestration | `ORCHESTRATOR.md` |
| 2 | Critical patterns | `VERIFICATION.md` |
| 3 | Domain-specific | `FASTAPI.md`, `NEXTJS.md` |
| 4-5 | Optional guidance | `CODING-STANDARDS.md` |

Lower priority numbers are loaded first and take precedence.

## Key Skills

| Skill | Path | Purpose |
|-------|------|---------|
| Orchestrator | `ORCHESTRATOR.md` | Routes all tasks |
| Verification | `core/VERIFICATION.md` | Verification-first approach |
| Error Handling | `core/ERROR-HANDLING.md` | Error patterns |
| Long Running | `backend/LONG-RUNNING-AGENTS.md` | Multi-session agents |
| Tool Use | `backend/ADVANCED-TOOL-USE.md` | Tool calling patterns |

## Task Routing

The Orchestrator routes tasks based on triggers:

```yaml
# Frontend tasks → frontend/*.md
triggers: [react, component, ui, tailwind, nextjs]

# Backend tasks → backend/*.md
triggers: [api, agent, fastapi, langgraph]

# Database tasks → database/*.md
triggers: [migration, supabase, database, sql]

# DevOps tasks → devops/*.md
triggers: [docker, deploy, ci, infrastructure]
```

## Search Patterns (JIT)

```bash
# Find skill by name
rg "^name:" skills/ -A 1

# Find skill by trigger
rg "triggers:" skills/ -A 5

# Find high-priority skills
rg "priority: [12]" skills/

# Find skills with requirements
rg "requires:" skills/ -A 3

# List all skills
find skills -name "*.md" -type f
```

## Creating New Skills

1. Choose appropriate category folder
2. Use `SCREAMING-KEBAB-CASE.md` naming
3. Add complete frontmatter
4. Define clear triggers
5. Include verification criteria

```markdown
---
name: new-skill
version: 1.0.0
description: Brief description of the skill
author: Your Team
priority: 3
triggers:
  - specific_keyword
  - another_trigger
requires:
  - core/VERIFICATION.md
---

# New Skill Name

## Purpose
Clear explanation of when this skill applies.

## Core Principles
1. First principle
2. Second principle

## Patterns

### ✅ DO: Good Pattern
```code
example of correct implementation
```

### ❌ DON'T: Bad Pattern
```code
example of what to avoid
```

## Verification Checklist
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

## Common Gotchas

1. **Trigger Overlap**
   - Avoid generic triggers that match too broadly
   - Be specific: `react_component` not `component`

2. **Missing Requirements**
   - Always require `core/VERIFICATION.md`
   - Chain dependencies correctly

3. **Priority Conflicts**
   - Only one skill should have priority 1
   - Avoid same priority for overlapping triggers

4. **Version Consistency**
   - Bump version when making breaking changes
   - Document changes in skill body

## Verification

Skills are correctly applied when:
- [ ] Appropriate skill matched based on task
- [ ] All required skills loaded
- [ ] Patterns followed as documented
- [ ] Anti-patterns avoided
- [ ] Verification criteria met

---

**Parent**: [Root AGENTS.md](../AGENTS.md)
