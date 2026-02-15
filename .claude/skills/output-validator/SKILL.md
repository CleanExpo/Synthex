---
name: output-validator
description: >
  Quality scoring skill that evaluates outputs across 4 dimensions:
  completeness, accuracy, formatting, and actionability. Produces a weighted
  final score with pass/review/fail gates. Use when validating deliverables,
  reviewing agent output, or enforcing quality standards before publishing.
---

# Output Quality Validator

## Process

1. **Receive output** -- accept the deliverable to be scored along with its context (task description, requirements, target audience)
2. **Score each dimension** -- evaluate the output on all 4 dimensions using the rubrics below, assigning a score from 0-100 for each
3. **Calculate weighted average** -- apply dimension weights to produce the final composite score
4. **Apply gate** -- determine PASS, REVIEW, or FAIL based on final score thresholds
5. **Generate feedback** -- for REVIEW and FAIL results, provide specific improvement recommendations per dimension
6. **Return verdict** -- output the scorecard with per-dimension scores, final score, gate result, and feedback

## Scoring Dimensions

### 1. Completeness (Weight: 30%)

Does the output address every requirement in the task?

| Score Range | Criteria |
|-------------|----------|
| 90-100 | All requirements addressed; includes edge cases and bonus considerations |
| 70-89 | All core requirements met; minor gaps in secondary concerns |
| 50-69 | Most requirements met; 1-2 significant omissions |
| 30-49 | Multiple requirements missing; partial coverage only |
| 0-29 | Majority of requirements unaddressed |

### 2. Accuracy (Weight: 30%)

Are claims, code, configurations, and references correct?

| Score Range | Criteria |
|-------------|----------|
| 90-100 | All facts verified; code compiles/runs; configs are valid; zero known errors |
| 70-89 | Substantively correct; minor inaccuracies that do not affect functionality |
| 50-69 | Generally correct but contains 1-2 material errors |
| 30-49 | Multiple factual or functional errors; unreliable without revision |
| 0-29 | Fundamentally incorrect or misleading |

### 3. Formatting (Weight: 15%)

Is the output well-structured, readable, and consistent?

| Score Range | Criteria |
|-------------|----------|
| 90-100 | Clean structure; consistent style; proper markdown/code formatting; scannable headings |
| 70-89 | Good structure with minor inconsistencies |
| 50-69 | Readable but disorganized; inconsistent formatting |
| 30-49 | Poorly structured; hard to follow |
| 0-29 | No discernible structure; wall of text or broken formatting |

### 4. Actionability (Weight: 25%)

Can the recipient act on this output immediately?

| Score Range | Criteria |
|-------------|----------|
| 90-100 | Clear next steps; copy-paste ready code/configs; specific recommendations with rationale |
| 70-89 | Actionable with minor clarification needed |
| 50-69 | Requires interpretation; vague recommendations |
| 30-49 | Unclear what to do next; theoretical without practical guidance |
| 0-29 | No actionable content |

## Gate Thresholds

| Gate | Score Range | Action |
|------|------------|--------|
| PASS | >= 80 | Output accepted; proceed to next step |
| REVIEW | 60-79 | Output returned with specific improvement notes; one revision allowed |
| FAIL | < 60 | Output rejected; must be regenerated from scratch with feedback incorporated |

## Gate Rules

- Any single dimension scoring below 40 triggers automatic FAIL regardless of final score
- Two or more dimensions below 60 triggers automatic REVIEW regardless of final score
- REVIEW outputs that fail a second scoring are escalated to FAIL

## Output Format

```markdown
## Quality Scorecard

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Completeness | XX/100 | 30% | XX.X |
| Accuracy | XX/100 | 30% | XX.X |
| Formatting | XX/100 | 15% | XX.X |
| Actionability | XX/100 | 25% | XX.X |
| **Final Score** | | | **XX.X/100** |

### Gate: PASS / REVIEW / FAIL

### Feedback
- **Completeness**: [specific observations]
- **Accuracy**: [specific observations]
- **Formatting**: [specific observations]
- **Actionability**: [specific observations]

### Improvement Recommendations
1. [Highest-priority fix]
2. [Second-priority fix]
3. [Third-priority fix]
```
