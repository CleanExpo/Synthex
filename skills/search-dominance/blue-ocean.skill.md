---
name: blue-ocean
category: search-dominance
version: 2.0.0
description: >-
  Opportunity discovery and exploitation for uncontested search market spaces.
  Use when discovering new keyword territories, identifying market gaps,
  scoring untapped opportunities, or finding underserved search segments.
priority: 2
triggers:
  - blue ocean
  - opportunity discovery
  - market gap
  - untapped keywords
  - underserved segment
requires:
  - search-dominance/search-dominance.skill.md
---

# Blue Ocean Skill

Discovering uncontested market spaces in search where competition is minimal
and opportunity is high. Systematically identifies, scores, and prioritises
untapped search territories.

## When NOT to Use This Skill

- When optimising for existing, established keywords (use search-dominance)
- When the task is content creation, not opportunity discovery
- When doing competitive analysis on known competitors (use rank-monitoring)
- Instead use: `search-dominance.skill.md` for existing keyword strategy

> **Overlap note**: Opportunity discovery for uncontested spaces. For existing keyword optimisation, use `search-dominance.skill.md`

## Heat Signature Scanning

### Sources to Mine

1. **Adjacent problems** — What do people search before/after the core topic?
   - Map the search journey: Problem → Research → Solution → Purchase
   - Example: "water damage" → "mould inspection" → "dehumidifier hire Brisbane"

2. **Question mining** — Extract real questions from forums and SERP features
   - Reddit (r/brisbane, r/AusProperty, r/AusFinance)
   - Quora (Australian-tagged questions)
   - People Also Ask (PAA) chains — follow 3 levels deep
   - Google Autocomplete suggestions (a-z prefix method)

3. **Emerging trends** — Catch rising topics before competitors
   - Google Trends (filter: Australia, past 12 months)
   - News alerts for industry terms
   - Legislative changes (new Australian regulations)
   - Technology shifts affecting the industry

4. **Underserved segments** — Groups with needs but poor content
   - Strata managers / body corporate committees
   - Property managers (residential and commercial)
   - Tradie-to-tradie referral networks
   - Regional Queensland markets (not just Brisbane CBD)

5. **Format gaps** — Content type mismatches
   - Video where competitors only do text
   - Interactive tools where competitors only have static pages
   - Comparison tables where competitors only have lists
   - Calculators/estimators where competitors only have "call us"

6. **Language opportunities** — Non-English speakers in AU
   - Mandarin, Vietnamese, Hindi, Arabic communities
   - Suburb-level demographic analysis
   - Bilingual content strategy

## Opportunity Scoring

### Formula

```
Score = (Volume × Growth × Gap) / Competition

Where:
  Volume      = Monthly search volume normalised to 0-100
  Growth      = Year-over-year growth rate normalised to 0-100
  Gap         = Content quality gap (how poor existing results are) 0-100
  Competition = Number of strong competitors (domain authority > 30)
```

### Score Interpretation

| Score | Action | Timeline |
|-------|--------|----------|
| 80+ | IMMEDIATE ACTION — Blue Ocean found | This week |
| 60-79 | HIGH PRIORITY — Strong opportunity | Within 2 weeks |
| 40-59 | QUEUE — Worth pursuing when capacity allows | Within month |
| < 40 | MONITOR — Track but don't invest yet | Quarterly review |

### Scoring Factors Detailed

**Volume (0-100)**:
| Range | Searches/month | Classification |
|-------|----------------|----------------|
| 0-20 | < 100 | Niche |
| 21-40 | 100-500 | Emerging |
| 41-60 | 500-2,000 | Moderate |
| 61-80 | 2,000-10,000 | Strong |
| 81-100 | 10,000+ | High volume |

**Growth (0-100)**:
| Range | YoY Change | Classification |
|-------|------------|----------------|
| 0-20 | Declining or flat | Stagnant |
| 21-40 | 1-10% growth | Slow |
| 41-60 | 10-30% growth | Healthy |
| 61-80 | 30-100% growth | Fast |
| 81-100 | 100%+ growth | Breakout |

**Gap (0-100)**:
| Range | Existing Content | Opportunity |
|-------|-----------------|-------------|
| 0-20 | Excellent content exists | Well covered |
| 21-40 | Good but improvable | Moderate |
| 41-60 | Mediocre quality | Clear gap |
| 61-80 | Poor content | Major opportunity |
| 81-100 | Almost nothing exists | Wide open |

**Competition (divisor — lower = better)**:
| Count | Classification | Recommendation |
|-------|----------------|----------------|
| 1-2 | Almost none | Ideal blue ocean |
| 3-5 | Light | Good opportunity |
| 6-10 | Moderate | Proceed with strong content |
| 11-20 | Heavy | Only if Gap > 70 |
| 20+ | Saturated | Avoid unless Gap > 80 |

### Worked Examples

#### Example 1: Blue Ocean Found

```
Keyword: "strata insurance claim process Queensland"
  Volume:      35 (350 searches/month)
  Growth:      70 (45% YoY — legislative changes driving interest)
  Gap:         85 (only generic national content, nothing QLD-specific)
  Competition:  2 (one weak competitor, one government page)

  Score = (35 × 70 × 85) / 2 = 104,125 → Normalised: 87

  ✅ Action: IMMEDIATE — Blue Ocean confirmed
  Rationale: QLD-specific strata insurance is underserved,
             growing due to regulatory changes, minimal competition.
```

#### Example 2: Red Ocean — Avoid

```
Keyword: "best plumber Brisbane"
  Volume:      75 (5,000 searches/month)
  Growth:      10 (stable, no growth)
  Gap:         15 (many strong pages exist)
  Competition: 25 (saturated market)

  Score = (75 × 10 × 15) / 25 = 450 → Normalised: 12

  ❌ Action: MONITOR — Red ocean, avoid direct competition
  Rationale: Well-covered by established competitors.
             Look for adjacent long-tail instead.
```

#### Example 3: Emerging Opportunity

```
Keyword: "AI content scheduling for small business Australia"
  Volume:      25 (200 searches/month)
  Growth:      90 (breakout — 150% YoY growth)
  Gap:         75 (mostly US-focused content, nothing AU-specific)
  Competition:  3 (two weak articles, one US SaaS page)

  Score = (25 × 90 × 75) / 3 = 56,250 → Normalised: 72

  ✅ Action: HIGH PRIORITY
  Rationale: Fast-growing topic with AU-specific gap.
             First-mover advantage available.
```

## Discovery Process (Step-by-Step Walkthrough)

### Step 1: Scan (2-4 hours)

1. Open Google Trends → Filter to Australia → Enter seed keywords
2. Note any breakout or rising queries (100%+ growth)
3. Search each seed keyword → Expand "People Also Ask" 3 levels deep
4. Record all unique questions in a spreadsheet
5. Search Reddit (site:reddit.com + seed keyword + australia)
6. Search Quora (site:quora.com + seed keyword + australian)
7. Check Google Autocomplete for each seed (a-z prefix method)
8. Record all findings with source attribution

### Step 2: Analyse (1-2 hours)

1. Group discovered keywords by theme/intent
2. Check search volume for each group (SEMrush AU database)
3. Check YoY growth trends (Google Trends 12-month view)
4. Assess content quality gap (search top 10, rate quality 1-10)
5. Count strong competitors (DA > 30) in top 10 results
6. Calculate opportunity score for each keyword group

### Step 3: Validate (1-2 hours)

1. Cross-reference volumes with Google Search Console data
2. Check if existing content already ranks for these terms
3. Verify commercial intent (will this drive business outcomes?)
4. Confirm feasibility (can we create genuinely better content?)
5. Check for regulatory/legal risks in the topic area

### Step 4: Prioritise (30 minutes)

1. Sort all opportunities by score (highest first)
2. Filter by feasibility (resources, expertise, timeline)
3. Select top 3-5 opportunities for immediate action
4. Queue next 5-10 for monthly review
5. Document rationale for each priority decision

### Step 5: Execute (ongoing)

1. Create content brief for each priority opportunity
2. Apply authority-curator skill for content creation
3. Implement schema markup and technical SEO
4. Monitor rankings from day 1 with rank-monitoring skill
5. Iterate based on early ranking signals (week 2-4)

## Red Flags (Skip These Opportunities)

- **Declining trends**: Negative YoY growth for 2+ consecutive quarters
- **Saturated competition**: 10+ strong players (DA > 30) in top 10
- **Low commercial intent**: Informational queries with no path to conversion
- **Outside expertise area**: Topics where we can't demonstrate genuine E-E-A-T
- **Regulatory minefields**: Medical, legal, financial advice without licensed professionals
- **Seasonal spikes only**: One-time events that won't sustain traffic

## Australian Market Focus

### Brisbane-Specific Opportunities

- Subtropical climate issues (mould, flooding, cyclone prep)
- Council-specific regulations (Brisbane City Council requirements)
- Suburb-level targeting (200+ Brisbane suburbs)
- Cross-river dynamics (north side vs south side services)

### Queensland Regional Markets

- Gold Coast, Sunshine Coast, Toowoomba, Cairns, Townsville
- Regional council regulations differ from Brisbane
- Less competition but lower volume — ideal blue ocean
- Seasonal tourism-driven search patterns

### Uniquely Australian Topics

- **Strata/body corporate**: Different terminology and law vs US/UK
- **Insurance-specific**: AU insurance regulations (AFCA complaints, flood mapping)
- **Building standards**: NCC (National Construction Code) compliance
- **Privacy Act 1988**: Data handling requirements
- **ABN/ACN requirements**: Business registration searches
- **Superannuation**: Retirement/financial planning queries

## Integration Points

- **search-dominance.skill.md** — Overall strategy context
- **authority-curator.skill.md** — Content execution for discovered opportunities
- **rank-monitoring.skill.md** — Track performance of new content
- **australian-context.skill.md** — Australian locale defaults

## Verification Checklist

- [ ] All opportunity scores calculated with documented inputs
- [ ] Volume data sourced from at least 2 tools (GSC + SEMrush)
- [ ] Growth trends verified over 12+ months
- [ ] Content gap assessed by reviewing actual SERP results
- [ ] Competition count based on actual DA analysis
- [ ] Australian market specifics included where relevant
- [ ] No declining trends marked as opportunities
- [ ] Commercial intent validated for all priority items
