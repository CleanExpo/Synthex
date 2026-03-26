---
name: agent-registry
type: registry
version: 1.0.0
---

# Synthex Agent Registry

Routes tasks to the correct specialist agent. Read this before dispatching any agent.

---

## Orchestrator

| Agent         | File           | Role                                                                                                                                                |
| ------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **hive-mind** | `hive-mind.md` | Primary orchestrator. Routes tasks to specialists, loads STATE.md / COMPASS / AGENT-REGISTRY, enforces max-2-retry rule before escalating to human. |

---

## Specialists

| Agent               | File                 | Trigger On                                                                                                       |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **build-engineer**  | `build-engineer.md`  | Vercel deployments, build failures, env config, `vercel.json`, edge function issues, CI pipeline errors          |
| **code-architect**  | `code-architect.md`  | Architecture decisions, refactoring strategy, PR analysis, design reviews, cross-system dependencies             |
| **qa-sentinel**     | `qa-sentinel.md`     | Test coverage, Jest config, quality gates, CI failures, coverage thresholds, regression detection                |
| **senior-reviewer** | `senior-reviewer.md` | Post-implementation code review. Runs after significant code changes. Returns Blockers / Warnings / Suggestions. |

---

## Routing Rules

```
Build / deploy failures     → build-engineer
Architecture questions      → code-architect
Test failures / coverage    → qa-sentinel
Post-task code review       → senior-reviewer
Multi-domain / ambiguous    → hive-mind (orchestrates specialists)
Specialist not listed above → codex-agent-loader skill (136 on-demand agents)
```

---

## Codex Agent Library (On-Demand)

136 additional specialist agents from [VoltAgent/awesome-codex-subagents](https://github.com/VoltAgent/awesome-codex-subagents) are available on demand. They are not pre-loaded — install only what you need:

```bash
node scripts/codex-agent-bridge.mjs install <agent-name>   # fetch + cache
node scripts/codex-agent-bridge.mjs list                   # browse catalogue
node scripts/codex-agent-bridge.mjs installed              # what's cached
```

Full catalogue: `.claude/agents/codex/CATALOGUE.md`

| Category             | Notable agents                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| Core Development     | `api-designer`, `backend-developer`, `frontend-developer`, `code-mapper` |
| Quality & Security   | `security-auditor`, `penetration-tester`, `code-reviewer`, `qa-expert`   |
| Infrastructure       | `database-administrator`, `cloud-architect`, `kubernetes-specialist`     |
| Language Specialists | `typescript-specialist`, `nextjs-specialist`, `sql-specialist`           |
| Data & AI            | `prompt-engineer`, `ai-engineer`, `ml-engineer`                          |
| Meta-Orchestration   | `multi-agent-coordinator`, `workflow-orchestrator`, `task-distributor`   |

Cached agents live at `.claude/agents/codex/` (excluded from git — fetched per machine).

---

## Dispatch Constraints

- Every agent dispatch **requires a Linear issue ID** (UNI-XXXX) — no code changes without one
- **Max 2 automatic retries** per failing step → escalate to human
- Production changes (Phase 8+) always end at a **human review gate** — never auto-merge PRs
- Parallelise independent agents; sequential only when there is a true data dependency

---

## Output Contract

Every agent must return:

```json
{
  "status": "done | blocked",
  "issueId": "UNI-XXXX",
  "filesChanged": ["path/to/file.ts"],
  "testResult": "2093 passed, 0 failed",
  "concerns": "optional free text"
}
```

---

## Extended Protocol

See `orchestrator-v2.md` for the full Orchestrator v2.0 protocol including:

- 3-iteration hard cap
- Token budget tracking
- Scope gate (schema migrations require human approval)
