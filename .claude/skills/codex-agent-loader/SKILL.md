---
name: codex-agent-loader
description: >
  On-demand loader for VoltAgent/awesome-codex-subagents. Install any of the
  136 specialist Codex agents into Claude Code on demand. Covers backend,
  frontend, infra, security, data, DevEx, and meta-orchestration domains.
metadata:
  author: synthex
  version: '1.0'
  type: reference-skill
  triggers:
    - codex agent
    - install agent
    - specialist agent
    - awesome-codex
context: fork
---

# Codex Agent Loader

136 specialist agents from [VoltAgent/awesome-codex-subagents](https://github.com/VoltAgent/awesome-codex-subagents) are available on demand. They are NOT pre-installed — fetch only what you need.

## Install an Agent

```bash
node scripts/codex-agent-bridge.mjs install <agent-name>
```

Once installed, the agent is cached at `.claude/agents/codex/<name>.md` and available immediately. No re-fetch on subsequent sessions.

## Browse Available Agents

```bash
# Full catalogue with install status
node scripts/codex-agent-bridge.mjs list

# Filter by category
node scripts/codex-agent-bridge.mjs list --category security
node scripts/codex-agent-bridge.mjs list --category infra
node scripts/codex-agent-bridge.mjs list --category data

# What's already installed
node scripts/codex-agent-bridge.mjs installed
```

## Categories & Recommended Agents for Synthex

| Category                 | Best for Synthex          | Install command                                                                   |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------- |
| **Core Development**     | API design, backend fixes | `install api-designer`, `install backend-developer`                               |
| **Quality & Security**   | Audits, pen testing       | `install security-auditor`, `install penetration-tester`, `install code-reviewer` |
| **Infrastructure**       | DB, cloud, Vercel         | `install database-administrator`, `install cloud-architect`                       |
| **Data & AI**            | ML, prompt engineering    | `install prompt-engineer`, `install ai-engineer`                                  |
| **Developer Experience** | Git, docs, refactoring    | `install refactoring-specialist`, `install documentation-engineer`                |
| **Meta-Orchestration**   | Multi-agent workflows     | `install multi-agent-coordinator`, `install workflow-orchestrator`                |
| **Language Specialists** | TypeScript, Next.js, SQL  | `install typescript-specialist`, `install nextjs-specialist`                      |

## Full Catalogue

See: `.claude/agents/codex/CATALOGUE.md`

## How It Works

1. `install <name>` checks `.claude/agents/codex/<name>.md` (cache)
2. Cache miss → fetches TOML from GitHub, converts to Claude Markdown, saves
3. Cache hit → uses existing file immediately
4. Cached agents are excluded from git (`.gitignore`) — fetched fresh per machine

## Notes

- Codex `gpt-5.4` agents → mapped to `sonnet` (deep reasoning)
- Codex `gpt-5.3-codex-spark` agents → mapped to `haiku` (fast scan/synthesis)
- Agent names are prefixed `codex-` in Claude to avoid conflicts with native agents

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
