---
name: boardroom
description: Multi-model triangulation. Runs the same prompt through 2–4 LLMs in parallel (typically Gemma 4 local + DeepSeek V4 + Claude Sonnet) and synthesises a single answer that captures consensus, surfaces disagreement, and resolves divergence with senior reasoning. Auto-escalates to Claude Opus when panel divergence is high. Invoke for high-stakes decisions where one model's voice is not enough — brand strategy, architecture choices, sensitive client communications, copy with measurable conversion stakes. Skip for routine tasks (use standard intent routing instead).
operates_in: [L7, L8]
consumes_from: ceo-foundation.md, verification-gates.md
foundation_authority: ceo-foundation.md + verification-gates.md
---

# Boardroom — multi-model triangulation

A senior agency does not make important decisions with one voice. This skill runs the same prompt through a panel of 2–4 LLMs in parallel and synthesises a single answer that respects each panellist's perspective.

## When to invoke

Invoke for **high-stakes outputs** where the cost of a wrong call exceeds the cost of an extra panellist:

- Brand voice and creative critique — does this copy ship? (Claude Sonnet says yes, DeepSeek says no — what's the synthesis?)
- Architecture decisions — multi-tier reasoning beats single-model bias.
- Sensitive client communications — one model's tone might be off; three opinions catches it.
- Pricing / strategy choices — surface the disagreement explicitly rather than hide it.
- Anything where you're about to spend > AU$1,000 of execution effort on a recommendation.
- Any time the user types "what does the boardroom think"

**Do NOT invoke for routine tasks.** Routine work goes through the standard `routeIntent()` matrix → single model → done. Boardroom is the exception, not the default.

## How it works

1. **Fan out.** Same prompt hits every panellist via `Promise.allSettled`.
2. **Score divergence.** Pairwise Jaccard similarity across stem-tokenised outputs. Below the threshold (default 0.25) → divergence detected.
3. **Synthesise.** A senior synthesiser model (Sonnet by default) combines panel responses into one final answer. On divergence, escalates to Opus.
4. **Return** the synthesised answer plus each panellist's verbatim response and the divergence score so the caller can log to the cost ledger.

## Default panel

```ts
[
  { provider: 'ollama', modelId: 'gemma4:e4b' }, // local, $0
  { provider: 'openrouter', modelId: 'deepseek/deepseek-v4-flash' }, // cheap, fast
  { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' }, // senior
];
```

Synthesiser default: `anthropic/claude-sonnet-4-6`. Escalation default: `anthropic/claude-opus-4-7` when Jaccard agreement < 0.35.

Typical cost: **< AU$0.04 per decision** (one local call free, one DeepSeek call ~$0.0003, one Sonnet call ~$0.015, one Sonnet synthesis ~$0.020).

## Programmatic invocation

```ts
import { boardroomQuery } from '@/lib/ai/boardroom';

const result = await boardroomQuery({
  prompt: 'Should we run a paid Meta campaign for RestoreAssist next month?',
  systemPrompt:
    'You are a senior local-services performance marketer. Australian English. Numbers must be sourced or marked as estimate.',
  panel: [
    { provider: 'ollama', modelId: 'gemma4:e4b' },
    { provider: 'openrouter', modelId: 'deepseek/deepseek-v4-flash' },
    { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-4-6' },
  ],
  divergenceThreshold: 0.25,
});

console.log(result.answer); // synthesised final answer
console.log(result.escalated, result.minPairwiseSimilarity); // divergence telemetry
console.log(result.panel); // each panellist's verbatim response + latency
```

CLI shortcut: `node scripts/ai/delegate.mjs --intent boardroom-decision --input "<question>"`

## Output contract

The `BoardroomResponse` returns:

- `answer` — synthesised final
- `panel` — each lens's raw output (or error)
- `agreement` — 0..1 Jaccard score
- `escalated` — true if Opus tiebreaker fired
- `synthesisedBy` — which model produced `answer`

Surface all five fields when reporting back to the CEO.

## Hard rules

- **NEVER** use boardroom for tasks that route cleanly through a single intent in `lib/ai/task-routing.ts`. The matrix is the right tool for routine work.
- **NEVER** include more than 4 panellists per query. Beyond that, divergence scoring becomes noise and synthesis cost dominates.
- **NEVER** skip the synthesis step and concatenate panellist outputs into the final response. Synthesis is the value.
- **NEVER** swallow the panellist responses. Always return them in the response so the caller can audit which model said what.
- **ALWAYS** log the `escalated` flag + `minPairwiseSimilarity` to the cost ledger so divergence patterns surface over time.
- **ALWAYS** survive panellist failures gracefully via `Promise.allSettled`. If one model is down, the boardroom proceeds with the survivors.

## Anti-patterns

- **Boardroom-as-pad.** Throwing every routine question at the boardroom because "more opinions = better". It costs more, takes longer, and the synthesis blurs the answer. Use the matrix.
- **Cherry-picking the answer you wanted.** The synthesis step exists to capture disagreement, not bury it. If the synthesised answer disagrees with a panellist's view, that disagreement was the discovery — keep it.
- **Identical panellists.** Three Claudes is not a panel. The panel must span providers (or at minimum tiers within a provider) to surface real divergence.
- **No system prompt.** A panel without a shared system prompt produces apples-and-oranges responses; divergence then reflects framing, not substance. Always pin the system prompt.

## Foundation discipline

Same R-1 through R-7 rules as every other skill — see `.claude/memory/ceo-foundation.md`.
Every claim in the synthesised answer must be traceable to either a panel lens or a foundation reference. No invented facts.

## Files

- `lib/ai/boardroom.ts` — the implementation
- `lib/ai/task-routing.ts` — the routing matrix; intents `boardroom-decision` and `architecture-decision` flag triangulation
- `tests/unit/lib/ai/boardroom.test.ts` — unit coverage
