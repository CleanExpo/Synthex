---
title: Signal Taxonomy — Unified Classification Schema
last_verified_date: 2026-04-01
applies_to: all platforms
---

# Signal Taxonomy

Internal classification standard. All platform reference files use these categories and confidence labels.

## Signal Categories

| Category | Code | Description |
|----------|------|-------------|
| Content Quality | `CQ` | Signals about intrinsic content value |
| Engagement Velocity | `EV` | Speed and magnitude of user interactions |
| User Behaviour | `UB` | How users interact with the content/page |
| Authority & Trust | `AT` | Source credibility, expertise, external validation |
| Technical | `TK` | Crawlability, speed, structured data |
| Freshness | `FR` | Recency, update frequency, temporal relevance |
| Distribution | `DS` | How widely content is shared or linked |
| Personalisation | `PS` | Signals specific to individual user context |

## Confidence Labels

| Label | Meaning | When to Use |
|-------|---------|-------------|
| `[CONFIRMED]` | Direct official statement from platform, verified documentation, or on-record interview | Only cite verifiable source |
| `[LEAKED]` | From authenticated leak — e.g. Google Content Warehouse API 2024, internal docs | Note leak name and date |
| `[INFERRED]` | Consistent pattern across 3+ independent corroborating sources (SEO practitioners, analytics providers, academic studies) | Qualify with "based on observed patterns" |
| `[SPECULATIVE]` | Single source or community consensus with low verifiability | Always qualify — "may" / "possibly" |

## Signal Record Format

Each signal entry in platform files uses:

```
### signal_name [CONFIDENCE_LABEL]
- **Category**: CQ / EV / UB / AT / TK / FR / DS / PS
- **Source**: Citation (URL or description)
- **Source date**: YYYY-MM
- **Last verified**: YYYY-MM
- **Description**: What the signal measures
- **Implication**: What practitioners should do
```

## Weight Guidance

Do NOT assign numerical weights unless the source is [CONFIRMED] or [LEAKED]. Use qualitative tiers:

- **Critical** — documented as a primary ranking factor
- **Strong** — multiple corroborating sources, consistent practitioner consensus
- **Moderate** — present in the system, likely non-trivial
- **Minor** — present but low direct impact
- **Unknown** — insufficient evidence to assess weight

## Staleness Rules

- [CONFIRMED] entries: valid until platform contradicts them
- [LEAKED] entries: treat as [INFERRED] after 18 months
- [INFERRED] entries: re-evaluate every 12 months
- [SPECULATIVE] entries: expire after 6 months unless re-confirmed

## Output Citation Format

When citing a signal in a recommendation:

```
Signal: signal_name [CONFIDENCE — Source Date]
Recommendation: [specific action]
```

Example:
```
Signal: watch_time [CONFIRMED — Mosseri 2023-09]
Recommendation: Keep Reels under 30s for service demos — watch completion
directly feeds distribution beyond your existing followers.
```
