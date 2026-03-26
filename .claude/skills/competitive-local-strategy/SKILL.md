---
name: competitive-local-strategy
description: >-
  Competitor gap analysis, displacement tactics, benchmarking, citation gaps,
  and quarterly strategy reviews for local businesses. Use when analysing
  competitors, planning market positioning, or building competitive advantage
  in local search.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - competitor analysis
    - competitive advantage
    - competitor tracking
    - market positioning
    - benchmarking
    - content gaps
    - competitor reviews
    - SWOT analysis
    - competitor displacement
  requires:
    - google-business-profile
    - google-search-console
context: fork
---

# Competitive Local Strategy — Analysis, Benchmarking, and Displacement

## Purpose

SYNTHEX tracks competitors across social platforms and local search to
identify gaps, benchmark performance, and execute displacement strategies.
This skill documents how to use the competitive intelligence infrastructure
to win in local markets.

## Infrastructure Map

| Layer           | File                                 | Exports / Purpose                                                                                                                                                                                                   |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service (class) | `lib/services/competitive-intel.ts`  | `CompetitiveIntelligence` class, singleton `competitiveIntel`                                                                                                                                                       |
|                 |                                      | Key methods: `addCompetitor`, `getCompetitors`, `getCompetitorProfile`, `analyzeCompetitorContent`, `generateBenchmarkReport`, `analyzeHashtags`, `identifyContentGaps`, `compareSentiment`, `getStrategicInsights` |
| Fetcher         | `lib/social/competitor-fetcher.ts`   | Public profile lookup: Twitter (Bearer token), Instagram (Business Discovery API), YouTube (Channels API), Facebook (Page token), Reddit (public, no auth)                                                          |
| Dashboard       | `app/dashboard/competitors/page.tsx` | Competitor tracking UI                                                                                                                                                                                              |
| Types           | In `competitive-intel.ts`            | `Competitor`, `CompetitorProfile`, `ContentAnalysis`, `BenchmarkReport`, `HashtagAnalysis`, `ContentGap`, `SentimentComparison`                                                                                     |
| Alert types     | `CompetitorAlert` (5 types)          | `viral_post`, `follower_spike`, `new_campaign`, `strategy_change`, `new_competitor`                                                                                                                                 |

## Competitor Gap Analysis Workflow

### Step 1: Identify Local Competitors

- Search Google for "[service] [suburb]" to find who ranks in local pack
- Check Google Maps for businesses in the same category and service area
- Track 3-5 direct competitors (same service + same geography)

```
await competitiveIntel.addCompetitor(userId, {
  name: 'Competitor Name',
  handles: { instagram: '@handle', facebook: 'page-name' },
  website: 'https://competitor.com.au',
  industry: 'plumbing',  // or relevant vertical
  notes: 'Main competitor in northern suburbs',
});
```

### Step 2: Run Benchmark Report

```
const report = await competitiveIntel.generateBenchmarkReport(userId, {
  platforms: ['instagram', 'facebook'],
  period: { start: thirtyDaysAgo, end: now },
});
```

The report returns:

- `metrics.your` vs `metrics.industryAvg` vs `metrics.topPerformer`
- `rankings` — your rank and percentile for each metric
- `gaps` — where you trail, by how much, with priority (high/medium/low) and recommendations

### Step 3: Identify Content Gaps

```
const gaps = await competitiveIntel.identifyContentGaps(userId, 'instagram');
```

High opportunity = topic covered by 3+ competitors with >5% engagement rate that you have not covered.

### Step 4: Analyse Hashtag Strategy

```
const hashtags = await competitiveIntel.analyzeHashtags(userId, 'instagram');
```

Each hashtag gets a recommendation: `adopt` (high engagement, multiple competitors use it), `monitor` (moderate performance), or `avoid` (low engagement or declining).

## Market Positioning Framework

### Positioning Matrix

```
                    Specialised
                        |
           Premium      |      Niche Expert
           Full-Service |      Deep Expertise
                        |
    High Price ---------+--------- Low Price
                        |
           Established  |      Value Player
           Brand        |      Budget-Friendly
                        |
                    Generalised
```

### Content Positioning Options

| Position        | Voice                       | Content Focus                                        |
| --------------- | --------------------------- | ---------------------------------------------------- |
| Authority       | Expert, data-driven         | Industry insights, research, case studies            |
| Local expertise | Community-focused, personal | Suburb guides, local events, neighbourhood tips      |
| Community       | Inclusive, conversational   | Customer stories, behind-the-scenes, team culture    |
| Premium         | Refined, confident          | Quality craftsmanship, attention to detail, outcomes |
| Value           | Transparent, practical      | Clear pricing, comparison guides, ROI demonstrations |

Integrate with `business-dna` skill for messaging consistency. GBP description and categories should reflect chosen positioning.

## Content Differentiation Strategy

For each high-opportunity content gap identified:

1. **Create superior content** — 10x the depth of competitor content, with a local angle and genuine E-E-A-T signals
2. **Cross-post strategically** — use `content-pipeline` skill and `platform-content-adaptor` for multi-platform distribution
3. **Monitor sentiment response** — `compareSentiment` reveals what resonates positively vs generates negative reactions

### Differentiation Principles

- Competitors post generic advice? You post suburb-specific case studies.
- Competitors use stock photos? You use genuine before/after photos.
- Competitors ignore comments? You respond to every one within 24 hours.
- Competitors post weekly? You post 3-4 times per week with higher quality.

## Review Strategy vs Competitors

### Benchmarking Reviews

Compare your GBP review data against competitor profiles:

- `GBPSnapshot` contains your review count and average rating
- `CompetitorSnapshot` (via `getCompetitorProfile`) contains theirs

### Decision Matrix

| Your Position                         | Action                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Trailing review count by 20%+         | Priority 1: intensify review generation (see `local-seo-agent` skill)      |
| Trailing average rating by 0.3+ stars | Focus on service quality improvements + rapid response to negative reviews |
| Leading count but trailing rating     | Respond faster to negatives; address service gaps                          |
| Leading both                          | Maintain velocity; focus on quality of replies                             |

### Response Rate Advantage

- Industry average response rate: <50%
- Target: 100% response rate within 24-72 hours
- Use `useGBPReviews({ unreplied: true })` to find unreplied reviews
- AI-assisted replies via `gbp-monitor` cron, but always human-reviewed before sending

## Local Pack Displacement Checklist

To displace a competitor from the local 3-pack:

- [ ] **Review count** — match or exceed their total review count
- [ ] **Average rating** — maintain higher rating (minimum 4.5 stars)
- [ ] **Listing completeness** — every field populated; exceed competitor's detail level
- [ ] **Citations** — listed on all directories where competitor appears (see Citation Gap Analysis)
- [ ] **Local content** — more suburb-specific service pages than competitor
- [ ] **Local backlinks** — higher-quality local links (chambers of commerce, community groups)
- [ ] **Google Posts frequency** — more frequent and higher-quality posts (1-2/week minimum)
- [ ] **Response time** — faster response to reviews (24h target vs their average)
- [ ] **Photo freshness** — more recent and more diverse photos

## Citation Gap Analysis

### Process

1. Research where each competitor is listed (top 20 directories)
2. Compare against your own citation profile
3. Prioritise directories where 2+ competitors are listed but you are not

### Australian Priority Directories

| Priority | Directory                           | Notes                                 |
| -------- | ----------------------------------- | ------------------------------------- |
| 1        | Google Business Profile             | Primary — already managed via Synthex |
| 1        | Apple Maps / Apple Business Connect | Second-largest maps platform          |
| 1        | Bing Places for Business            | Bing local results                    |
| 1        | Yellow Pages Australia              | High domain authority                 |
| 2        | True Local                          | Australian-specific directory         |
| 2        | Hotfrog                             | Business directory                    |
| 2        | StartLocal                          | Australian local business directory   |
| 2        | Yelp Australia                      | Review-focused directory              |
| 2        | Localsearch                         | Regional Australian directory         |
| 2        | Word of Mouth                       | Australian recommendation platform    |
| 3        | Industry-specific directories       | Varies by vertical (see below)        |

### Industry-Specific Directories

| Vertical    | Directories                                  |
| ----------- | -------------------------------------------- |
| Tradies     | HiPages, ServiceSeeking, Oneflare, Airtasker |
| Medical     | HealthEngine, HotDoc, RateMDs                |
| Legal       | Law Society (state), FindLaw Australia       |
| Hospitality | TripAdvisor, Zomato, OpenTable               |
| Beauty      | Fresha, StyleSeat, Bookwell                  |

### Citation Submission Rules

- NAP must match `GBPLocation` exactly (see `google-business-profile` skill NAP protocol)
- First 250 characters of description should be consistent across all citations
- Use the same logo/profile photo across all directories
- Include UTM-tracked URL for attribution

## Monitoring Cadence

| Frequency         | Action                            | Source                                                                               |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| Daily (automated) | `CompetitorAlert` monitoring      | `viral_post`, `follower_spike`, `new_campaign`, `strategy_change` alerts             |
| Weekly            | Review competitor social activity | Dashboard at `app/dashboard/competitors/page.tsx`                                    |
| Monthly           | Full benchmark report             | `generateBenchmarkReport` with 30-day period                                         |
| Quarterly         | SWOT update + strategy review     | `getStrategicInsights` (strengths, weaknesses, opportunities, threats, action items) |

## Quarterly Strategy Review Template

### Agenda

1. **Performance review** — GSC + GBP snapshot trends (28-day and 90-day)
2. **Fresh SWOT analysis** — `getStrategicInsights(userId, { platforms })` returns structured SWOT + prioritised action items
3. **Landscape changes** — new competitors entered? Existing ones pivoted?
4. **Content gap evolution** — `identifyContentGaps` — which gaps closed, which remain, any new ones?
5. **Set next quarter's top 3 priorities**

### Priority Decision Tree

```
Review count behind top competitor?
  YES --> Priority: review generation campaign
  NO  -->
    Content authority behind?
      YES --> Priority: content creation on high-opportunity gaps
      NO  -->
        Citations behind?
          YES --> Priority: citation building sprint
          NO  -->
            All covered?
              YES --> Priority: differentiation and innovation
                      Find new angles competitors haven't explored
```

### SWOT Output Structure

```typescript
{
  strengths: string[];    // Where you outperform (75th+ percentile)
  weaknesses: string[];   // Where you lag (25th- percentile)
  opportunities: string[]; // Untapped topics with high engagement
  threats: string[];       // Competitors growing rapidly
  actionItems: {
    priority: 'high' | 'medium' | 'low';
    action: string;
  }[];
}
```

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
