---
name: ceo-board-pipeline-integration
description: CEO Board integration layer — convene 9 personas for strategic decisions within the brand intelligence pipeline
---

# CEO Board Pipeline Integration

The CEO Board is convened when the brand intelligence pipeline encounters
decisions that exceed individual agent authority.

## Trigger Conditions

The orchestrator MUST convene the CEO Board when:

1. **Brand drift >25%** — A client's brand profile has changed significantly
2. **3+ consecutive budget overruns** — Pipeline consistently exceeds $8.00/run
3. **Monthly cost >$3,000** — Aggregate cost trigger
4. **Client escalation** — Senior PM flags a client issue requiring strategic input
5. **New market entry** — Client expanding to new geography or vertical

## Board Process

1. Orchestrator prepares a brief with:
   - The specific decision needed
   - Relevant data (cost history, drift metrics, client context)
   - Constraints and trade-offs

2. CEO Board agent receives the brief and runs deliberation:
   - 9 personas each provide their perspective
   - Contrarian challenges the majority
   - CEO synthesises into a decision memo

3. Decision memo is written to `output/admin/board-decisions/`

4. Senior PM creates a Linear issue for the decision with action items

## Decision Memo Format

```json
{
  "session_id": "board_20260329_0000",
  "trigger": "brand_drift",
  "client_id": "cli_001",
  "decision": "...",
  "rationale": "...",
  "dissent": "...",
  "change_conditions": ["...", "..."],
  "risk_to_watch": "...",
  "action_items": [
    {"owner": "...", "action": "...", "deadline": "..."}
  ]
}
```
