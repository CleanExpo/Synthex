---
name: boardroom
description: Run a prompt through 2-3 model lenses in parallel (local Gemma + cheap cloud + senior Claude) and synthesise a single decision. Use for high-stakes choices where one voice is not enough.
operates_in: [L7, L8]
consumes_from: ceo-foundation.md, verification-gates.md
foundation_authority: ceo-foundation.md + verification-gates.md
---

# Boardroom — Multi-Model Triangulation

## When to invoke

- Strategic decisions worth more than $10K in opportunity cost
- Architectural calls where one wrong move costs days of rework
- Brand-voice gates on flagship content (Manifesto Opener, IICRC outreach, CCW commercials)
- Any time the user types "what does the boardroom think"

## When NOT to invoke

- Routine work (use `delegate.mjs --intent <routine-intent>` instead)
- Single-domain calls already covered by a specialist skill
- Anything where speed matters more than triangulation (boardroom is ~3× slower)

## How

1. Default panel: `[gemma4:e4b, deepseek/deepseek-v4-flash, anthropic/claude-sonnet-4-6]`
2. Default synthesiser: `anthropic/claude-sonnet-4-6`
3. Default escalation: `anthropic/claude-opus-4-7` when Jaccard agreement < 0.35
4. Programmatic: `import { boardroomQuery } from '@/lib/ai/boardroom'`
5. CLI: `node scripts/ai/delegate.mjs --intent boardroom-decision --input "<question>"` (single-lens shortcut)

## Output contract

The `BoardroomResponse` returns:
- `answer` — synthesised final
- `panel` — each lens's raw output (or error)
- `agreement` — 0..1 Jaccard score
- `escalated` — true if Opus tiebreaker fired
- `synthesisedBy` — which model produced `answer`

Surface all five fields when reporting back to the CEO.

## Foundation discipline

Same R-1 through R-7 rules as every other skill — see `.claude/memory/ceo-foundation.md`.
Every claim in the synthesised answer must be traceable to either a panel lens or
a foundation reference. No invented facts.
