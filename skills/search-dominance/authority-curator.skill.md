---
name: authority-curator
category: search-dominance
version: 1.0.0
description: Research Report Linkable Assets generator with E-E-A-T optimization, Shocking Hook headlines, and anti-AI voice protocols
author: Synthex AI
priority: 2
auto_load: false
triggers:
  - research report
  - linkable asset
  - authority content
  - e-e-a-t content
  - data-driven content
  - shocking hook
  - backlink magnet
requires:
  - verification/truth-finder.skill.md
  - search-dominance/search-dominance.skill.md
  - australian/australian-context.skill.md
---

# Authority Curator Skill

Generate **Research Report Linkable Assets** - high-quality, data-driven content pages optimized for E-E-A-T signals and designed to attract backlinks from authoritative sources (.edu, .gov, industry publications).

## When NOT to Use This Skill

- When planning search strategy, not executing content (use search-dominance)
- When writing quick blog posts without authority-building intent
- When the task is rank monitoring or tracking (use rank-monitoring)
- Instead use: `search-dominance.skill.md` for strategy, `rank-monitoring.skill.md` for tracking

> **Overlap note**: Content execution only. For strategy & planning, use `search-dominance.skill.md`

## Purpose

The Authority Curator creates content that:
- Ranks for informational queries
- Gets cited by journalists, researchers, and industry experts
- Attracts natural backlinks from high-authority domains
- Passes AI content detection (Originality.ai, GPTZero)
- Achieves 90+ Lighthouse scores
- Earns featured snippets and AI citations

---

## 1. "Shocking Hook" H1 Strategy

### Framework
Every H1 must follow the **Curiosity Gap Formula**:

```
[Surprising Statistic/Fact]: [Implication for Reader]
```

### Examples

**Good:**
- "73% of Brisbane Strata Committees Make This $50K Insurance Mistake"
- "Only 12% of Property Managers Know About This Building Code Exemption"
- "The Hidden Clause That Voids 40% of Strata Insurance Claims"

**Bad:**
- "Everything You Need to Know About Strata Insurance" (generic)
- "A Complete Guide to Property Management" (boring)
- "Understanding Insurance Claims: Tips and Advice" (weak)

### Hook Patterns

| Pattern | Example |
|---------|---------|
| **Percentage Shock** | "83% of [audience] don't know [fact]" |
| **Money Lost** | "This mistake costs [audience] $X annually" |
| **Time Wasted** | "[X hours] wasted on [activity] every week" |
| **Hidden Truth** | "The [adjective] truth about [topic]" |
| **Myth Buster** | "Why [common belief] is dangerously wrong" |
| **Exclusive Data** | "[Year] [Topic] Report: [Key Finding]" |

### Validation Rules
- MUST contain a specific number or statistic
- MUST imply actionable consequence
- MUST be verifiable (cite source in first paragraph)
- MUST NOT use clickbait (headline must deliver on promise)
- Maximum 70 characters for SERP display

---

## 2. High-Reverence Copywriting

### Tone Profile

| Quality | Description |
|---------|-------------|
| **Professional** | Writes like The Economist, not BuzzFeed |
| **Authoritative** | States facts confidently, not tentatively |
| **Evidence-Based** | Every claim linked to primary source |
| **Respectful** | Treats reader as intelligent professional |
| **Specific** | Uses exact numbers, names, dates |

### Citation Requirements

**Mandatory citation density:** 1 citation per 200 words minimum

**Citation format:**
```markdown
According to the [Australian Building Codes Board](https://source-url) (2024),
building compliance requirements have increased by 23% since 2019.
```

**Preferred sources (in order):**
1. Government (.gov.au, .gov) - 100% trust
2. Academic (.edu.au, .edu) - 95% trust
3. Industry bodies (peak associations) - 90% trust
4. Major publications (AFR, SMH, ABC) - 85% trust
5. Primary research (original surveys, interviews) - 80% trust

### Structural Requirements

**Every research report MUST include:**

1. **Executive Summary** (50-100 words)
   - Key finding in first sentence
   - Scope of research
   - Actionable takeaway

2. **Methodology Section**
   - Data sources listed
   - Sample size (if applicable)
   - Time period covered
   - Limitations acknowledged

3. **Key Findings** (numbered list)
   - Lead with most surprising finding
   - Include exact figures
   - Cite sources inline

4. **Data Visualisation**
   - At least one table or chart
   - Properly labeled axes
   - Source attribution

5. **Expert Commentary** (if available)
   - Named expert with credentials
   - Direct quote
   - Context for quote

6. **Recommendations**
   - Numbered, actionable steps
   - Tied back to findings
   - Specific to audience segment

7. **Sources/References**
   - Full citations
   - Accessible links
   - Last accessed dates

---

## 3. Anti-AI Voice Protocols

### FORBIDDEN Phrases (Auto-Reject)

Content containing ANY of these triggers automatic rejection:

**Opening Cliches:**
- "In today's digital landscape..."
- "In the ever-evolving world of..."
- "As we navigate the complexities of..."
- "It's no secret that..."

**Hedging Language:**
- "It's important to note that..."
- "It goes without saying..."
- "Needless to say..."
- "At the end of the day..."
- "When it comes to..."
- "In terms of..."

**Filler Transitions:**
- "Let's dive into..."
- "Let's explore..."
- "Let's take a look at..."
- "Without further ado..."
- "Moving forward..."

**AI Pomposity:**
- "Delve into..."
- "Leverage the power of..."
- "Harness the potential of..."
- "Unlock the secrets of..."
- "Embark on a journey..."
- "Revolutionize your..."
- "Transform your..."
- "Elevate your..."
- "Supercharge your..."

**False Intimacy:**
- "You might be wondering..."
- "Have you ever thought about..."
- "Picture this..."
- "Imagine if..."

### Voice Guidelines

**DO:**
- Start with the most important fact
- Use active voice
- Name specific entities (companies, people, places)
- Include contractions naturally ("don't" not "do not")
- Vary sentence length (5-25 words)
- Use Australian spelling (colour, organisation, licence)

**DON'T:**
- Start multiple sentences with "This"
- Use more than 2 commas per sentence
- Write paragraphs longer than 4 sentences
- Use semicolons (use full stops instead)
- Use em-dashes excessively

### Sentence Starters to Use

Instead of AI patterns, use:

| Instead of... | Use... |
|---------------|--------|
| "In today's world..." | "[Specific fact or statistic]..." |
| "It's important to note..." | "Note:" or just state the fact |
| "Let's dive into..." | [Just start the section] |
| "This article will explore..." | [Jump straight to content] |
| "You might be wondering..." | "[Direct answer to question]" |

---

## 4. Proprietary Rating Scale System

### Synthex Authority Score (SAS)

Create branded rating methodology for each research report:

```
SYNTHEX AUTHORITY SCORE: 8.7/10

Methodology:
- Data Recency (20%): 18/20 - Data from last 12 months
- Source Quality (25%): 23/25 - 80% government/academic sources
- Sample Size (20%): 16/20 - n=847 respondents
- Verification (20%): 20/20 - All claims independently verified
- Actionability (15%): 13/15 - Clear next steps provided
```

### Score Breakdown Template

| Factor | Weight | Score | Criteria |
|--------|--------|-------|----------|
| **Data Recency** | 20% | X/20 | Data published within 12 months |
| **Source Quality** | 25% | X/25 | % from .gov/.edu sources |
| **Sample Size** | 20% | X/20 | Statistical significance |
| **Verification** | 20% | X/20 | Independent fact-checking |
| **Actionability** | 15% | X/15 | Practical recommendations |

### Score Thresholds

| Score | Rating | Display |
|-------|--------|---------|
| 9.0-10.0 | **Exceptional** | Gold badge |
| 8.0-8.9 | **Highly Reliable** | Silver badge |
| 7.0-7.9 | **Reliable** | Bronze badge |
| 6.0-6.9 | **Adequate** | No badge |
| <6.0 | **Not Published** | Reject |

### Visual Representation

Include in every report:

```html
<div class="sas-score">
  <div class="score-circle">8.7</div>
  <div class="score-label">Synthex Authority Score</div>
  <div class="score-breakdown">
    <!-- Progress bars for each factor -->
  </div>
</div>
```

---

## 5. Technical Requirements

### SEO & Lighthouse Alignment

**Performance Targets:**
| Metric | Target | Priority |
|--------|--------|----------|
| LCP | < 2.5s | Critical |
| FID | < 100ms | Critical |
| CLS | < 0.1 | Critical |
| Lighthouse Performance | 90+ | High |
| Lighthouse Accessibility | 100 | High |
| Lighthouse Best Practices | 100 | High |
| Lighthouse SEO | 100 | High |

**Implementation:**
- Static generation (SSG) preferred
- Image optimization (WebP/AVIF, srcset)
- Lazy loading for below-fold content
- Font subsetting (WOFF2 only)
- Critical CSS inlined
- Minimal JavaScript (< 50KB gzipped)

### Semantic HTML5 Structure

```html
<article itemscope itemtype="https://schema.org/Article">
  <header>
    <h1 itemprop="headline">Shocking Hook H1</h1>
    <div class="meta">
      <time itemprop="datePublished">DD/MM/YYYY</time>
      <span itemprop="author">Author Name</span>
    </div>
  </header>

  <section class="executive-summary">
    <h2>Executive Summary</h2>
    <!-- Summary content -->
  </section>

  <section class="methodology">
    <h2>Methodology</h2>
    <!-- Methodology content -->
  </section>

  <section class="key-findings">
    <h2>Key Findings</h2>
    <!-- Findings with data tables -->
  </section>

  <aside class="reverence-sidebar">
    <!-- Sticky sidebar with key stats -->
  </aside>

  <section class="recommendations">
    <h2>Recommendations</h2>
    <!-- Actionable recommendations -->
  </section>

  <footer class="sources">
    <h2>Sources</h2>
    <!-- Full citations -->
  </footer>
</article>
```

### Data Table Schema Markup

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Brisbane Strata Insurance Claims Analysis 2024",
  "description": "Analysis of 2,847 strata insurance claims in Brisbane",
  "creator": {
    "@type": "Organization",
    "name": "Synthex"
  },
  "temporalCoverage": "2023-01-01/2024-12-31",
  "distribution": {
    "@type": "DataDownload",
    "encodingFormat": "CSV",
    "contentUrl": "https://synthex.social/data/report.csv"
  }
}
```

### Table Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Table",
  "about": "Strata Insurance Claim Approval Rates by Type",
  "tableElement": [
    {
      "@type": "TableElement",
      "elementType": "header",
      "value": ["Claim Type", "Approval Rate", "Avg. Payout"]
    },
    {
      "@type": "TableElement",
      "elementType": "row",
      "value": ["Water Damage", "78%", "$12,450"]
    }
  ]
}
```

---

## 6. Reverence Sidebar Component

### Specification

Sticky sidebar displaying key statistics for quick reference:

```typescript
interface ReverenceSidebarProps {
  keyStats: {
    label: string;
    value: string | number;
    source?: string;
    trend?: 'up' | 'down' | 'stable';
  }[];
  shareButtons: ('linkedin' | 'twitter' | 'email')[];
  citationFormat: 'APA' | 'MLA' | 'Harvard';
  downloadOptions: ('pdf' | 'csv')[];
}
```

### UI Requirements

```
┌─────────────────────────┐
│ KEY STATISTICS          │
├─────────────────────────┤
│ 73%                     │
│ Claims denied due to    │
│ documentation errors    │
│ Source: AFCA 2024       │
├─────────────────────────┤
│ $47,000                 │
│ Average underinsurance  │
│ gap in Brisbane strata  │
│ Source: ICA 2024        │
├─────────────────────────┤
│ 12 months               │
│ Typical claim           │
│ resolution time         │
│ Source: Industry survey │
├─────────────────────────┤
│ [LinkedIn] [X] [Email]  │
├─────────────────────────┤
│ 📋 Cite This Research   │
│ [Copy APA Citation]     │
├─────────────────────────┤
│ ⬇️ Download Report      │
│ [PDF] [CSV Data]        │
└─────────────────────────┘
```

### Cite This Research Feature

Pre-formatted citations:

**APA:**
```
Synthex. (2024). Brisbane Strata Insurance Claims Analysis.
Retrieved from https://synthex.social/research/brisbane-strata-2024
```

**Harvard:**
```
Synthex (2024) Brisbane Strata Insurance Claims Analysis.
Available at: https://synthex.social/research/brisbane-strata-2024
(Accessed: 12 February 2024).
```

---

## 7. Content Verification Checklist

Before publishing, verify:

### Mandatory Checks

- [ ] H1 follows Shocking Hook formula
- [ ] All statistics have inline citations
- [ ] Zero forbidden AI phrases detected
- [ ] Synthex Authority Score calculated
- [ ] Schema markup validated
- [ ] Lighthouse score 90+
- [ ] AI detection score < 20% (Originality.ai)

### Quality Gates

| Gate | Criteria | Blocker |
|------|----------|---------|
| **G1: Accuracy** | All facts verified via truth-finder.skill.md | YES |
| **G2: Voice** | Zero AI-isms detected | YES |
| **G3: Citations** | 1 citation per 200 words minimum | YES |
| **G4: Structure** | All required sections present | YES |
| **G5: Performance** | Lighthouse 90+ | YES |
| **G6: AI Detection** | < 20% AI-generated score | YES |

---

## 8. Output Templates

### Research Report Template

```markdown
# [Shocking Hook H1 with Statistic]

**Synthex Authority Score: X.X/10**

## Executive Summary

[Key finding in first sentence. Scope. Actionable takeaway in 50-100 words.]

## Key Findings

1. **[Finding 1]** - [Statistic with source]
2. **[Finding 2]** - [Statistic with source]
3. **[Finding 3]** - [Statistic with source]

## Methodology

[Data sources, sample size, time period, limitations]

## Detailed Analysis

### [Section 1]
[Analysis with inline citations]

### [Section 2]
[Analysis with inline citations]

## Data Tables

| Metric | Value | Source |
|--------|-------|--------|
| [X] | [Y] | [Z] |

## Recommendations

1. [Actionable step 1]
2. [Actionable step 2]
3. [Actionable step 3]

## Sources

1. [Full citation 1]
2. [Full citation 2]
3. [Full citation 3]

---

*Last updated: DD/MM/YYYY*
*Methodology: [Link to full methodology]*
*Data download: [CSV link]*
```

---

## 9. Integration with Playwright MCP

Use Playwright to gather data:

```typescript
// Research data gathering workflow
const researchWorkflow = {
  steps: [
    {
      name: 'Gather Government Data',
      action: 'navigate',
      targets: [
        'https://data.gov.au/search?q={topic}',
        'https://abs.gov.au/statistics'
      ]
    },
    {
      name: 'Verify Claims',
      action: 'screenshot',
      evidence: 'Store screenshots as verification'
    },
    {
      name: 'Extract Statistics',
      action: 'scrape',
      selectors: ['table', '.stat-value', '.data-point']
    },
    {
      name: 'Cross-Reference',
      action: 'search',
      query: '{claim} site:.gov.au OR site:.edu.au'
    }
  ]
};
```

---

## 10. Success Metrics

Track these KPIs for Authority Curator content:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Backlinks acquired (30 days) | 5+ | Ahrefs/SEMrush |
| .edu/.gov backlinks | 1+ | Ahrefs |
| Featured snippet wins | 30% | GSC |
| AI citation appearances | 3+ | Manual check |
| Lighthouse score | 90+ | PageSpeed Insights |
| AI detection score | < 20% | Originality.ai |
| Average time on page | > 4 min | GA4 |
| Scroll depth | > 75% | GA4 |

---

## Australian Context

All Authority Curator content defaults to:
- **Spelling**: Australian English (colour, organisation, licence)
- **Dates**: DD/MM/YYYY format
- **Currency**: AUD with GST considerations
- **Regulations**: Reference Australian legislation
- **Sources**: Prioritise .gov.au and .edu.au
- **Examples**: Australian case studies first

---

*Version 1.0.0 | Synthex Authority Curator Skill*
*Requires: truth-finder.skill.md, search-dominance.skill.md, australian-context.skill.md*
