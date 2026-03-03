# Stripe Minions — Architecture Synthesis for Synthex

**Date**: 2026-03-03
**Source**: Stripe Engineering (Feb 2026) — "Minions: AI coding agents merging 1,300+ PRs/week"
**Purpose**: Reference document for Phase 62-66 architecture decisions

---

## What Stripe Minions Is

Stripe's internal AI coding agent system that autonomously merges 1,300+ pull requests per week
with zero human-written code. Built on a fork of Block's open-source Goose agent.

| Dimension | Detail |
|---|---|
| Output | 1,300+ PRs/week, zero human-written code |
| Foundation | Fork of Block's open-source Goose agent |
| Invocation | Slack, CLI, or Web UI |
| Execution | Pre-warmed isolated "devboxes" (10s spin-up) |
| Tools | "Toolshed" MCP server — 400+ internal tools |
| AI Strategy | **One-shot** (single LLM call per task, not multi-turn loop) |
| Orchestration | **Blueprints** (deterministic nodes + bounded agent loops) |
| CI integration | Max 2 rounds auto-fix, then escalate to human |
| Safety gate | Human review required before merge (load-bearing, not ceremonial) |
| Context strategy | Token-budgeted context assembly BEFORE the LLM call |

---

## The 5 Core Principles

### 1. Context > Model
Invest in context engineering, not model upgrades. Perfect context beats a smarter model with
poor context. Reliable AI scales with quality of *constraints*, not model version.

**Synthex mapping**: Pre-step context assembly via `context-builder.ts`. Each AI step receives
exactly the relevant prior outputs — no full conversation history.

### 2. The System Runs the Model
Deterministic blueprint nodes do most of the work. LLM is inside a box, not free-roaming.
"Putting LLMs in contained boxes compounds into system-wide reliability."

**Synthex mapping**: Workflow orchestrator (`orchestrator.ts`) handles routing, gating, and
error handling. The LLM executes within a defined step type — it does not control the flow.

### 3. One-Shot Over Loops
Single-turn execution avoids error compounding. The math:
- 5-step loop at 95% per-step accuracy = 0.95^5 = 77% success
- One shot with rich context = much closer to 100%

**Synthex mapping**: Each AI step in a workflow is a single, well-prepared LLM call. No
re-prompting or self-correction loops within a step. If a step fails, the orchestrator
handles retry logic (max 2), not the LLM.

### 4. Parallelise Over Iterate
10 minions in parallel >> 1 minion looping 10 times.

**Synthex mapping**: Phase 63 — parallel workflow executions via BullMQ concurrency. Phase 62
establishes the single-execution model first; Phase 63 adds parallelism on top.

### 5. Walls Before Models
Sandboxing, 2-round CI cap, mandatory review, token budgets — the guardrails matter more
than model selection.

**Synthex mapping**:
- 2-retry cap per step (mirrors 2-round CI cap)
- Human approval gates mandatory for external writes (publish, schedule, send)
- Token budget enforced in context-builder.ts
- Confidence threshold gates auto-approval

---

## Architecture Map: Stripe → Synthex

| Stripe Component | Synthex Equivalent | Location | Status |
|---|---|---|---|
| Devboxes (isolated sandboxes) | git worktrees per subagent | `isolation: "worktree"` in Task tool | Available |
| Blueprints (orchestration flows) | Phase PLAN.md + orchestrator.ts | `.planning/phases/` + `lib/workflow/` | Partial |
| Toolshed MCP (400+ tools) | `.claude/rules/` + 21 skills + 7 hooks | `.claude/` | ✅ Exists |
| Context assembly pipeline | `context-builder.ts` | `lib/workflow/context-builder.ts` | Phase 62-01 |
| 2-round CI cap | Max 2 retries per step | `lib/workflow/orchestrator.ts` | Phase 62-01 |
| Token budgeting | Context window discipline | `lib/workflow/context-builder.ts` | Phase 62-01 |
| Task invocation (Slack/CLI) | GSD skills + Claude Code | `.claude/skills/gsd/` | ✅ Exists |
| Human review gate | Approval step type + dashboard UI | `lib/workflow/step-types/` | Phase 62-02 |
| Task decomposition | Phase → Plans → Tasks | `.planning/` | ✅ Exists |
| Agent registry | `.planning/AGENT-REGISTRY.md` | `.planning/AGENT-REGISTRY.md` | ✅ Upgraded |

---

## Blueprint Execution Flow (for Phase 62)

```
User triggers workflow (manual / scheduled / API)
    ↓
WorkflowExecution created in DB (status: pending)
    ↓
orchestrator.ts picks up execution, advances to step 1
    ↓
context-builder.ts assembles context for step:
  - step definition (name, type, prompt template)
  - previous StepExecution.outputData (relevant only)
  - token budget applied (strip low-relevance context)
    ↓
step-executor.ts executes step by type:
  - 'ai'        → single LLM call, extract confidence score, store output
  - 'approval'  → mark waiting_approval, notify user, pause queue
  - 'action'    → call downstream service (post/schedule/notify)
  - 'validation'→ rule-based check, no LLM call
    ↓
Result stored in StepExecution (status, outputData, confidenceScore)
    ↓
orchestrator.ts evaluates gate:
  - confidence ≥ threshold (default 0.85) → auto-approve, advance
  - confidence < threshold → queue for human approval
  - action step → always human-gated
    ↓
If retryCount < 2 on failure → retry
If retryCount = 2 on failure → mark failed, surface to human
    ↓
Next step enqueued via BullMQ
    ↓
WorkflowExecution.status = completed
```

---

## Confidence Scoring Design

Every AI step MUST return a confidence score (0.0–1.0). This is the mechanism that replaces
the "mandatory human review" for routine tasks — high-confidence output auto-flows, low-
confidence output surfaces to human.

**Implementation approach:**
1. Step prompt includes: "Rate your confidence in this output from 0.0 to 1.0 and explain why."
2. `step-executor.ts` parses the structured response to extract the score
3. Score stored in `StepExecution.confidenceScore`
4. Orchestrator checks score against `WorkflowTemplate.autoApproveThreshold` (default: 0.85)

**Why this works**: Low confidence = model uncertainty = human should review. High confidence =
model certainty + consistent with brand/org context = safe to proceed.

---

## Phase-by-Phase Application (Phases 62-66)

### Phase 62: Multi-step Workflow Engine
The foundational blueprint pattern. Establishes WorkflowExecution, StepExecution, orchestrator,
step types, and confidence gating. This is "one minion, one workflow, sequential steps."

**Key Minions principles applied:**
- One-shot per step (context-builder ensures each step has full, budget-constrained context)
- Walls before models (2-retry cap, human gates for external actions)
- System runs the model (orchestrator.ts drives; LLM responds to step prompts only)

### Phase 63: Parallel Agent Execution
Add parallelism — multiple workflow executions simultaneously. BullMQ concurrency control,
partial success model (`allSettled` not `allRejected`).

**Key Minions principles applied:**
- Parallelise over iterate (10 executions in parallel >> 1 execution × 10 iterations)
- Each execution is isolated (reads its own StepExecution chain, no shared state)

### Phase 64: AI Quality & Brand Voice Guardian
The mandatory human review gate applied to all content. Add confidence scoring to route
low-confidence content to human review; high-confidence auto-approved.

**Key Minions principles applied:**
- This IS the Minions "human review is load-bearing, not ceremonial" principle
- Confidence threshold becomes the primary quality gate

### Phase 65: Campaign Intelligence Engine
StepExecution.outputData + approval decisions feed back to prompt optimisation.

**Key Minions principles applied:**
- Context > model: improve context (prompts, examples) not model version
- Step output history as training signal for better context assembly

### Phase 66: Autonomous Insights Agent
The "minion invoked from a cron" pattern. Scheduled workflow executions triggered by Vercel
cron, bounded by circuit breakers.

**Key Minions principles applied:**
- Invocation from scheduling system (not just Slack/user)
- Circuit breakers = the Minions 2-round CI cap equivalent for scheduled agents

---

## Why This Architecture Wins for Synthex

1. **Reliability scales with constraints**: Each step is bounded. Total reliability = product of
   per-step reliability, but with retry+gate mechanism, we get closer to 99% than 77%.

2. **Human effort is targeted**: Humans only review what's uncertain or consequential. Routine
   AI steps auto-flow. This is sustainable at scale.

3. **Auditability**: Every WorkflowExecution and StepExecution is persisted. Full history of
   what the AI did, why, with what confidence, and who approved what.

4. **Cancellability**: Workflows can be cancelled at any step boundary. Unlike free-roaming
   LLM chains, the orchestrator always has control.

5. **Cost control**: Token budgets per step mean predictable AI costs. No runaway context.

---

## Files to Create in Phase 62

```
lib/workflow/
  orchestrator.ts       — advance steps, check gates, error handling (deterministic logic)
  step-executor.ts      — execute single step by type
  context-builder.ts    — assemble token-budgeted context for AI steps
  step-types/
    ai-generate.ts      — content generation with confidence scoring
    ai-analyse.ts       — classification/scoring/summarisation
    ai-enrich.ts        — add metadata/hashtags/CTAs
    human-approval.ts   — gate requiring human decision
    action-publish.ts   — push to social platform
    action-schedule.ts  — add to content calendar
    action-notify.ts    — send team notification

app/api/workflows/
  executions/
    route.ts            — POST (start) + GET (list)
    [id]/
      route.ts          — GET (execution + steps)
      approve/route.ts  — POST (approve current step)
      cancel/route.ts   — POST (cancel execution)
  templates/
    route.ts            — GET (list) + POST (create)

app/dashboard/workflows/
  page.tsx              — execution list + approval UI
```

---

## References

- Stripe Engineering Blog: "How we use LLMs to build LLM products" (Feb 2026)
- Block Goose: Open-source agent framework (Foundation for Minions)
- Anthropic Model Context Protocol: The protocol behind "Toolshed MCP"
- BullMQ: Redis-backed job queue (already in Synthex) — the async step execution layer
