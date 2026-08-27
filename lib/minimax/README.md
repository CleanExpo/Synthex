# MiniMax API Module

Drop-in MiniMax (Anthropic-compatible) client with **built-in credit protection**.

## Files

| File | Purpose |
|------|---------|
| `pricing.ts` | Canonical pricing table + cost computation |
| `credit-guard.ts` | Redis-backed atomic budget enforcement |
| `client.ts` | Anthropic SDK wrapper with caching |
| `cache/prefix-cache.ts` | Auto cache_control tagging helpers |
| `index.ts` | Public barrel exports |

## Environment Variables

Add to `.env.local`:

```bash
# Required: MiniMax Subscription Key (Token Plan) or Pay-as-you-go API key
MINIMAX_API_KEY=sk-cp-xxxxxxxx

# Optional: hard monthly USD ceiling. Default: 50
MINIMAX_MONTHLY_CEILING_USD=50

# Optional: daily USD soft cap. Unset = no daily limit
MINIMAX_DAILY_CEILING_USD=10

# Optional: percent of monthly at which to warn. Default: 75
MINIMAX_WARN_THRESHOLD_PERCENT=75
```

## Quick Start

```typescript
import {
  callMiniMax,
  creditGuard,
  withSystemCache,
  getCacheStats,
  type MiniMaxModelId,
} from "@/lib/minimax";

// 1. Simple chat
const r1 = await callMiniMax({
  model: "MiniMax-M2.7",                  // 50% cheaper than M3 for most tasks
  system: withSystemCache("You are a senior code reviewer."),  // auto-cached
  messages: [{ role: "user", content: "Review this PR: ..." }],
  maxTokens: 2048,
  disableThinking: true,                   // skip reasoning for cheap Q&A
});

console.log(r1.usage.actualCostUsd);        // true USD cost of this call

// 2. Check budget
const snap = await creditGuard.snapshot();
console.log(`Used: $${snap.monthlySpentUsd.toFixed(4)} of $${snap.monthlyCeilingUsd}`);
console.log(`Remaining: $${snap.monthlyRemainingUsd.toFixed(4)}`);

// 3. Cache stats
const stats = getCacheStats();
console.log(`Hit rate: ${(stats.cacheHits / stats.totalCalls * 100).toFixed(1)}%`);
```

## Cost Optimization Checklist

- [x] Use `MiniMax-M2.7` instead of `MiniMax-M3` unless you need coding/vision/1M context
- [x] Use `MiniMax-M2.7` (not `-highspeed`) when latency isn''t user-facing
- [x] Wrap static system prompts with `withSystemCache()` (saves ~67%)
- [x] Set `disableThinking: true` for simple Q&A (saves output tokens)
- [x] Set `serviceTier: "standard"` (priority = 1.5x cost)
- [x] Set `maxTokens` conservatively (e.g. 1024 for short answers)
- [x] Use `detail: "low"` for images when possible (not yet exposed)
- [x] Watch the credit guard snapshot — it stops requests at the ceiling

## Pricing Reference (per 1M tokens, USD)

| Model | Input | Output | Cache Read | Notes |
|-------|-------|--------|------------|-------|
| MiniMax-M3 =512k | $0.60 | $2.40 | $0.12 | Frontier, 1M context |
| MiniMax-M3 >512k | $1.20 | $4.80 | $0.24 | Long context doubles cost |
| MiniMax-M2.7 | $0.30 | $1.20 | $0.06 | Best balance |
| MiniMax-M2.7-highspeed | $0.30 | $2.40 | $0.06 | Same input, 2x output cost |
| MiniMax-M2.5/M2.1/M2 | $0.30 | $1.20 | $0.03 | Legacy, cheapest |

Source: https://platform.minimax.io/docs/guides/pricing-paygo
