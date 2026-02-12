---
name: truth-finder
category: verification
version: 2.0.0
description: >-
  Fact verification, source validation, and confidence scoring for all
  published content. Use when verifying factual claims, validating sources,
  scoring content confidence, or checking citations before publication.
priority: 2
data_source: .claude/data/trusted-sources.yaml
triggers:
  - fact check
  - verify
  - citation
  - source validation
  - confidence score
  - claim verification
---

# Truth Finder Skill

Procedures for verifying factual claims before publication. Ensures all
published content is grounded in verified sources with appropriate confidence
levels and citations.

## When NOT to Use This Skill

- When verifying code correctness (use verification-first or code-review)
- When the task is error handling implementation (use error-handling)
- When doing technical SEO verification (use seo tools)
- Instead use: `verification-first.skill.md` for code verification

## Full Fact-Checking Walkthrough

### Step 1: Extract Claims

1. Read the content thoroughly, marking every factual assertion
2. Categorise each claim by type (see Claim Extraction Types below)
3. Flag high-risk claims (numerical, regulatory, absolute) for priority checking
4. Create a claims register with: claim text, type, source (if cited), status

### Step 2: Source Each Claim

1. For each claim, identify the ideal source tier (Tier 1 preferred)
2. Search for primary sources first (.gov.au, peer-reviewed, official standards)
3. Cross-reference with at least one secondary source
4. Record the source URL, publication date, and author/organisation
5. Note any conflicting information found during research

### Step 3: Score Confidence

1. Apply the Confidence Scoring Formula (below) to each claim
2. Calculate the overall content confidence as weighted average
3. Flag any claims below the publishing threshold
4. Document scoring rationale for audit trail

### Step 4: Apply Publishing Decision

1. Check each claim against Publishing Thresholds
2. Add appropriate citations based on content type
3. Add disclaimers where confidence is 60-79%
4. Escalate claims below 40% for human review
5. Block publication if any critical claim is below threshold

### Step 5: Final Verification

1. Re-read content with all citations added
2. Verify citation links are active and correct
3. Confirm no claims slipped through unchecked
4. Sign off with verification status and timestamp

## Claim Extraction Types

| Type | Description | Risk Level | Example |
|------|-------------|------------|---------|
| **Numerical** | Statistics, percentages, costs | High | "73% of businesses..." |
| **Temporal** | Timeframes, dates, frequencies | Medium | "Updated quarterly..." |
| **Causal** | X causes Y relationships | High | "This leads to..." |
| **Comparative** | Better than, more than | Medium | "Faster than competitors..." |
| **Regulatory** | Required by law | Critical | "Privacy Act mandates..." |
| **Attribution** | According to experts | Medium | "Experts recommend..." |
| **Absolute** | Always, never, all, none | High | "Always results in..." |

### Handling Each Type

**Numerical claims**:
1. Find the original data source (not secondary reporting)
2. Verify the methodology is sound
3. Check if the statistic is current (< 2 years old)
4. Confirm sample size and geography are relevant

**Regulatory claims**:
1. Verify against the actual legislation text
2. Check for recent amendments or updates
3. Confirm jurisdiction (federal vs state vs local)
4. Note effective dates and transitional provisions

**Absolute claims** ("always", "never", "all"):
1. Challenge the absoluteness — are there exceptions?
2. Soften to "typically", "generally", "most" if exceptions exist
3. Only retain absolute language if genuinely universal
4. Document the justification for keeping absolute phrasing

## Source Tier Reference

### Tier 1: Primary Sources (95-100% base confidence)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| Government (.gov.au) | ABS, ASIC, ATO, ACCC | Statistics, regulations, compliance |
| Courts & tribunals | Federal Court, NCAT, QCAT | Legal precedent, rulings |
| Standards bodies | Standards Australia, ISO | Technical standards, specifications |
| Peer-reviewed journals | Published academic research | Scientific claims, methodologies |

### Tier 2: Authoritative Sources (80-94% base confidence)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| Universities (.edu.au) | UNSW, UQ, UniMelb research | Academic insights, studies |
| Industry bodies | HIA, MBA, AIBS | Industry standards, best practices |
| Professional associations | CPA Australia, Law Society | Professional guidelines |
| Major research firms | Gartner, Deloitte, PwC | Market research, industry analysis |

### Tier 3: Secondary Sources (60-79% base confidence)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| TED Talks (verified) | Expert presentations | Thought leadership, trends |
| Industry publications | Trade magazines, newsletters | Industry news, opinions |
| Reputable news | ABC News, The Guardian AU | Current events, breaking news |

### Tier 4: Tertiary Sources (40-59% base confidence)

| Source Type | Examples | Use For |
|-------------|----------|---------|
| News media | Commercial news outlets | General awareness only |
| Wikipedia | Wikipedia articles | Starting point only — follow references |
| Blog posts | Industry blogs, opinion pieces | Leads to primary sources |

### NEVER USE

- AI-generated content without verification
- Social media posts as sole source
- Anonymous or unattributed claims
- Outdated sources (> 5 years) for dynamic topics
- Sources with known bias without counterbalance

## Australian Source Prioritisation

When verifying claims for Australian content, prioritise Australian sources:

### Federal Government

| Agency | Domain | Covers |
|--------|--------|--------|
| Australian Bureau of Statistics | abs.gov.au | Demographics, economic data |
| ASIC | asic.gov.au | Company data, financial regulation |
| ATO | ato.gov.au | Tax, superannuation, ABN |
| ACCC | accc.gov.au | Consumer rights, competition |
| OAIC | oaic.gov.au | Privacy Act, data protection |
| Safe Work Australia | safeworkaustralia.gov.au | WHS compliance |

### Queensland State

| Agency | Domain | Covers |
|--------|--------|--------|
| QLD Government | qld.gov.au | State regulations, services |
| QBCC | qbcc.qld.gov.au | Building and construction |
| Brisbane City Council | brisbane.qld.gov.au | Local regulations, planning |
| Titles Queensland | titlesqld.com.au | Property and land records |

### Industry Bodies (Australian)

| Body | Covers |
|------|--------|
| HIA | Housing Industry Association — building standards |
| MBA | Master Builders Australia — construction industry |
| AIBS | Australian Institute of Building Surveyors |
| CPA Australia | Accounting and financial standards |
| Law Society (state) | Legal practice standards |

## Confidence Scoring Formula

```
Base = Source Tier Score (95/87/70/50)

Modifiers:
  + Multiple sources:     +10% each (max +30%)
  + Primary source found: +15%
  + Recent (< 1 year):    +10%
  + Peer-reviewed:        +15%
  + Australian source:    +5% (for AU-specific claims)

  - Single source only:   -20%
  - Outdated (> 3 years): -15%
  - Outdated (> 5 years): -30%
  - Known bias:           -25%
  - Translated source:    -10%
  - Paywall (unverified):  -5%
```

### Worked Examples

#### Example 1: High Confidence Claim

```
Claim: "73% of Australian SMBs use social media for marketing"

Source 1: ABS Business Use of IT Survey (abs.gov.au) — Tier 1
Source 2: Sensis Social Media Report — Tier 2
Source 3: Yellow Digital Report — Tier 2

Scoring:
  Base:             95 (Tier 1 primary source)
  Multiple sources: +20% (2 additional sources)
  Primary source:   +15% (ABS is the original data)
  Recent:           +10% (published within 12 months)
  Australian:       +5%  (Australian-specific data)

  Total: 95 + 20 + 15 + 10 + 5 = 145 → Capped at 100

  Result: 100% confidence → Publish with "Verified" badge
```

#### Example 2: Medium Confidence Claim

```
Claim: "Brisbane property prices will rise 8% in 2026"

Source 1: CoreLogic forecast report — Tier 2
Source 2: Domain market analysis — Tier 3

Scoring:
  Base:             87 (Tier 2 primary source)
  Multiple sources: +10% (1 additional source)
  Recent:           +10% (current forecast)
  Single primary:   -0%  (CoreLogic is credible)

  Total: 87 + 10 + 10 = 107 → Capped at 100

  But: This is a PREDICTION, not a fact.
  Override: Cap at 79% — predictions never get "Verified" badge

  Result: 79% → Publish with disclaimer:
  "Based on CoreLogic forecasts as of [date]. Actual results may vary."
```

#### Example 3: Low Confidence — Block Publication

```
Claim: "Our product is the best AI marketing tool in Australia"

Source: None — this is a superlative marketing claim

Scoring:
  Base:            0  (no source)
  Single source:  -20%
  Known bias:     -25% (self-referential claim)

  Total: 0 - 20 - 25 = -45 → Floor at 0

  Result: 0% → DO NOT PUBLISH as stated
  Action: Rewrite as "Synthex offers AI-powered marketing
          tools designed for Australian businesses" (verifiable)
```

## Publishing Thresholds

| Confidence | Action | Badge | Requirements |
|------------|--------|-------|-------------|
| 95-100% | Publish freely | "Verified" | At least 2 Tier 1-2 sources |
| 80-94% | Publish with citations | Citation link | At least 1 Tier 1-2 source |
| 60-79% | Publish with disclaimer | Disclaimer text | Clear limitation stated |
| 40-59% | Human review required | None | Escalate to content lead |
| < 40% | **DO NOT PUBLISH** | Block | Rewrite or remove claim |

## Citation Formats

### Marketing Content (Hover Reveal)
```html
<span class="verified-claim" data-source="ABS 2025"
  data-url="https://abs.gov.au/...">73% of SMBs</span>
```

### Blog Content
```
According to the Australian Bureau of Statistics (2025),
73% of Australian SMBs use social media for marketing.
```

### Technical Content (Footnotes)
```
Social media adoption among Australian SMBs reaches 73%.¹

---
¹ Australian Bureau of Statistics, "Business Use of Information
  Technology", 2025. abs.gov.au/statistics/...
```

### Legal/Compliance Content
```
Australian Bureau of Statistics. (2025). Business Use of
Information Technology, Australia, 2024-25.
Canberra: ABS. Cat. No. 8129.0.
Available at: https://abs.gov.au/statistics/...
[Accessed: 13 February 2026].
```

## Error Handling

| Error | Action |
|-------|--------|
| Source unavailable (404, paywall) | Use cached/archived version, reduce confidence by 5% |
| Conflicting sources | Report both positions, use higher-tier source as primary |
| No sources found | Flag claim as unverifiable, recommend rewriting |
| Source language not English | Use official translation if available, reduce confidence 10% |
| Source is outdated (> 3 years) | Check for newer data, apply age penalty |
| Circular citation detected | Trace to original source, ignore circular references |

## Integration Points

- **verification-first.skill.md** — Overall verification process
- **authority-curator.skill.md** — Content that needs fact-checking
- **australian-context.skill.md** — Australian source prioritisation
- **error-handling.skill.md** — Error patterns for verification failures

## Verification Checklist

- [ ] All claims extracted and categorised
- [ ] Each claim has at least one source
- [ ] Source tier correctly assigned
- [ ] Confidence score calculated with formula
- [ ] Publishing threshold applied correctly
- [ ] Citations formatted for content type
- [ ] Australian sources prioritised for AU claims
- [ ] No absolute claims without justification
- [ ] Predictions clearly labelled as forecasts
- [ ] Human review escalated where required
