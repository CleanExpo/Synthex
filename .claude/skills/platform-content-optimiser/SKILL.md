---
name: platform-content-optimiser
description: >-
  Scores content 0-100 against platform algorithm signals. Auto-invokes when
  the user asks to optimise content for a specific platform, score a post, or
  check if content will perform well. Depends on algorithm-knowledge-base skill
  for signal intelligence. Outputs scored recommendations with plain-English
  translations — never exposes raw signal names to clients.
metadata:
  author: synthex
  version: '1.0'
  type: analysis-skill
  triggers:
    - "optimise for"
    - "optimize for"
    - "score this content"
    - "will this perform on"
    - "how will this do on"
    - "improve my post for"
    - "algorithm check"
    - "content score"
    - "platform fit"
    - "would this work on"
context: fork
dependencies:
  - algorithm-knowledge-base
---

# Platform Content Optimiser

## Purpose

Scores content against a platform's top algorithm signals and outputs prioritised, plain-English recommendations. Uses the Algorithm Knowledge Base as the signal intelligence layer.

**Key rule**: Every signal name in client-facing output MUST use the plain-English translation from `algorithm-knowledge-base/references/signal-translations.json`. Never expose raw signal names (NavBoost, sends_per_reach, etc.) to clients.

---

## Protocol

### Step 1: Load Signal Intelligence

1. Load `algorithm-knowledge-base/references/signal-taxonomy.md` — establishes categories
2. Load the platform reference file for the target platform:
   - Google Search → `references/google-search.md`
   - Instagram → `references/instagram-meta.md`
   - LinkedIn → `references/linkedin.md`
   - Multiple platforms → load all relevant files + `references/cross-platform.md`
3. Load `algorithm-knowledge-base/references/signal-translations.json` — mandatory for output

### Step 2: Analyse Content

Map the submitted content against the top 5 signals for the target platform surface. For each signal:

- Does the content satisfy this signal? (Yes / Partially / No)
- What specific change would improve it?

### Step 3: Score 0–100

Calculate algorithm alignment score using this weighting:

| Weight Tier | Points Per Signal |
|-------------|-----------------|
| Critical | 25 pts × (Yes=1.0 / Partial=0.5 / No=0.0) |
| Strong | 15 pts × (Yes=1.0 / Partial=0.5 / No=0.0) |
| Moderate | 8 pts × (Yes=1.0 / Partial=0.5 / No=0.0) |
| Minor | 4 pts × (Yes=1.0 / Partial=0.5 / No=0.0) |

Cap at 100. Round to nearest whole number.

Signal breakdown shows the score contribution from each category: CQ, EV, UB, AT, TK, FR, DS.

### Step 4: Generate Recommendations

For each signal scoring < 1.0 (i.e., Partially or No), generate a recommendation using the PLAIN-ENGLISH translation.

Maximum 3 recommendations, sorted by potential score gain (highest first).

---

## Output Format

```
PLATFORM CONTENT SCORE — [Platform] [Surface]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall: [XX]/100 — [Weak < 40 / Fair 40–59 / Good 60–79 / Strong 80+]

Signal breakdown:
  ✅ [Plain-English signal name] — passes ([confidence level])
  ⚠️  [Plain-English signal name] — partial ([confidence level])
  ❌ [Plain-English signal name] — fails ([confidence level])

Top 3 improvements (ranked by impact):

1. [IMPROVEMENT TITLE] (+X pts potential)
   [Plain-English explanation of what to change and why]
   Signal: [Plain-English translation] [CONFIDENCE_LEVEL — Source Date]

2. [IMPROVEMENT TITLE] (+X pts potential)
   [...]

3. [IMPROVEMENT TITLE] (+X pts potential)
   [...]

Note: Confidence ratings show how certain we are of each signal.
[CONFIRMED] = platform confirmed. [Based on patterns] = observed in multiple accounts.
```

---

## Platform-Specific Quick Reference

### Instagram Reels (top 3 signals)
1. How often people share your content in DMs [CONFIRMED] — Critical
2. How long people watch your video before stopping [CONFIRMED] — Critical
3. When people save your post to come back to later [CONFIRMED] — Strong

### LinkedIn Feed (top 3 signals)
1. Whether people click 'see more' to read your full post [CONFIRMED] — Critical
2. How much engagement your post gets in the first 60–90 minutes [CONFIRMED] — Critical
3. Whether your post sends people to another website [INFERRED] — Strong (negative)

### Google Search (top 3 signals)
1. How much Google trusts your website overall [LEAKED] — Critical
2. Whether your content adds something new not found elsewhere [LEAKED] — Strong
3. How fast your website loads for real visitors [CONFIRMED] — Strong

---

## Pass / Fail Rules

A scored recommendation using this skill:

- ✅ PASS: shows 0–100 score with signal category breakdown
- ✅ PASS: every signal name is plain-English (from signal-translations.json)
- ✅ PASS: recommendations sorted by impact score, not by priority order
- ✅ PASS: confidence level shown as [CONFIRMED] / [Based on patterns] / [Community observation]
- ❌ FAIL: exposes raw signal names (NavBoost, sends_per_reach, CrUX) to user
- ❌ FAIL: makes specific percentage weight claims not backed by [CONFIRMED] or [LEAKED] source
- ❌ FAIL: applies Google signals to Instagram content or vice versa
- ❌ FAIL: scores content without loading the platform reference file first

---

## Confidence Label User-Facing Translations

When showing confidence in the output to end users, translate the internal labels:

| Internal | User-facing |
|----------|-------------|
| [CONFIRMED] | Platform confirmed |
| [LEAKED] | From verified platform documents |
| [INFERRED] | Based on observed patterns |
| [SPECULATIVE] | Community observation — lower certainty |
