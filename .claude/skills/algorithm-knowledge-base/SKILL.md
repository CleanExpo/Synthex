---
name: algorithm-knowledge-base
description: >-
  Algorithm Intelligence Layer for Synthex. Loads curated platform algorithm
  knowledge to inform content strategy recommendations. Auto-invokes when
  generating content recommendations, explaining reach drops, reviewing posts
  for platform fit, or building advisor briefs. Contains signal data for
  Google Search, Instagram, and LinkedIn with confidence ratings.
metadata:
  author: synthex
  version: '1.0'
  type: reference-skill
  triggers:
    - "why is my reach dropping"
    - "algorithm update"
    - "optimise for the algorithm"
    - "what signals matter on"
    - "content strategy for"
    - "why did this post perform"
    - "advisor brief generation"
    - "platform content optimiser"
    - "ranking signal"
    - "engagement velocity"
context: fork
---

# Algorithm Knowledge Base

## Purpose

Provides authoritative, confidence-rated platform algorithm intelligence to
inform all Synthex content recommendations. Prevents generic advice by grounding
recommendations in specific, verified ranking signals.

**Loaded into:** AI Marketing Advisor brief generation, Platform Content Optimiser
skill, and any content strategy session.

## Reference Files

Load the relevant platform file before making algorithm-specific recommendations:

| Platform | File | Confidence Range |
|----------|------|-----------------|
| Google Search | `references/google-search.md` | CONFIRMED → INFERRED |
| Instagram / Meta | `references/instagram-meta.md` | CONFIRMED → SPECULATIVE |
| LinkedIn | `references/linkedin.md` | CONFIRMED → INFERRED |
| Cross-Platform | `references/cross-platform.md` | INFERRED |
| Signal Taxonomy | `references/signal-taxonomy.md` | Internal standard |

## Protocol

### When generating content recommendations:
1. Load `references/signal-taxonomy.md` — establishes signal categories
2. Load platform-specific reference file(s)
3. Map client's content to the top 3 ranking signals for that platform
4. Cite only CONFIRMED or LEAKED signals when making specific claims
5. Mark INFERRED recommendations with "likely" or "based on observed patterns"

### Confidence label rules:
- **[CONFIRMED]** — Direct official statement from platform or verified documentation
- **[LEAKED]** — From authenticated leak (e.g., Google Content Warehouse 2024)
- **[INFERRED]** — Multiple corroborating sources (creators, analytics providers)
- **[SPECULATIVE]** — Single source or community consensus, low certainty

### DO NOT:
- Invent signal weights or claim numerical precision not in the reference files
- Use outdated information (check `last_verified_date` before citing)
- Apply one platform's signals to another without checking cross-platform patterns

## Output Format

When citing algorithm intelligence in recommendations:

```
Signal: watch_time [CONFIRMED — Mosseri 2023-09]
Recommendation: Keep Reels under 30s for service demos — watch completion
directly feeds distribution beyond your existing followers.
```

## Pass / Fail Rules

A recommendation using this skill:
- ✅ PASS: cites at least one specific signal by name with confidence level
- ✅ PASS: distinguishes between platforms when giving multi-platform advice
- ❌ FAIL: "post at optimal times" without citing engagement velocity data
- ❌ FAIL: claims specific percentage weights without [CONFIRMED] or [LEAKED] source
