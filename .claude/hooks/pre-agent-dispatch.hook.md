---
name: pre-agent-dispatch
type: hook
trigger: Before agent dispatched
priority: 2
blocking: false
version: 1.0.0
---

# Pre-Agent-Dispatch Hook

Runs before orchestrator dispatches to specialist agent.

## Actions

### 1. Context Partitioning
```python
# Provide only relevant context to agent
relevant_files = identify_relevant_files(task)
relevant_skills = identify_relevant_skills(task)

context = {
    "files": relevant_files,
    "skills": relevant_skills,
    "task": task,
    "australian_context": True,  # Always include
    "verification_required": True
}
```

### 2. Skill Loading
```
Based on agent type, pre-load common skills:
- Frontend → design-system.skill.md, australian-context.skill.md
- Backend → verification-first.skill.md
- Content → truth-finder.skill.md
- SEO → search-dominance.skill.md, geo-australian.skill.md
```

### 3. Memory Domain Selection
```
Select appropriate memory domain:
- Technical tasks → technical_memory
- Business tasks → business_memory
- Content tasks → content_memory
```

## Integration

Called by orchestrator before spawning subagent.
