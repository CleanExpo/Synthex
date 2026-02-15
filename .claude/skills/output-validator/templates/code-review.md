---
template: code-review
version: 1.0
---

# Code Review: {{title}}

**Reviewer**: {{agent}}
**Date**: {{date}}
**Files**: {{file_count}} files reviewed

---

## Summary

{{summary}}

## Scoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| Completeness | {{completeness}}/100 | {{completeness_notes}} |
| Accuracy | {{accuracy}}/100 | {{accuracy_notes}} |
| Formatting | {{formatting}}/100 | {{formatting_notes}} |
| Actionability | {{actionability}}/100 | {{actionability_notes}} |
| **Overall** | **{{overall}}/100** | **{{gate}}** |

## Findings

### Critical Issues
{{critical_issues}}

### Improvements
{{improvements}}

### Positive Patterns
{{positive_patterns}}

## Recommendations
{{recommendations}}
