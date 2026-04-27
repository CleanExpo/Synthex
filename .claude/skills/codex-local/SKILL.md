---
name: codex-local
description: Wrapper around the Codex CLI bound to a cheap backend (DeepSeek V4 Flash via OpenRouter, or local Gemma 4 via Ollama) for code-specific tasks with diff-based UX.
operates_in: [L1, L2, L3]
consumes_from: ceo-foundation.md, verification-gates.md
foundation_authority: ceo-foundation.md + verification-gates.md
---

# Codex Local — Cheap Code Lens

## When to invoke

- Multi-file refactor where a diff-first UX is faster than read-edit-write loops
- Code generation where DeepSeek V4 Flash (81% SWE-bench) is cheaper than Sonnet
- Local code work that can tolerate Gemma's mediocre code quality and zero cost matters more

## Default backend (cloud)

```bash
OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
OPENAI_API_KEY=$OPENROUTER_API_KEY \
OPENAI_MODEL=${CODEX_DEFAULT_MODEL:-deepseek/deepseek-v4-flash} \
codex <command>
```

## Offline backend (local Gemma)

```bash
OPENAI_BASE_URL=http://localhost:11434/v1 \
OPENAI_API_KEY=ollama-local \
OPENAI_MODEL=gemma4:e4b \
codex <command>
```

## Output contract

Codex returns a unified diff. The skill MUST:
1. Show the diff to the CEO (no auto-apply on >10-line changes)
2. Note the backend used (cloud vs offline)
3. Note approximate token cost (cloud only) or "$0 local" (offline)

## Trade-off table

| Backend | Cost | Code quality | Privacy | Speed |
|---|---|---|---|---|
| OpenRouter → DeepSeek V4 Flash | $0.28/M | Strong (81% SWE-bench) | Cloud | Fast |
| Local Ollama → Gemma 4 E4B | $0 | Mediocre | Stays on laptop | Slow (~5 tok/s) |

Default to cloud unless the task is sensitive or offline-required.

## Pre-merge gate

Codex output must pass: `npm run type-check && npm run lint && npm test` before merge.
This is non-negotiable per `.claude/rules/verification-gate.md`.
