---
name: pre-seo-task
type: hook
trigger: SEO-related tasks
priority: 2
blocking: false
version: 1.0.0
---

# Pre-SEO-Task Hook

Runs before SEO-related tasks to load Australian market context.

## Trigger Conditions

- Keyword research
- Content optimization
- Ranking analysis
- Competitive analysis
- Blue Ocean discovery

## Actions

### 1. Load Australian Market Context
```
Load skills:
- australian-context.skill.md (en-AU, regulations)
- geo-australian.skill.md (Australian GEO)
- search-dominance.skill.md (strategy)
```

### 2. Load Market Data
```
Load:
- Primary markets: Brisbane, Sydney, Melbourne
- Australian regulations
- Local search patterns
- Competitor data (Australian market)
```

### 3. Set SERP Parameters
```python
location = "Brisbane, Queensland, Australia"
language = "en"
country = "au"
device = "desktop"  # Also check mobile
```

### 4. Load Ranking History
```
IF tracking keyword:
  Load historical ranking data
  Load competitor positions
  Load SERP features history
```

## Integration

Called automatically when SEO Intelligence agent is invoked.
