# Synthex Intelligent Pipeline Architecture

**Status:** Active — SYN-653 / SYN-651 (Board: Code Enhancement & Cleanup, Session 25)
**Last updated:** 2026-04-03

---

## Overview

The Synthex autonomous pipeline infrastructure combines three layers:

| Layer | Module | Purpose |
|---|---|---|
| **Routing** | `lib/ai/model-router.ts` | Route each AI task to cheapest model meeting quality threshold |
| **Execution** | `lib/pipelines/runner.ts` | Retry, validate output, log to `edge_function_logs` |
| **Recovery + Memory** | `lib/pipelines/adaptation.ts` | Adapt on failure modes; persist run memory to Knowledge Graph |

---

## Sequence: AI Advisor Pipeline Run

```
Client Scheduler
      │
      │  trigger('ai-advisor', clientIds)
      ▼
┌─────────────────────────────────────────────┐
│        createEdgeFunctionRunner()            │
│        (lib/pipelines/runner.ts)             │
│                                             │
│  for each clientId:                         │
│    1. call process(input, clientId)         │
│    2. validateOutput(output)                │
│    3. write edge_function_logs row          │
│    4. post Slack alert if partial/failed    │
└──────────────────────────────────────────────┘
           │
           │  process(input, clientId)
           ▼
┌─────────────────────────────────────────────┐
│         AI Advisor Pipeline Logic            │
│                                             │
│  routeTask({                                │
│    taskType: 'advisor_synthesis',           │  ◄── ModelRouter (SYN-652)
│    qualityThreshold: 'high',               │
│  })                                         │
│  → tier: 'complex', model: claude-opus-4-6  │
│                                             │
│  try:                                       │
│    result = await callModel(model, prompt)  │
│  catch (error):                             │
│    mode = classifyFailure(error)            │  ◄── FailureModeClassifier
│    strategy = adaptationChain[mode]        │  ◄── AdaptationChain (SYN-653)
│    revisedInput = await strategy.execute() │
│    result = await callModel(model, revised) │
│                                             │
│  await memoryWriter.write({                 │  ◄── PipelineMemoryWriter (SYN-653)
│    pipelineName: 'ai-advisor',             │
│    adaptationsTriggered: [...],            │
│    outputConfidenceScore: 0.91,            │
│    ...                                      │
│  })                                         │
│                                             │
│  return result                              │
└─────────────────────────────────────────────┘
           │
           │  actual_cost logged
           ▼
┌─────────────────────────────────────────────┐
│        pipeline_cost_ledger                  │
│        (Supabase — SYN-518)                 │
└─────────────────────────────────────────────┘
           │
           │  memory payload written
           ▼
┌─────────────────────────────────────────────┐
│        client_knowledge_entities             │
│        entity_type: 'pipeline_memory'        │
│        TTL: 90 days                          │
│        (Supabase pgvector — SYN-648)        │
└─────────────────────────────────────────────┘
```

---

## AdaptationChain — Failure Recovery

When a pipeline call fails, instead of retrying blindly, the `AdaptationChain` maps
failure modes to named recovery strategies:

```typescript
import { AdaptationChain, FailureModeClassifier } from '@/lib/pipelines/adaptation';

type AdvisorFailures =
  | 'stale_algorithm_data'
  | 'knowledge_graph_sparse'
  | 'email_delivery_failed';

const advisorChain: AdaptationChain<AdvisorFailures, AdvisorInput> = {
  stale_algorithm_data: {
    name: 'refetch-signals-and-rerun',
    execute: async (input) => ({
      ...input,
      signals: await fetchFreshSignals(input.clientId),
    }),
  },
  knowledge_graph_sparse: {
    name: 'fallback-to-multi-query',
    execute: async (input) => ({ ...input, queryMode: 'multi' }),
  },
  email_delivery_failed: {
    name: 'queue-for-next-run',
    execute: async (input) => ({
      ...input,
      queuedAt: new Date().toISOString(),
      priority: 'high',
    }),
  },
};

const classifyAdvisorFailure: FailureModeClassifier<AdvisorFailures> = (error) => {
  if (error.message.includes('algorithm_data')) return 'stale_algorithm_data';
  if (error.message.includes('knowledge_graph')) return 'knowledge_graph_sparse';
  if (error.message.includes('email')) return 'email_delivery_failed';
  return null; // unknown — escalate to runner retry
};
```

The `AdaptationChain` pattern provides:
- **Named strategies** — visible in `adaptationsTriggered` log field
- **Typed failure modes** — TypeScript enforces exhaustive handling
- **Graceful degradation** — pipelines return partial output instead of failing entirely

---

## PipelineMemory — Cross-Run Continuity

After each successful run, the pipeline writes a `PipelineMemoryPayload` to the
Knowledge Graph (`client_knowledge_entities`, entity_type: `pipeline_memory`).

```typescript
import { PipelineMemoryWriter, PipelineMemoryPayload } from '@/lib/pipelines/adaptation';

const payload: PipelineMemoryPayload = {
  pipelineName: 'ai-advisor',
  executedAt: new Date().toISOString(),
  clientId: 'org_abc123',
  recommendationsGenerated: 3,
  dataSourcesConsulted: ['authority_scores', 'posts', 'gbp_reviews'],
  adaptationsTriggered: ['refetch-signals-and-rerun'],
  outputConfidenceScore: 0.91,
  executionDurationMs: 4230,
};

await memoryWriter.write(payload);
```

On the next run, the pipeline can retrieve prior memory:

```typescript
const prior = await memoryWriter.readLatest(clientId, 'ai-advisor');
if (prior && prior.outputConfidenceScore < 0.5) {
  // Prior run had low confidence — use more conservative strategy this time
}
```

**TTL:** 90 days. Memory entities older than 90 days are purged by the weekly
`cleanup-pipeline-memory` Edge Function (SYN-654).

---

## ModelRouter Integration

Every AI call inside a pipeline goes through `routeTask()` from `lib/ai/model-router.ts`:

```typescript
import { routedCall } from '@/lib/ai/model-router';

const result = await routedCall({
  task: {
    taskType: 'advisor_synthesis',
    inputTokenEstimate: 2500,
    qualityThreshold: 'high',
    clientId,
    runId,
  },
  execute: async (modelId) => callOpenRouter(modelId, prompt),
  actualTokens: { input: actualInput, output: actualOutput },
});
```

The router selects `complex` tier (claude-opus-4-6) for `advisor_synthesis` with
`qualityThreshold: 'high'`. On rate limit, it escalates to... wait — `complex` is
already the highest tier. The caller should implement `AdaptationChain` for that case.

---

## Module Dependency Map

```
lib/ai/routing-config.ts      ← task tier mappings (edit to re-route)
         │
         ▼
lib/ai/model-router.ts        ← routeTask() + routedCall()
         │
         ▼
lib/pipelines/runner.ts       ← createEdgeFunctionRunner()
         │
         ├──► lib/pipelines/track-cost.ts   ← pipeline_cost_ledger
         │
         └──► lib/pipelines/adaptation.ts   ← AdaptationChain + PipelineMemoryWriter
                    │
                    ▼
              client_knowledge_entities     ← entity_type: 'pipeline_memory' (SYN-648)
```

---

## Related Issues

| Issue | Title | Status |
|---|---|---|
| SYN-518 | Pipeline cost tracking | Done |
| SYN-626 | createEdgeFunctionRunner factory | Done |
| SYN-648 | Per-client Knowledge Graph schema | Backlog |
| SYN-649 | Nightly KG construction Edge Function | Backlog |
| SYN-652 | ModelRouter 3-tier routing | Done (PR #32) |
| SYN-653 | AdaptationChain + PipelineMemory interfaces | Done |
| SYN-654 | pipeline_memory entity type + cleanup | Backlog |
