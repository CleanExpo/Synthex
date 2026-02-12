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

### 1. Agent Card Validation (Protocol v1.0)
```python
# Verify target agent has a registered Agent Card
agent_card = load_agent_card(agent_type)
if not agent_card:
    raise AgentNotRegistered(f"No Agent Card for {agent_type}")

# Verify task is within agent's declared capabilities
if not task_within_capabilities(task, agent_card.capabilities):
    raise CapabilityBoundaryViolation(
        f"Task outside {agent_type} capabilities"
    )

# Verify task doesn't violate agent's boundaries
if task_violates_boundaries(task, agent_card.boundaries):
    raise BoundaryViolation(
        f"Task violates {agent_type} boundary rules"
    )
```

### 2. Delegation Requirements (Protocol Section 3.1)
```python
# Enforce all 5 delegation requirements before dispatch
delegation = {
    "objective": task.objective,           # REQUIRED: Clear goal
    "output_format": task.output_format,   # REQUIRED: Expected structure
    "tools_guidance": task.tools,          # REQUIRED: Which tools to use
    "boundaries": agent_card.boundaries,   # REQUIRED: What NOT to do
    "effort_level": task.effort_level,     # REQUIRED: simple|moderate|complex
    "priority": task.priority,             # REQUIRED: critical|high|normal|low
}

for key, value in delegation.items():
    if not value:
        raise IncompleteDelegation(f"Missing delegation requirement: {key}")
```

### 3. Context Partitioning
```python
# Provide MINIMUM VIABLE context (Protocol Section 9.1)
relevant_files = identify_relevant_files(task)
relevant_skills = identify_relevant_skills(task)

context = {
    "files": relevant_files,        # Only files within agent's read scope
    "skills": relevant_skills,      # Domain-specific skills only
    "task": task,                   # Scoped task, not full context
    "australian_context": True,     # Always include locale defaults
    "verification_required": True,  # Independent verification mandatory
    "protocol_version": "1.0.0"    # Protocol reference
}
```

### 4. Skill Loading
```
Based on agent type (from Agent Card), pre-load domain skills:
- frontend-agent → design-system.skill.md, australian-context.skill.md, nextjs.skill.md
- backend-agent  → verification-first.skill.md, fastapi.skill.md, langgraph.skill.md
- database-agent → supabase.skill.md, migrations.skill.md
- verifier       → verification-first.skill.md, error-handling.skill.md
- Content tasks  → truth-finder.skill.md
- SEO tasks      → search-dominance.skill.md, geo-australian.skill.md
```

### 5. Memory Domain Selection
```
Select appropriate memory domain:
- Technical tasks → technical_memory
- Business tasks → business_memory
- Content tasks → content_memory
```

### 6. Permission Scope Enforcement
```python
# Enforce Agent Card permissions at dispatch time
permissions = agent_card.permissions
context["allowed_tools"] = permissions.tools
context["read_scope"] = permissions.read
context["write_scope"] = permissions.write
context["execute_scope"] = permissions.execute
context["network_scope"] = permissions.network
```

## Integration

Called by orchestrator before spawning subagent.
Enforces agents-protocol v1.0 compliance at dispatch time.
