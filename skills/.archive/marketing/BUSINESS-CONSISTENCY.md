---
name: business-consistency
version: "1.0"
priority: 2
triggers:
  - NAP consistency
  - local SEO
  - business listing
  - Google Business Profile
  - GBP
  - citation
  - schema markup
  - LocalBusiness
  - directory listing
  - Apple Maps
  - Bing Places
  - GEO optimization
  - AI search
  - voice search
---

# Business Consistency Framework

NAP consistency system for local rankings and AI visibility.

## Why It Matters

| Stat | Impact |
|------|--------|
| 40% more likely | Local pack with consistent NAP |
| 32% of ranking | Google Business Profile weight |
| 25-50% drop | Traditional search by 2026-2028 (AI shift) |
| 100% required | Exact match across ALL platforms |

## NAP Consistency Tiers

| Tier | Elements | Rule |
|------|----------|------|
| 1 Critical | Name, Address, Phone | EXACTLY identical everywhere |
| 2 Essential | Website, Email, Hours, Categories | Consistent format |
| 3 Important | Description, Service Areas, Payment | Match master doc |
| 4 AU-Specific | ABN, ACN, License numbers | Current and accurate |

## Platform Priority

| Tier | Platforms | Impact |
|------|-----------|--------|
| 1 Mandatory | GBP, Bing, Apple Maps, Facebook | Core visibility |
| 2 Australian | Yellow Pages, True Local, Yelp | High authority |
| 3 Social | LinkedIn, Instagram, YouTube | sameAs links |
| 4 Directories | StartLocal, dLook, WOMO | Citation count |
| 5 Industry | hipages, Oneflare, trade directories | Niche authority |

## Common Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Name variations | "Smith Plumbing" vs "Smith Plumbing Pty Ltd" | Pick ONE, use everywhere |
| Address format | "St" vs "Street" | Standardize format |
| Phone format | "0412345678" vs "0412 345 678" | Consistent spacing |
| Missing unit | "23 Main St" vs "1/23 Main St" | Include full address |

## Schema Markup (Required)

```json
{
  "@type": "LocalBusiness",
  "name": "EXACT business name",
  "address": { "@type": "PostalAddress", ... },
  "telephone": "+61 X XXXX XXXX",
  "geo": { "latitude": -XX.XXXX, "longitude": XXX.XXXX },
  "sameAs": [ "facebook.com/...", "instagram.com/..." ]
}
```

**Validate:** Google Rich Results Test - zero errors required.

## GEO Optimization (AI Search)

| Platform | Data Source | Optimization |
|----------|-------------|--------------|
| ChatGPT | Bing Places | Complete Bing listing |
| Perplexity | Google | Schema + authority content |
| Gemini | Google Knowledge Graph | GBP + schema |
| Google AI | Search + Schema | Traditional SEO + structured data |

## Content for AI

| Type | Why | Example |
|------|-----|---------|
| Atomic Answers | AI can extract | "50-60 word blocks answering specific questions" |
| Q&A Format | Maps to queries | "Q: How much does X cost? A: $X-$Y in [location]" |
| Lists/Tables | Easy parsing | Service lists, pricing tiers |
| Factual Claims | Verifiable | Specific numbers, dates, licenses |

## Implementation Timeline

| Week | Focus | Platforms |
|------|-------|-----------|
| 1 | Foundation | Master doc, GBP, Schema, Bing, Apple |
| 2 | Expansion | Tier 2-4 directories |
| Ongoing | Maintenance | Weekly GBP check, monthly audit |

## Audit Checklist

```
[ ] Master document created (single source of truth)
[ ] GBP 100% complete + optimized
[ ] Schema validates (zero errors)
[ ] Bing Places claimed + complete
[ ] Apple Maps claimed
[ ] All platforms match master NAP EXACTLY
[ ] sameAs links include all profiles
```

## Monitoring Schedule

| Frequency | Task |
|-----------|------|
| Weekly | Check GBP for suggested edits, new reviews |
| Monthly | Audit Tier 1-2, test AI visibility |
| Quarterly | Full citation audit, schema review |

## Success Metrics

| Metric | Target |
|--------|--------|
| NAP Consistency Score | 95%+ |
| Schema Validation | Zero errors |
| Platform Coverage | 100% Tier 1-2 |
| AI Visibility | Mentioned + accurate |

See: `.business-consistency/`, `master-document/`, `schema/`, `geo/`
