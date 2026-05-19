# Karpathy Research Council Integration

Date: 2026-05-19
Status: Sandbox implementation

## Sources Researched

- `karpathy/llm-council`: parallel first opinions, anonymous peer review, chair synthesis.
- `karpathy/autoresearch`: fixed-budget experiment loop, single metric, keep/discard discipline.
- `multica-ai/andrej-karpathy-skills`: think before coding, simplicity first, surgical changes, goal-driven verification.

## Synthex Implementation

The implementation is intentionally small and service-layer only:

```text
lib/unite-command-center/research/research-council.schema.ts
lib/unite-command-center/research/research-council.service.ts
```

The service builds a `ResearchCouncilPacket` from a `BoardInput`.

It captures:

- council route,
- source-backed findings,
- confidence score,
- risks,
- open questions,
- approval gate,
- outcome learning criteria.

Requests mentioning Obsidian, Hermes, Palantir/ontology, source evidence,
Karpathy, or council-style review now route to `research-council`.

## Operating Rule

The council does not call providers directly. It prepares structured packets
that later provider adapters can use. Missing evidence blocks production.

## Verification

Focused tests:

```bash
npm test -- --runInBand tests/unit/unite-command-center/research-council.test.ts tests/unit/unite-command-center/contracts.test.ts tests/unit/unite-command-center/hermes-handoff.test.ts
```

Status: passing.
