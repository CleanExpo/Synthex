---
template: research-brief
version: 1.0
---

# Research Brief: {{title}}

**Researcher**: {{agent}}
**Date**: {{date}}
**Domain**: {{domain}}
**Confidence**: {{confidence}}

---

## Research Question
{{question}}

## Key Findings

{{findings}}

## Evidence Chain

| # | Source | Tier | Confidence | Finding |
|---|--------|------|------------|---------|
{{evidence_rows}}

## Analysis
{{analysis}}

## Implications for Synthex
{{implications}}

## Recommendations
{{recommendations}}

## Open Questions
{{open_questions}}

## Knowledge Base
- [ ] Entry created in `.claude/knowledge/domains/{{domain}}/`
- [ ] Index updated
