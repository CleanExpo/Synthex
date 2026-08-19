# agentic-marketing-intelligence

A research→verify→score→plan→improve skill for SEO / AEO / GEO across the Unite-Group portfolio.
It is an **orchestrator**: it sits above the existing local-SEO skill family and adds cross-portfolio
claim verification + confidence-adjusted prioritisation. It never fabricates metrics.

## Where it sits in the ecosystem

```
                 agentic-marketing-intelligence  (this skill — scoring + prioritisation)
                          │ consumes output of ▼
   ┌──────────────────────┼───────────────────────────────────────────┐
   │ algorithm-knowledge-base   google-search-console   google-business-profile │
   │ local-seo-agent            google-updates-sentinel competitive-local-strategy │
   └──────────────────────────────────────────────────────────────────┘
```

It does **not** re-implement GBP optimisation, GSC fetching, or local-pack tactics — those skills own
that. This skill turns their signals into a single prioritised, confidence-gated, human-approved backlog.

## Quick start

1. Decide scope projects + which data sources are live (`inputs.schema.json`).
2. Run the 7-agent workflow in `workflow.md` (Cartographer → YouTube → Verify → Math → Strategist →
   Skill-builder → Orchestrator).
3. Output conforms to `outputs.schema.json` and lands in `docs/marketing-intelligence/`.
4. Nothing publishes without the gates in `human-approval-gates.md`.

## Integrity model (read this)

- Confidence labels reuse `algorithm-knowledge-base`: `CONFIRMED/LEAKED/INFERRED/SPECULATIVE/UNVERIFIED/OPINION_SOURCE`.
- Every score carries a `DataStatus`. A score on placeholder inputs returns `confidenceFactor ≤ 0.1`
  and `dataStatus: 'DATA_REQUIRED'` — the backlog hides it from auto-execution.
- Master prioritiser: `(impact · confidence) / risk`. See `scoring-models.ts` →
  `confidenceAdjustedAction()`.

## Type-checking

`scoring-models.ts` + `types.ts` are self-contained and pass:

```
npx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --target ES2020 \
  lib/marketing-intelligence/types.ts \
  lib/marketing-intelligence/scoring-models.ts
```
