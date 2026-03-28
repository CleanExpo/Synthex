# Pipeline Cost Tracking Schema

> Referenced by: SYN-491, UNI-1661, QUALITY-STANDARDS.md

## Overview

Every pipeline run generates a cost summary. This schema must be followed exactly.

## File Location

```
logs/platform-summary-{run_id}.json
```

Where `run_id` = `run_{YYYYMMDD}_{HHmm}` (e.g., `run_20260329_0000`)

## Full Schema

```typescript
import { PipelineRunSummary } from '@/shared/types';
```

See `shared/types/brand-intelligence.ts` for the complete TypeScript interface.

## Cost Budget Model

```
┌─────────────────────────────────────┐
│         BUDGET: $8.00/run           │
├─────────────────────────────────────┤
│ Orchestrator (Opus)      │ ~$1.50  │
│ CEO Board (if convened)  │ ~$1.00  │
│ Research × N clients     │ ~$0.30/c│
│ Analyst × N clients      │ ~$0.20/c│
│ Content × N clients      │ ~$0.15/c│
│ SEO × N clients          │ ~$0.03/c│
│ Compliance × N clients   │ ~$0.02/c│
│ Senior PM                │ ~$0.20  │
├─────────────────────────────────────┤
│ 10 clients, no board     │ ~$5.50  │
│ 10 clients, with board   │ ~$6.50  │
│ 50 clients (projected)   │ ~$36.50 │
│   → Requires tier/batch  │         │
└─────────────────────────────────────┘
```

## Token-to-Cost Conversion

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-haiku-4-5 | $0.80 | $4.00 |

Cost formula per agent run:
```
cost_usd = (input_tokens / 1_000_000 * input_rate) + (output_tokens / 1_000_000 * output_rate)
```

## Validation

After every run, validate:
1. `total_usd` = sum of all `per_client` values
2. `total_usd` = sum of all `per_agent` values  
3. `budget_remaining_usd` = 8.00 - `total_usd`
4. No `per_client` value exceeds $2.00 (anomaly threshold)
5. `budget_remaining_usd` >= 0 (run stopped before exceeding)
