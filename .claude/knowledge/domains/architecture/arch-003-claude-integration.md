---
id: arch-003
domain: architecture
title: Claude Code Integration Architecture
created: 2026-02-16
updated: 2026-02-16
freshness: current
confidence: 0.9
evidence: .claude/, tools/claude-seo/, AGENT_INTEGRATION.md
tags: [claude, agents, skills, hooks]
---

# Claude Code Integration Architecture

## Summary
Claude Code integration uses `.claude/` directory with skills (SKILL.md), agents (AGENT.md), hooks (.ps1), and a knowledge base. Canonical pattern established in `tools/claude-seo/`.

## Detail

### Directory Layout
```
.claude/
  skills/          # 12 SKILL.md definitions (YAML frontmatter + structured markdown)
  agents/          # 6 AGENT.md definitions (orchestrator + 5 specialists)
  hooks/           # 7 PowerShell scripts (PreToolUse, PostToolUse)
  knowledge/       # Structured knowledge base with index.json
  checkpoints/     # Session state persistence
  settings.local.json  # Permissions and hook wiring
```

### Canonical Pattern (tools/claude-seo/)
- **Skills**: YAML frontmatter (name, description) + process steps + output format
- **Agents**: YAML frontmatter (name, description, tools) + role definition + scoring criteria
- **Hooks**: Shell/PS1 scripts with exit code conventions (0=pass, 2=block)

### Orchestration Model
- **Hive Mind**: Master orchestrator routes tasks to specialists
- **Specialists**: Build engineer, SEO strategist, code architect, research analyst, QA sentinel
- **Quality Gates**: Score < 80 returns for revision
- **Memory**: Persistent knowledge base + session checkpoints

## Implications
- All `.claude/` files are outside Vercel's rootDirectory -- zero deployment impact
- Skills are invoked by name reference in conversations
- Hooks fire automatically on tool use per settings.local.json config
- Knowledge base follows load hierarchy: index -> summary -> full entry
