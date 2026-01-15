---
name: foundation-first-architecture
version: "1.0"
priority: 1
triggers:
  - foundation
  - persona
  - journey
  - psychology
  - user research
  - ux
  - emotional design
  - acceptance criteria
---

# Foundation-First Architecture

Build on psychology, personas, journeys, emotions, scenarios, quality, and metrics—BEFORE code.

## The 7-Layer Foundation

| Layer | Focus | Key Files |
|-------|-------|-----------|
| 7 | Business Alignment | AARRR metrics, sales funnel |
| 6 | Quality Standards | Nielsen heuristics, page scores |
| 5 | Acceptance Criteria | BDD scenarios (Gherkin) |
| 4 | Emotional Architecture | Step-by-step emotional states |
| 3 | Journey Mapping | Stages, steps, routes |
| 2 | User Definition | Personas with psychology |
| 1 | Psychology Foundation | Cialdini, Fogg, cognitive psychology |
| + | Structural | 8 missing states checklist |

## Psychology Quick Reference

**Cialdini's 7 Principles:** Reciprocity, Commitment, Social Proof, Authority, Liking, Scarcity, Unity

**Fogg Model:** Behavior = Motivation × Ability × Prompt

**AARRR Metrics:** Acquisition → Activation → Retention → Revenue → Referral

## The 8 Missing States

Every component needs: Empty, Loading, Error, Success, Partial, Offline, Permission, Confirmation

## Workflow

```bash
# 1. Define persona with psychology
cp .journeys/_templates/persona-enhanced.template.yaml .journeys/personas/my-user.yaml

# 2. Map core journey
cp .journeys/_templates/journey.template.yaml .journeys/journeys/core-journey.yaml

# 3. Add emotional architecture
cp .journeys/_templates/emotional-map.template.yaml .journeys/emotions/journey-emotions.yaml

# 4. Write acceptance criteria
cp .journeys/_templates/scenario.template.feature .journeys/scenarios/feature.feature
```

## The Shift

| Old Way | Foundation-First |
|---------|------------------|
| "Build a form" | "Enable user to commit to action" |
| "Add validation" | "Prevent user feeling stupid" |
| "Show error" | "Help user understand and fix" |
| "Track clicks" | "Measure journey conversion" |
| "Design page" | "Design all 8 states" |

## Rules

- Ask "which journey?" before coding
- Reference psychology in design decisions
- Check emotional states in code reviews
- Include journey context in bug reports
- No component ships without 8 states

See: `.journeys/`, `MASTER-INDEX.yaml`
