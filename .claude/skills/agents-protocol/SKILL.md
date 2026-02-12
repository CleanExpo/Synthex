---
name: agents-protocol
description: >-
  The operational protocol governing how agents communicate, delegate, escalate,
  handle errors, manage permissions, and coordinate within a multi-agent system.
  Use this protocol whenever setting up a new agent system, onboarding new agents,
  debugging agent coordination failures, or establishing governance rules.
  Also trigger when the user mentions "agent rules", "agent protocol", "escalation",
  "handoff rules", "agent permissions", "agent governance", or "how agents should
  work together". This is the constitution for agent behavior — load it before any
  agent begins work.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: governance-skill
  triggers:
    - agent protocol
    - agent rules
    - escalation
    - handoff rules
    - agent permissions
    - agent governance
    - agent coordination
    - delegation protocol
---

# Agents Protocol v1.0

The operational constitution for multi-agent systems. This protocol defines how
agents communicate, delegate, escalate, handle errors, manage permissions, and
coordinate — regardless of the project, domain, or framework.

This protocol is separate from agent definitions. Agent definitions say WHAT an
agent does. This protocol says HOW all agents must behave.

## When to Use

Activate this protocol when:
- Setting up a new multi-agent system or onboarding new agents
- Debugging agent coordination failures or duplicate work
- Establishing governance rules for agent communication
- Defining escalation chains or handoff procedures
- Reviewing agent permissions or access control
- An agent encounters an error and needs to know how to report it

## When NOT to Use This Skill

- When defining what a specific agent does (use that agent's primer or skill)
- When implementing agent code (use backend skills like langgraph, fastapi)
- When the task is single-agent with no coordination needed
- Instead use: Agent primers in `.claude/primers/` for agent-specific definitions

---

## 1. Agent Identity & Registration

Every agent in the system MUST have a registered identity before it can operate.

### 1.1 Agent Card (Required)

Every agent MUST declare an Agent Card — a structured manifest of its identity
and capabilities.

```yaml
agent_card:
  id: [unique-lowercase-hyphenated-id]
  name: [Human-readable display name]
  type: [orchestrator | worker | evaluator | router | hybrid]
  version: "1.0.0"

  capabilities:
    - [What this agent CAN do — be specific]

  boundaries:
    - [What this agent CANNOT and MUST NOT do]

  inputs:
    accepts: [list of input types/formats this agent processes]
    rejects: [list of inputs this agent must refuse]

  outputs:
    produces: [list of output types/formats]
    format: [structured | freeform | hybrid]

  permissions:
    tools: [list of tools this agent may use]
    read: [what data/files this agent can read]
    write: [what data/files this agent can modify]
    execute: [what commands/scripts this agent can run]
    network: [what external services this agent can access]

  delegation:
    can_delegate_to: [list of agent IDs this agent may spawn or hand off to]
    receives_from: [list of agent IDs that may send work to this agent]
    escalates_to: [agent ID or human role for escalation]

  model_tier: [opus | sonnet | haiku | configurable]
  max_turns: [maximum agentic loop iterations before forced pause]
  max_tokens: [token budget per invocation, if applicable]
```

### 1.2 Registration Rules

- No agent may operate without a registered Agent Card
- Agent IDs must be unique within the system
- Agent Cards are the single source of truth for permissions and capabilities
- If an agent attempts an action not listed in its Agent Card, the action MUST be blocked or flagged
- Agent Cards should be versioned; changes require review

---

## 2. Communication Protocol

### 2.1 Message Format

All inter-agent communication MUST use a structured message format.

```yaml
message:
  id: [unique message identifier]
  timestamp: [ISO-8601]
  from: [sending agent ID]
  to: [receiving agent ID]
  type: [task | result | status | escalation | error | query]

  # For task messages
  task:
    objective: [Clear statement of what to achieve]
    output_format: [Exact structure expected in return]
    tools_guidance: [Which tools to use and how]
    boundaries: [What NOT to do]
    effort_level: [simple | moderate | complex]
    deadline: [if applicable]
    priority: [critical | high | normal | low]
    context: [Relevant information the receiving agent needs]

  # For result messages
  result:
    status: [complete | partial | failed | needs_input]
    output: [The actual deliverable]
    confidence: [0.0-1.0 self-assessed confidence in output quality]
    issues: [Any problems encountered]
    suggestions: [Optional recommendations for the requesting agent]

  # For status messages
  status:
    state: [working | blocked | waiting | complete]
    progress: [percentage or description]
    blockers: [what is preventing progress, if any]
```

### 2.2 Communication Rules

1. **Direct addressing only.** Every message MUST specify a `from` and `to`.
   No broadcasting to "all agents" — this causes context pollution.

2. **Structured over freeform.** Agents MUST use the message format above.
   Freeform natural language between agents leads to misinterpretation.

3. **Minimum viable context.** Send only the information the receiving agent
   needs. Do NOT dump your full context into the message.

4. **Output to filesystem, not to messages.** For large outputs (reports,
   code, data), write to a shared filesystem location and send a reference
   path in the message.

5. **Acknowledge receipt.** When an agent receives a task, it MUST acknowledge
   with a status message before beginning work.

6. **No unsolicited communication.** Agents should not message other agents
   unless they have a task, result, status update, or escalation.

---

## 3. Delegation Protocol

### 3.1 The Five Requirements of Delegation

Every delegation from an orchestrator to a worker MUST include all five elements.

| # | Requirement | What It Means | Failure Without It |
|---|-------------|---------------|--------------------|
| 1 | **Objective** | What to achieve, stated as a clear goal | Agent misinterprets the task |
| 2 | **Output Format** | Exact structure of the expected deliverable | Orchestrator can't parse the result |
| 3 | **Tools Guidance** | Which tools/sources to use and prioritize | Agent uses wrong tools or wastes time |
| 4 | **Boundaries** | What NOT to do, what's out of scope | Agent duplicates another worker's task |
| 5 | **Effort Level** | How much work is appropriate | Agent over- or under-invests |

### 3.2 Effort Scaling Rules

| Effort Level | Tool Calls | Subagents | Duration | When to Use |
|--------------|------------|-----------|----------|-------------|
| **Simple** | 1-5 | 0 | Seconds | Fact lookups, simple transforms |
| **Moderate** | 5-15 | 0-2 | Minutes | Multi-step processes, document generation |
| **Complex** | 15-50 | 2-5 | Extended | Research tasks, multi-file changes |
| **Intensive** | 50+ | 5+ | Long-running | Comprehensive research, system-wide refactors |

An orchestrator MUST specify the effort level. A worker MUST NOT exceed its
effort level without requesting permission to upgrade.

### 3.3 Delegation Anti-Patterns (MUST AVOID)

- **Vague delegation**: "Research the thing" — MUST specify what, where, format, boundaries
- **Over-delegation**: Delegating a 2-minute task to a subagent (overhead exceeds value)
- **Duplicate delegation**: Two workers with overlapping scope — MUST define clear boundaries
- **Unbounded delegation**: No effort limit — agent runs forever burning tokens
- **Context dumping**: Sending your entire context to the worker — send minimum viable context

---

## 4. Escalation Protocol

### 4.1 Escalation Triggers

An agent MUST escalate when any of these conditions are met:

| Trigger | Description | Escalation Target |
|---------|-------------|-------------------|
| **Capability boundary** | Task requires capabilities outside Agent Card | Orchestrator or specialist |
| **Confidence threshold** | Self-assessed confidence drops below 0.5 | Orchestrator for reassignment |
| **Error threshold** | 3+ consecutive errors on same operation | Orchestrator with error log |
| **Scope violation** | Would require exceeding permissions | Orchestrator + security flag |
| **Resource exhaustion** | Approaching token/turn/time limits | Orchestrator for context handoff |
| **Ethical/safety boundary** | Content violates safety guidelines | Human operator (immediate) |
| **Data sensitivity** | Lacks permission to access required data | Human operator or authorized agent |
| **Ambiguity** | Multiple valid interpretations | Orchestrator or human for clarification |
| **Conflict** | Output contradicts another agent's output | Evaluator agent or human |
| **User request** | User explicitly asks to escalate | Immediately honored |

### 4.2 Escalation Message Format

```yaml
escalation:
  from: [escalating agent ID]
  to: [escalation target]
  trigger: [which trigger from the table above]
  severity: [critical | high | normal | informational]

  context:
    task_description: [What the agent was trying to do]
    progress_so_far: [What has been completed]
    blocking_issue: [Specific reason for escalation]
    attempted_solutions: [What the agent already tried]
    recommendation: [Agent's suggestion for resolution, if any]

  artifacts:
    - [Path to any partial outputs]
    - [Path to error logs]
    - [Path to relevant context files]
```

### 4.3 Escalation Chain

```
Worker Agent
    ↓ (escalates to)
Orchestrator Agent
    ↓ (escalates to)
Lead/Senior Orchestrator (if hierarchical)
    ↓ (escalates to)
Human Operator
```

- Escalations MUST NOT skip levels unless the trigger is "ethical/safety boundary"
  or "user request" — these go directly to human operator
- Escalations MUST include context — never escalate an empty "I can't do this"
- The receiving agent MUST acknowledge the escalation within its next action
- Escalated tasks have elevated priority

### 4.4 De-escalation

When an escalation is resolved:
1. The resolving agent sends a result back down the chain
2. The result includes what was done and any changes to the original task scope
3. The original agent may resume work with the new information
4. The escalation is logged for future pattern analysis

---

## 5. Handoff Protocol

### 5.1 When Handoffs Occur

| Handoff Type | When It Happens |
|--------------|-----------------|
| **Routing handoff** | Router classifies input and passes to the right specialist |
| **Completion handoff** | Agent finishes its part and passes to the next in a chain |
| **Capability handoff** | Agent recognizes the task needs a different specialist |
| **Context handoff** | Agent's context window is approaching limits |
| **Scheduled handoff** | Predefined workflow dictates the next agent in sequence |

### 5.2 Handoff Requirements

Every handoff MUST include:

1. **Task state**: Summary of what has been done (not full history)
2. **Remaining work**: What still needs to be accomplished
3. **Key decisions made**: Choices that constrain remaining work
4. **Artifacts produced**: Paths to files or outputs created
5. **Context to preserve**: Critical information the receiving agent MUST know
6. **Context to discard**: Explicitly note what is NOT relevant

### 5.3 Handoff Format

```yaml
handoff:
  from: [handing-off agent ID]
  to: [receiving agent ID]
  type: [routing | completion | capability | context | scheduled]

  state:
    summary: [2-3 sentence summary of work done]
    decisions: [Key choices made that affect remaining work]
    artifacts: [Paths to outputs]

  remaining:
    objective: [What still needs to be done]
    constraints: [Any limitations or requirements]

  preserve: [Critical context the next agent needs]
  discard: [What's irrelevant — explicitly stated to prevent context pollution]
```

### 5.4 Context Handoff (Special Case)

When an agent approaches context window limits:

1. **Save plan to external memory** — Write progress and key findings to a file
2. **Spawn fresh agent** — Create a new agent instance with a clean context
3. **Load state, not history** — New agent reads the saved state, NOT full history
4. **Continue from checkpoint** — New agent picks up where the old one left off

---

## 6. Permission & Access Control

### 6.1 Principle of Least Privilege

```
DEFAULT: deny all
GRANT: only what's in the Agent Card
ENFORCE: at every tool call, file access, and network request
```

### 6.2 Permission Tiers

| Tier | Access Level | Example Agents | Approval |
|------|-------------|----------------|----------|
| **Read-only** | Can read, cannot modify | Research agents, fact-checkers | None |
| **Standard** | Can read and create new files | Content writers, report generators | None |
| **Elevated** | Can read, create, and modify | Senior engineers, editors | Agent Card review |
| **System** | Can execute commands, access APIs | DevOps, deployment agents | Human approval |
| **Administrative** | Can modify other agents' permissions | Orchestrator (limited), human only | Human approval |

### 6.3 Permission Enforcement Rules

1. Agent Cards are the authority — if not listed, it's denied
2. No permission inheritance — subagents do NOT inherit parent permissions
3. Sensitive actions require confirmation from orchestrator or human
4. Audit all permission usage with agent ID, timestamp, and action
5. Periodic permission review to remove unnecessary permissions

### 6.4 Dangerous Operations Blocklist

These MUST NEVER be performed by any agent without human approval:

- Deleting production data or unrecoverable files
- Deploying to production environments
- Sending external communications on behalf of users
- Modifying authentication credentials or secrets
- Changing other agents' permissions
- Making financial transactions
- Accessing PII beyond what's needed
- Running commands with root/sudo privileges

---

## 7. Error Handling Protocol

### 7.1 Error Classification

| Category | Description | Response |
|----------|-------------|----------|
| **Transient** | Temporary failure that may resolve on retry | Retry with backoff |
| **Permanent** | Failure that will not resolve on retry | Report and escalate |
| **Configuration** | Failure caused by setup/config issues | Flag for human review |

### 7.2 Retry Policy

```
Attempt 1: Immediate
Attempt 2: Wait 2 seconds
Attempt 3: Wait 4 seconds
Attempt 4: Wait 8 seconds (max)
After 4 attempts: Classify as permanent, escalate
```

Between retries, the agent SHOULD try alternative approaches if available.

### 7.3 Error Reporting Format

```yaml
error_report:
  agent_id: [which agent encountered the error]
  timestamp: [ISO-8601]
  category: [transient | permanent | configuration]
  operation: [what was being attempted]
  error_detail: [specific error message or code]
  context: [sanitized — NO secrets, passwords, or PII]
  attempts: [number of retry attempts made]
  resolution: [what the agent did or recommends]
  impact: [what this error prevents from completing]
```

### 7.4 Error Propagation Rules

1. Errors flow UP, not sideways — worker reports to its orchestrator
2. Include impact, not just the error — make it actionable
3. Never swallow errors silently — every error MUST be reported or logged
4. Never include sensitive data in error reports
5. Cascading failures (3+ workers) MUST trigger orchestrator pause

---

## 8. Quality & Verification Protocol

### 8.1 The Verification Mandate

Every agent MUST verify its own work before reporting results.

### 8.2 Verification Methods

| Method | When to Use | How It Works |
|--------|-------------|--------------|
| **Self-review** | All outputs | Re-read output and check against original objective |
| **Rules-based check** | Structured outputs | Validate against schema, linting, format rules |
| **Test execution** | Code outputs | Run code and verify expected results |
| **Visual inspection** | UI/visual outputs | Screenshot and verify against intent |
| **Cross-reference** | Research outputs | Verify claims against sources |
| **LLM-as-judge** | Quality-critical outputs | Separate evaluator agent grades output |

### 8.3 Verification Requirements by Agent Type

| Agent Type | Minimum Verification |
|------------|---------------------|
| **Worker** | Self-review + one appropriate method from above |
| **Evaluator** | Must apply 2+ verification methods |
| **Orchestrator** | Must verify synthesized output is internally consistent |
| **Router** | Must verify classification confidence exceeds threshold |

### 8.4 Output Confidence Scoring

| Score | Meaning | Action |
|-------|---------|--------|
| **0.9-1.0** | High confidence — verified and cross-checked | Deliver |
| **0.7-0.89** | Moderate confidence — likely correct, unverified edge cases | Deliver with caveats |
| **0.5-0.69** | Low confidence — uncertain about key aspects | Flag for review |
| **Below 0.5** | Very low confidence — significant uncertainty | Escalate before delivering |

---

## 9. Context Management Protocol

### 9.1 Context Rules

1. **Load on demand, not in advance.** Load what you need for the current step.
2. **Progressive disclosure for skills.** Only load full instructions when needed.
3. **Summarize before passing.** Summarize context for other agents, don't forward raw data.
4. **External memory for persistence.** Write plan, findings, and state to files.
5. **Context isolation for subagents.** Subagents get scoped tasks, not full context.
6. **Prune irrelevant context.** Discard information not needed for the next phase.

### 9.2 Memory Hierarchy

```
Layer 1: Working Memory (current context window)
  → Active task, immediate instructions, recent tool results
  → Persistence: This session only

Layer 2: Session Memory (filesystem)
  → progress.md, state.json, plan.md
  → Persistence: Duration of the task

Layer 3: Project Memory (persistent storage)
  → Skills, agent definitions, project configs, CLAUDE.md
  → Persistence: Lifetime of the project

Layer 4: Organizational Memory (cross-project)
  → Shared skills, protocol documents, templates
  → Persistence: Indefinite
```

---

## 10. Logging & Observability Protocol

### 10.1 What MUST Be Logged

| Event | Required Fields | Purpose |
|-------|----------------|---------|
| **Task received** | agent_id, task_id, timestamp, from, objective | Track assignment |
| **Tool call** | agent_id, tool_name, input (sanitized), output_summary, duration | Debug and audit |
| **Delegation** | from, to, task summary, effort_level | Track distribution |
| **Escalation** | from, to, trigger, severity | Monitor failures |
| **Handoff** | from, to, type, state_summary | Track task flow |
| **Error** | agent_id, category, operation, detail (sanitized) | Diagnose issues |
| **Output delivered** | agent_id, task_id, confidence, output_summary | Track completion |
| **Permission check** | agent_id, action, resource, result (allow/deny) | Security audit |

### 10.2 Log Format

```
[TIMESTAMP] [AGENT_ID] [EVENT_TYPE] [DETAIL]

Example:
[2026-02-13T10:30:15Z] [senior-engineer] [TOOL_CALL] bash: npm test → 47 tests passed (3.2s)
[2026-02-13T10:30:18Z] [senior-engineer] [OUTPUT] Delivered code review with confidence 0.85
[2026-02-13T10:30:19Z] [senior-engineer] [HANDOFF] → code-reviewer: "Review PR #142"
```

### 10.3 Log Levels

| Level | When to Use |
|-------|-------------|
| **ERROR** | Something failed that prevents task completion |
| **WARN** | Something unexpected but work can continue |
| **INFO** | Normal operational events |
| **DEBUG** | Detailed operational data (tool calls, intermediate results) |

---

## 11. Coordination Patterns

### 11.1 Preventing Duplicate Work

1. **Define clear boundaries** for each worker's scope
2. **Use non-overlapping search queries** for parallel workers
3. **Share a "claimed topics" registry** — workers register before starting
4. **Orchestrator reviews assignments** before workers begin

### 11.2 Handling Conflicting Outputs

1. Don't auto-resolve — contradictions are informative
2. Flag the conflict to the orchestrator with both outputs and reasoning
3. Orchestrator investigates using a third agent or different methodology
4. Document the resolution — record why one output was chosen
5. If unresolvable — escalate to human with both perspectives

### 11.3 Parallel Execution Rules

1. **Maximum 5 parallel agents** unless explicitly required
2. **Each parallel agent gets a distinct facet** — not the same task
3. **Set a time/token budget** for each parallel agent
4. **Results go to a synthesizer** — never directly to the user
5. **Synthesizer checks for contradictions** before producing final output

---

## 12. Human-in-the-Loop Protocol

### 12.1 When Human Input Is Required

| Situation | Required Action |
|-----------|----------------|
| Agent confidence below 0.5 on critical task | Pause and request human review |
| Destructive action (deploy, delete, send) | Request explicit human approval |
| Conflicting outputs agents cannot resolve | Present both options to human |
| User explicitly requests human involvement | Immediately honor |
| Ethical/safety boundary triggered | Stop and alert human operator |
| First-time execution of a new workflow | Human monitors first run |
| Cost exceeds predefined threshold | Pause and confirm |

### 12.2 Human Interaction Format

```
HUMAN INPUT REQUESTED
=====================
Agent: [agent ID]
Reason: [why human input is needed]

Context: [brief summary — 2-3 sentences max]

Options:
  [A] [First option with brief explanation]
  [B] [Second option with brief explanation]
  [C] [Provide custom instructions]

Recommended: [which option the agent suggests and why]
```

### 12.3 Human Override

Humans can at any time:
- Pause, cancel, or redirect any agent or task
- Override any agent's decision
- Modify any agent's permissions
- View any agent's logs

Human overrides are ALWAYS final and ALWAYS take priority.

---

## 13. Protocol Versioning & Updates

- **Major version** (v2.0.0): Breaking changes to formats, permissions, or escalation
- **Minor version** (v1.1.0): New rules that don't break existing behaviour
- **Patch version** (v1.0.1): Clarifications, typo fixes, examples

Every agent MUST reference this protocol version in its Agent Card.
Non-compliant agents should be flagged during Health Checks.

---

## Appendix A: Quick Reference Card

```
DELEGATION: Objective + Output Format + Tools + Boundaries + Effort Level
ESCALATION: Context + Progress + Blocker + Attempts + Recommendation
HANDOFF:    State + Remaining + Decisions + Artifacts + Preserve/Discard
ERROR:      Category + Operation + Detail + Impact + Resolution
OUTPUT:     Result + Confidence Score + Issues + Suggestions
```

## Appendix B: Anti-Patterns Checklist

- [ ] Agents communicating without structured messages
- [ ] Orchestrator delegating without all 5 requirements
- [ ] Agents with no "NOT responsible for" boundaries
- [ ] Workers exceeding effort level without permission
- [ ] Errors being swallowed silently
- [ ] Subagents inheriting parent permissions
- [ ] Context dumping instead of minimum viable context
- [ ] Parallel agents with overlapping scope
- [ ] Escalations without context or attempted solutions
- [ ] Human-in-the-loop bypassed for destructive actions

## Integration Points

- **orchestration.skill.md** — Task routing and skill activation
- **verification-first.skill.md** — Verification mandate alignment
- **error-handling.skill.md** — Error classification and propagation
- **skill-manager/SKILL.md** — Agent Card validation during health checks
- `.claude/primers/` — Agent-specific definitions that complement this protocol
- `.claude/hooks/pre-agent-dispatch.hook.md` — Context partitioning before dispatch

## Verification Checklist

- [ ] All agents have registered Agent Cards
- [ ] Agent Cards include capabilities AND boundaries
- [ ] Communication uses structured message format
- [ ] Delegation includes all 5 requirements
- [ ] Escalation chain defined and documented
- [ ] Handoff protocol followed for all agent transitions
- [ ] Permissions follow least-privilege principle
- [ ] Error handling classifies and propagates correctly
- [ ] Verification performed before all output delivery
- [ ] Human-in-the-loop enforced for destructive actions
- [ ] Logging captures all required events
- [ ] Protocol version referenced in all Agent Cards
