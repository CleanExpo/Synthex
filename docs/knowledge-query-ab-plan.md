# Knowledge Graph Advisor — A/B Evaluation Plan

**Linear:** SYN-650
**Feature flag:** `KNOWLEDGE_GRAPH_ADVISOR=true`
**Date:** 2026-04-04

---

## Hypothesis

Enriching the AI Advisor prompt with semantically-retrieved knowledge graph context
(hybrid pgvector + graph traversal) produces more specific, higher-quality recommended
actions than the baseline `gatherOrgContext()` approach alone.

---

## Control vs Treatment

| Group | Path | Description |
|---|---|---|
| **Control** | `KNOWLEDGE_GRAPH_ADVISOR` unset / `false` | Standard `gatherOrgContext()` — digest history, seasonal signals, authority score, GBP reviews, competitor gap |
| **Treatment** | `KNOWLEDGE_GRAPH_ADVISOR=true` | Same baseline + top-8 KG results via `queryKnowledge()` injected into the prompt as "Knowledge Graph Insights" block |

**Fallback rule:** If `queryKnowledge()` returns `[]` (entity count < 10 or embedding failure),
the treatment org silently falls back to the control path. These orgs are excluded from
treatment-group measurement.

---

## Rollout Plan

### Phase 1 — Internal (Week 1–2)
- Enable on Synthex-internal org only (`KNOWLEDGE_GRAPH_ADVISOR=true` in Vercel preview env)
- Manual review: compare generated actions side-by-side with control output
- Gate: KG entity count ≥ 10 for at least 3 consecutive weekly runs

### Phase 2 — Pilot (Week 3–4)
- Enable for pilot cohort: 5 orgs with ≥ 10 KG entities and ≥ 4 weeks of digest history
- Measure primary metrics (see below) over 2 weekly advisor cycles
- Gate: primary metric improvement ≥ 10% over control OR no regression

### Phase 3 — Broad rollout (Week 5+)
- Graduate to all orgs with entity count ≥ 10
- Monitor secondary metrics weekly
- Retire flag and make KG path the default after 4 weeks of stable performance

---

## Metrics

### Primary (tracked per weekly advisor run)

| Metric | Source | How to Query |
|---|---|---|
| `data_specificity_score` | Human reviewer (1–5 scale) | Manual audit of 10 sampled actions/week |
| `generic_action_rate` | Automated | Count `validateActions()` rejections / total actions generated |
| `avg_confidence` | `edge_function_logs.output_metadata` | `AVG((output_metadata->>'avg_confidence')::float)` WHERE function_name='ai-advisor' |

### Secondary (tracked monthly)

| Metric | Source | Goal |
|---|---|---|
| Client advisor email open rate | Email analytics | ≥ baseline (establish in Phase 1) |
| Action click-through rate | Dashboard analytics | ≥ baseline |
| Recommended action status change (generated → actioned) | `recommended_actions.status` | +5% over control |

### Cost guardrails

| Resource | Limit | Alert trigger |
|---|---|---|
| OpenAI embedding tokens (query) | ~350 tokens/org/week (1 `queryKnowledge` call) | N/A — negligible at $0.02/1M |
| Claude prompt tokens | ≤ 500 additional tokens from KG context block | Monitor via `edge_function_logs` |
| Total weekly KG query cost | < $0.01/org | Alert if > $0.05/org/week |

---

## Measurement Queries

```sql
-- Weekly avg_confidence by path (requires a KG path tag added to resultsSummary)
SELECT
  DATE_TRUNC('week', created_at) AS week,
  AVG((output_metadata->>'avg_confidence')::float) AS avg_confidence,
  COUNT(*) AS orgs_run
FROM edge_function_logs
WHERE function_name = 'ai-advisor'
  AND created_at > NOW() - INTERVAL '8 weeks'
GROUP BY 1
ORDER BY 1 DESC;

-- Generic action rejection rate
SELECT
  DATE_TRUNC('week', created_at) AS week,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::float
    / NULLIF(COUNT(*), 0) AS error_rate
FROM edge_function_logs
WHERE function_name = 'ai-advisor'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## Success / Failure Criteria

**Promote to default (retire flag) if, over Phase 3:**
- Generic action rate in treatment ≤ control
- avg_confidence in treatment ≥ control − 0.05 (no meaningful regression)
- No increase in LLM cost > 20% per org

**Roll back (disable flag) if:**
- Generic action rejection rate in treatment > control by ≥ 20%
- Any org generates KG-sourced actions that contain hallucinated data
- avg_confidence drops below 0.4 for treatment group

---

## Implementation Notes

- **KG enrichment is non-fatal**: if `queryKnowledge()` throws, `processOrg` catches and
  logs a warning, then falls back to the standard context path. No error surfaces to the run result.
- **Minimum entity gate** (`KG_MIN_ENTITY_THRESHOLD = 10`): Prevents noise from under-populated
  graphs. `queryKnowledge()` returns `[]` when count < 10.
- **Source citations**: Each KG result includes `[Source: {source_system} — {entity_name}]`.
  These appear in the KG context block injected into the Claude prompt, not in the final
  client-facing action output.
- **Deduplication**: The KG path does NOT replace digest/seasonal/authority context — it adds
  to it. No risk of losing the existing data signals.

---

## References

- `lib/knowledge-query.ts` — Retrieval implementation
- `lib/knowledge-graph/types.ts` — Entity/edge type definitions
- `app/api/internal/generate-advisor-brief/route.ts` — Integration point (search `KNOWLEDGE_GRAPH_ADVISOR`)
- `prisma/migration-2026-04-04-syn648-654-knowledge-graph.sql` — Schema
