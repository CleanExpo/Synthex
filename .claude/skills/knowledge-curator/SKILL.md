---
name: knowledge-curator
description: >
  NotebookLM-style knowledge base management for the Synthex agent memory
  system. Operations: CAPTURE (create entries), QUERY (search and retrieve),
  MAINTAIN (freshness, archival, deduplication). Knowledge lives in
  `.claude/knowledge/`. Use when learning new facts, retrieving stored
  knowledge, or maintaining knowledge base health.
---

# Knowledge Base Curator

## Process

Invoke with one of three operations: CAPTURE, QUERY, or MAINTAIN.

1. **CAPTURE** -- create a new knowledge entry with metadata
2. **QUERY** -- search and retrieve entries efficiently
3. **MAINTAIN** -- update freshness, archive stale entries, merge duplicates

## Operation: CAPTURE

Create a new knowledge entry and register it in the index.

### Steps
1. Determine the appropriate domain (`architecture`, `deployment`, `marketing`, `seo`, `competitive`, or create new)
2. Generate entry ID: `{domain-prefix}-{NNN}` (e.g., `arch-004`, `deploy-002`)
3. Assign tags relevant to the content (3-8 tags recommended)
4. Calculate confidence score based on evidence quality (see Confidence Rubric)
5. Write entry file to `.claude/knowledge/domains/{domain}/`
6. Update `.claude/knowledge/index.json` with new entry metadata

### Entry Format
```markdown
---
id: {domain-prefix}-{NNN}
domain: {domain}
title: {Descriptive Title}
created: YYYY-MM-DD
updated: YYYY-MM-DD
freshness: current
confidence: {0.0-1.0}
evidence: {source files, URLs, or observations}
tags: [{tag1}, {tag2}, {tag3}]
---

# {Title}

## Summary
{200 words max -- concise overview for index loading}

## Detail
{Full knowledge content, structured with subsections as needed}

## Implications
{How this knowledge affects decisions, architecture, or workflows}
```

### Confidence Rubric

| Confidence | Range | Evidence Required |
|------------|-------|-------------------|
| Very High | 0.9-1.0 | Verified against source code, official docs, or direct observation |
| High | 0.7-0.89 | Confirmed from trusted secondary sources (MDN, Vercel docs, etc.) |
| Medium | 0.5-0.69 | Community consensus or reasonable inference from multiple signals |
| Low | 0.3-0.49 | Single unverified source or AI-generated without corroboration |
| Very Low | 0.0-0.29 | Speculation, outdated, or contradicted by other evidence |

### Domain Prefixes

| Domain | Prefix | Description |
|--------|--------|-------------|
| architecture | `arch` | Stack, patterns, data models |
| deployment | `deploy` | Hosting, CI/CD, infrastructure |
| marketing | `mktg` | Platforms, strategies, content |
| seo | `seo` | Search optimization, rankings |
| competitive | `comp` | Competitor analysis, market position |
| sessions | `sess` | Session-derived learnings |
| decisions | `dec` | Architectural and strategic decisions |
| patterns | `pat` | Reusable patterns and best practices |

## Operation: QUERY

Search and retrieve knowledge entries with token efficiency.

### Steps
1. Load `.claude/knowledge/index.json` (always load index first)
2. Filter entries by domain and/or tags matching the query
3. Return matching entry summaries (from index, not full files)
4. If deeper detail needed, load full entry files (max 5 per query)
5. Synthesize answer from retrieved entries

### Query Protocol
```
1. index.json        -- always loaded first (lightweight)
2. Entry summaries    -- from index, scan for relevance
3. Full entries       -- load only matching entries, max 5
```

### Token Efficiency Rules
- **Never** load all entries at once
- **Always** start with index.json
- **Max 5 entries** loaded per query
- **Summary first**: use index summaries to decide which full entries to load
- **Short-circuit**: if the index summary answers the question, do not load the full entry

### Search Matching
- **Domain filter**: exact match on domain field
- **Tag filter**: any tag intersection (entry matches if it shares >= 1 tag with query)
- **Text search**: keyword match against title and summary fields in index
- **Confidence filter**: optionally filter by minimum confidence threshold

## Operation: MAINTAIN

Keep the knowledge base accurate, current, and deduplicated.

### Steps
1. **Freshness audit**: scan all entries, flag those not updated in > 30 days
2. **Staleness detection**: check if source evidence has changed (files modified, deps updated)
3. **Archive stale entries**: move entries with `freshness: stale` to `.claude/knowledge/archive/`
4. **Merge duplicates**: identify entries with overlapping content (> 70% tag overlap + similar titles), merge into single authoritative entry
5. **Update index**: rebuild `index.json` to reflect all changes

### Freshness States

| State | Criteria | Action |
|-------|----------|--------|
| `current` | Updated within 30 days and evidence unchanged | None |
| `aging` | Updated 30-90 days ago or evidence partially changed | Flag for review |
| `stale` | Updated > 90 days ago or evidence invalidated | Archive or update |

### Maintenance Schedule
- **On every CAPTURE**: verify no duplicate exists before creating
- **On session END**: run freshness check on entries touched during session
- **Weekly**: full maintenance sweep (freshness audit + deduplication scan)

### Archive Protocol
- Move stale entries to `.claude/knowledge/archive/{domain}/`
- Remove archived entries from `index.json`
- Retain archived files for 90 days, then delete
- Log all archive actions in maintenance report

## Output Format

### CAPTURE Output
```markdown
## Knowledge Captured
- **ID**: {id}
- **Domain**: {domain}
- **Title**: {title}
- **Confidence**: {score}
- **Tags**: {tags}
- **File**: `.claude/knowledge/domains/{domain}/{filename}`
- **Index updated**: Yes
```

### QUERY Output
```markdown
## Knowledge Query Results
- **Query**: {original query}
- **Matches**: {count}
- **Entries loaded**: {count of full entries read}

### Results
1. **{title}** ({id}, confidence: {score})
   {summary}
2. ...

### Synthesis
{Combined answer drawn from retrieved entries}
```

### MAINTAIN Output
```markdown
## Maintenance Report
- **Entries scanned**: {count}
- **Current**: {count}
- **Aging**: {count} (flagged for review)
- **Stale**: {count} (archived)
- **Duplicates merged**: {count}
- **Index rebuilt**: Yes/No
```
