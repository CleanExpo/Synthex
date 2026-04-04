---
name: rank-monitoring
category: search-dominance
version: 2.0.0
description: >-
  Real-time ranking check procedures, alert response workflows, and
  historical trend analysis for Australian search markets. Use when
  monitoring SERP positions, responding to ranking changes, tracking
  competitor movements, or analysing ranking trends.
priority: 3
triggers:
  - rank monitoring
  - serp tracking
  - ranking check
  - position tracking
  - competitor ranking
requires:
  - search-dominance/search-dominance.skill.md
---

# Rank Monitoring Skill

Procedures for monitoring search rankings, detecting changes, responding to
alerts, and analysing historical trends. Focused on Australian SERP data
with Brisbane-first priority.

## When NOT to Use This Skill

- When creating content or writing articles (use authority-curator)
- When discovering new market opportunities (use blue-ocean)
- When planning overall search strategy (use search-dominance)
- Instead use: `authority-curator.skill.md` for content, `blue-ocean.skill.md` for discovery

## Daily Monitoring Workflow

### Morning Check (09:00 AEST)

1. **Pull overnight ranking data** from DataForSEO and GSC
2. **Compare against previous day** — flag any position changes > 2
3. **Check AI Overview status** — are we cited? Were we removed?
4. **Review competitor movements** — any new entrants in top 10?
5. **Check alert queue** — process any CRITICAL alerts first
6. **Update tracking dashboard** — refresh all KPI displays
7. **Log daily snapshot** — append to historical data store

### Mid-Day Review (13:00 AEST)

1. **Re-check primary keywords** — confirm morning data holds
2. **Monitor for algorithm update signals** — industry chatter, tool data
3. **Review GSC impressions** — any unusual spikes or drops?
4. **Check mobile vs desktop** — any device-specific changes?

### End-of-Day Summary (17:00 AEST)

1. **Compile daily change report** — net position changes
2. **Flag emerging trends** — 3+ day directional movement
3. **Queue response actions** — for any triggered alerts
4. **Update weekly trend data** — rolling 7-day averages

## Check Frequency

| Keyword Type | Frequency | Tool | Priority |
|-------------|-----------|------|----------|
| Primary keywords (brand + top 5) | Daily | DataForSEO + GSC | CRITICAL |
| Secondary keywords (6-20) | 3x/week (Mon/Wed/Fri) | DataForSEO | HIGH |
| Long-tail keywords (21-50) | Weekly (Monday) | GSC batch | MEDIUM |
| Competitor brand terms | Daily | DataForSEO | HIGH |
| New content keywords | Daily for 30 days, then weekly | GSC | HIGH |
| AI Overview citations | Daily | Manual + DataForSEO | CRITICAL |

## Data Sources

### DataForSEO

```python
# Australian SERP check configuration
config = {
    "location": "Brisbane, Queensland, Australia",
    "location_code": 9069181,  # Brisbane geo target
    "device": "desktop",       # Also run for "mobile"
    "language": "en",
    "search_engine": "google.com.au",
    "depth": 100,              # Check top 100 results
    "check_spell": False,
    "calculate_rectangles": True  # For SERP feature detection
}
```

### SEMrush

```python
# Australian database configuration
config = {
    "database": "au",
    "display_limit": 100,
    "display_filter": "+|Po|Lt|20",  # Top 20 positions
    "export_columns": "Ph,Po,Pp,Nq,Cp,Co,Nr,Td,Kd"
}
```

### Google Search Console

```python
# GSC API configuration
config = {
    "site_url": "sc-domain:synthex.com.au",
    "country": "aus",
    "dimensions": ["query", "page", "device", "country"],
    "row_limit": 25000,
    "data_state": "final",  # Use "all" for fresher data
    "aggregation_type": "byPage"
}
```

## SERP Feature Tracking

Monitor these SERP features and track ownership:

| Feature | Priority | Detection Method | Impact |
|---------|----------|-----------------|--------|
| AI Overviews | CRITICAL | DataForSEO + manual | Highest — controls AI citations |
| Featured Snippets | HIGH | DataForSEO snippet detection | Direct answer visibility |
| People Also Ask (PAA) | HIGH | DataForSEO PAA extraction | Question ownership |
| Local Pack | HIGH | DataForSEO local results | Local business visibility |
| Knowledge Panel | MEDIUM | Manual + API check | Brand authority signal |
| Reviews (star ratings) | MEDIUM | Schema detection | CTR impact |
| Image Pack | LOW | DataForSEO image results | Visual search presence |
| Video Carousel | LOW | DataForSEO video results | Video content ROI |

### SERP Feature Response Matrix

| Feature Status | Our Content | Action |
|---------------|-------------|--------|
| Feature exists, we own it | Winning | Monitor, defend position |
| Feature exists, competitor owns it | Losing | Optimise content for feature format |
| Feature exists, nobody owns it | Opportunity | Create targeted content |
| Feature doesn't exist | N/A | Monitor for feature appearance |
| Feature removed | Was winning | Check for algorithm change |

## Alert Triggers

### CRITICAL (Immediate Response Required)

| Alert | Threshold | Response Time | Escalation |
|-------|-----------|---------------|------------|
| Lost #1 for primary keyword | Position 1 → 2+ | Within 2 hours | Content lead + SEO lead |
| Traffic drop > 30% | Day-over-day comparison | Within 4 hours | Full team alert |
| Competitor outranks on brand term | Any competitor in top 3 for brand | Within 2 hours | Brand protection protocol |
| AI Overview citation lost | Previously cited, now removed | Within 4 hours | GEO optimisation review |
| Manual action detected | GSC notification | Immediately | SEO lead + legal |

### WARNING (Same-Day Response)

| Alert | Threshold | Response Time |
|-------|-----------|---------------|
| Top 10 keyword moved 3+ positions | Any direction, single check | Within 8 hours |
| New competitor content detected | New page in top 20 for target keyword | Within 24 hours |
| Negative review posted | Google Business Profile, Trustpilot | Within 8 hours |
| Backlink lost from DA 40+ site | Ahrefs/DataForSEO alert | Within 24 hours |
| Core Web Vitals degradation | Any metric fails threshold | Within 24 hours |

### INFO (Weekly Review)

| Alert | Threshold | Review Cycle |
|-------|-----------|-------------|
| Minor position changes (1-2) | Any keyword | Weekly summary |
| New keyword opportunity | Appearing in GSC but not tracked | Weekly review |
| Backlink gained | Any new referring domain | Weekly summary |
| Impressions increase (untracked keyword) | > 100 impressions, not in keyword list | Weekly review |
| Competitor backlink activity | New links to competitor pages | Weekly analysis |

## Alert Response Procedures

### Procedure 1: Lost #1 Position

```
TRIGGER: Primary keyword drops from position 1

IMMEDIATE (0-2 hours):
1. Verify the drop is real (check multiple tools, clear cache)
2. Check if it's a temporary fluctuation (re-check in 1 hour)
3. Check for Google algorithm update (Search Engine Roundtable, GSC notices)

IF CONFIRMED (2-4 hours):
4. Analyse the page that took #1
   - What content do they have that we don't?
   - What's their word count, structure, schema?
   - Any new backlinks to their page?
   - Are they cited in AI Overview?

5. Audit our page
   - Content freshness (last updated date)
   - Technical SEO (Core Web Vitals, mobile usability)
   - Schema markup (complete and valid?)
   - Internal linking (sufficient?)

RESPONSE (4-24 hours):
6. Create content refresh plan
   - Add missing topics from competitor analysis
   - Update statistics and citations
   - Enhance schema markup
   - Add FAQ section if missing

7. Execute content refresh
   - Update the page
   - Submit for re-indexing via GSC
   - Monitor position daily for 14 days

ESCALATION (if not recovered in 14 days):
8. Full competitor gap analysis
9. Consider creating supporting content (topic cluster)
10. Review backlink strategy for the page
```

### Procedure 2: New Competitor Detected

```
TRIGGER: Unknown domain appears in top 20 for target keyword

ASSESSMENT (0-4 hours):
1. Identify the competitor (who are they?)
2. Check their DA, traffic estimates, content depth
3. Analyse their content strategy (are they targeting multiple keywords?)
4. Check their backlink profile
5. Determine if they're a threat or passing

IF THREAT CONFIRMED:
6. Map their keyword coverage vs ours
7. Identify content gaps we can exploit
8. Plan counter-content for their weaknesses
9. Monitor their backlink acquisition rate
10. Set up daily tracking for their key pages
```

### Procedure 3: SERP Feature Lost

```
TRIGGER: Previously owned Featured Snippet or PAA position lost

IMMEDIATE (0-2 hours):
1. Check if feature still exists (might have been removed entirely)
2. Identify who now owns the feature
3. Compare their content structure to ours

RESPONSE (2-24 hours):
4. Review our content's schema markup
5. Check content structure (H2/H3 hierarchy, table format)
6. Optimise specifically for the feature format:
   - Featured Snippet → Concise answer in first paragraph
   - PAA → Question/answer format, structured data
   - Local Pack → Google Business Profile completeness
7. Submit for re-indexing
8. Monitor daily for 7 days
```

## Historical Data Storage

### Data Point Schema

```json
{
  "keyword": "water damage Brisbane",
  "date": "2026-02-13",
  "time": "09:00",
  "timezone": "AEST",
  "position": {
    "desktop": 2,
    "mobile": 3
  },
  "previous_position": {
    "desktop": 1,
    "mobile": 2
  },
  "change": {
    "desktop": -1,
    "mobile": -1
  },
  "serp_features": {
    "ai_overview": true,
    "cited_in_ai": false,
    "featured_snippet": false,
    "paa": true,
    "local_pack": true,
    "image_pack": false
  },
  "competitors": {
    "competitor1.com.au": { "position": 1, "change": 0 },
    "competitor2.com.au": { "position": 3, "change": +1 },
    "competitor3.com.au": { "position": 5, "change": -2 }
  },
  "page_url": "/services/water-damage-restoration-brisbane",
  "impressions": 450,
  "clicks": 38,
  "ctr": 8.4,
  "avg_position_gsc": 2.1
}
```

### Historical Trend Analysis Patterns

#### Pattern 1: Gradual Decline

```
Day 1:  Position 1
Day 7:  Position 2
Day 14: Position 3
Day 21: Position 4

Diagnosis: Content aging or competitor improvement
Action: Content refresh, freshness signals, backlink campaign
```

#### Pattern 2: Sudden Drop + Recovery

```
Day 1:  Position 1
Day 2:  Position 8  ← Sudden drop
Day 5:  Position 3  ← Partial recovery
Day 10: Position 1  ← Full recovery

Diagnosis: Algorithm fluctuation or temporary indexing issue
Action: Monitor only — no intervention needed if pattern holds
```

#### Pattern 3: Volatility (Dancing)

```
Day 1: Position 2
Day 2: Position 5
Day 3: Position 1
Day 4: Position 6
Day 5: Position 3

Diagnosis: Google testing different results, or multiple pages competing
Action: Check for keyword cannibalisation, consolidate content if needed
```

#### Pattern 4: Competitor Surge

```
Day 1:  Our position 1, Competitor position 8
Day 7:  Our position 1, Competitor position 4
Day 14: Our position 2, Competitor position 1  ← Overtaken

Diagnosis: Competitor actively targeting this keyword
Action: Trigger Lost #1 procedure, deep competitor analysis
```

## Weekly Reporting Template

```
WEEKLY RANK REPORT — [Date Range]
==================================

SUMMARY:
  Keywords tracked: [N]
  Improved: [N] (avg +[X] positions)
  Declined: [N] (avg -[X] positions)
  Stable:   [N]
  New #1s:  [N]
  Lost #1s: [N]

TOP MOVERS:
  ↑ [keyword] +[N] positions (now #[X])
  ↑ [keyword] +[N] positions (now #[X])
  ↓ [keyword] -[N] positions (now #[X])
  ↓ [keyword] -[N] positions (now #[X])

SERP FEATURES:
  AI Overviews cited: [N/total]
  Featured Snippets owned: [N]
  PAA appearances: [N]

COMPETITOR ACTIVITY:
  [competitor] — [notable changes]

ACTIONS TAKEN:
  - [action description and result]

NEXT WEEK PRIORITIES:
  1. [priority item]
  2. [priority item]
```

## Error Handling

| Error | Action |
|-------|--------|
| API rate limit hit | Queue remaining checks, retry after cooldown |
| Data source unavailable | Use cached data, flag as stale |
| Conflicting data between tools | Use GSC as ground truth, note discrepancy |
| Keyword not found in SERP | Check for URL change, spelling, or deindexing |
| Historical data gap | Interpolate if < 3 days, flag if longer |

## Integration Points

- **search-dominance.skill.md** — Overall strategy context
- **blue-ocean.skill.md** — New opportunity discovery from monitoring data
- **authority-curator.skill.md** — Content refresh for declining keywords
- **australian-context.skill.md** — Australian locale defaults (AEST timezone)

## Verification Checklist

- [ ] All primary keywords checked daily
- [ ] Both desktop and mobile positions tracked
- [ ] AI Overview citation status current
- [ ] Competitor positions logged
- [ ] Alert thresholds correctly configured
- [ ] Historical data stored in correct format
- [ ] Weekly report generated and reviewed
- [ ] Response procedures followed for all alerts
- [ ] Data sourced from at least 2 tools for cross-reference
- [ ] Australian timezone (AEST/AEDT) used for all timestamps
