---
name: truth-finder
description: >
  4-tier source verification system for validating claims and recommendations.
  Assigns confidence scores based on source tier: T1 Official Docs (0.9-1.0),
  T2 Trusted Sources (0.7-0.89), T3 Community (0.5-0.69), T4 AI-Generated
  (0.3-0.49). Publishing threshold: >= 0.7 confidence. Use when making
  technical recommendations, verifying facts, or assessing claim reliability.
---

# Truth Finder -- Source Verification System

## Process

1. **Identify claim** -- isolate the specific factual claim or recommendation to verify
2. **Locate sources** -- find the best available source for the claim
3. **Classify source tier** -- assign T1-T4 based on source type
4. **Calculate confidence** -- score within the tier range based on recency, specificity, and corroboration
5. **Apply publishing threshold** -- only publish recommendations with >= 0.7 confidence
6. **Document verification** -- record source, tier, and confidence for every claim

## Source Tiers

### T1: Official Documentation (Confidence: 0.9 - 1.0)

Primary, authoritative sources directly from the technology creator or standards body.

| Source Type | Examples | Base Confidence |
|-------------|----------|-----------------|
| Official docs | Node.js docs, TypeScript handbook, Prisma docs | 0.95 |
| Source code | GitHub repo source, package source | 0.95 |
| Official changelogs | Release notes, migration guides | 0.93 |
| RFCs and standards | IETF RFCs, W3C specs, ECMAScript spec | 0.95 |
| Official blog posts | Vercel blog, Next.js blog, Prisma blog | 0.90 |

**Confidence adjustments**:
- +0.05 if verified against source code directly
- -0.05 if documentation version does not match project version
- -0.10 if documentation is > 12 months old for fast-moving technology

### T2: Trusted Secondary Sources (Confidence: 0.7 - 0.89)

Well-established, editorially maintained resources with strong accuracy track records.

| Source Type | Examples | Base Confidence |
|-------------|----------|-----------------|
| MDN Web Docs | MDN JavaScript, CSS, HTML references | 0.88 |
| Platform docs | Vercel docs, Supabase docs, Stripe docs | 0.85 |
| Established references | Can I Use, web.dev, Node.js best practices | 0.82 |
| Peer-reviewed tutorials | Official tutorials, certified courses | 0.78 |
| Reputable tech publications | InfoQ, The New Stack, Smashing Magazine | 0.75 |

**Confidence adjustments**:
- +0.05 if corroborated by a T1 source
- -0.05 if content is opinion-heavy rather than factual
- -0.10 if contradicted by a T1 source

### T3: Community Sources (Confidence: 0.5 - 0.69)

Community-contributed knowledge with variable quality and no editorial guarantee.

| Source Type | Examples | Base Confidence |
|-------------|----------|-----------------|
| Stack Overflow (high-vote) | Answers with 50+ upvotes, accepted answers | 0.65 |
| Stack Overflow (low-vote) | Answers with < 10 upvotes | 0.55 |
| Blog posts (expert) | Known expert authors, detailed technical blogs | 0.63 |
| Blog posts (general) | Medium articles, personal blogs | 0.55 |
| GitHub issues/discussions | Issue threads, discussion comments | 0.58 |
| Conference talks | Recorded presentations, slide decks | 0.60 |

**Confidence adjustments**:
- +0.10 if corroborated by a T1 or T2 source (can promote to T2 range)
- +0.05 if multiple independent T3 sources agree
- -0.10 if content is > 2 years old
- -0.15 if contradicted by T1 or T2 source

### T4: AI-Generated Content (Confidence: 0.3 - 0.49)

Content produced by AI systems without human editorial verification.

| Source Type | Examples | Base Confidence |
|-------------|----------|-----------------|
| AI chat responses | ChatGPT, Claude, Gemini responses | 0.40 |
| AI-generated articles | Auto-generated blog posts, summaries | 0.35 |
| AI code suggestions | Copilot suggestions, AI-generated code | 0.40 |
| Unattributed content | No clear author or source | 0.30 |

**Confidence adjustments**:
- +0.20 if corroborated by T1 source (can promote to T2 range)
- +0.15 if corroborated by T2 source
- +0.05 if reasoning chain is transparent and verifiable
- -0.10 if claim is specific and precise (higher chance of hallucination)

**Mandatory rule**: T4 content MUST be corroborated by at least one T1 or T2 source before being used in any recommendation. Uncorroborated T4 content is treated as unverified.

## Publishing Thresholds

| Confidence | Action |
|------------|--------|
| >= 0.9 | Publish as strong recommendation |
| 0.7 - 0.89 | Publish with source attribution |
| 0.5 - 0.69 | Publish only as "community suggestion" with caveat |
| 0.3 - 0.49 | Do not publish; require corroboration first |
| < 0.3 | Reject; insufficient evidence |

### Threshold Rules
- **Recommendations** (architectural decisions, config changes): must have >= 0.7 confidence
- **Factual claims** (version numbers, API behavior): must have >= 0.7 confidence
- **Suggestions** (optimization ideas, nice-to-haves): may be presented at >= 0.5 with caveats
- **Warnings** (security issues, breaking changes): may be issued at >= 0.5 if potential impact is high

## Verification Protocol

For every claim in a deliverable, document the verification chain:

```markdown
### Claim: [statement being verified]
- **Source**: [specific URL, doc section, or file path]
- **Tier**: T1 / T2 / T3 / T4
- **Confidence**: [0.0 - 1.0]
- **Recency**: [when the source was last updated]
- **Corroboration**: [additional sources, if any]
- **Verdict**: Verified / Partially Verified / Unverified / Contradicted
```

### Multi-Source Verification
When a claim has multiple sources, use the highest-tier source as the primary confidence, with adjustments:
- Two T2 sources agreeing: use upper end of T2 range (0.85-0.89)
- T3 corroborated by T1: promote to T2 range (0.7-0.8)
- Contradicting sources: flag for human review, use lower confidence

## Output Format

```markdown
## Verification Report

### Claims Verified: {count}
### Average Confidence: {score}
### Unverified Claims: {count}

| # | Claim | Source | Tier | Confidence | Verdict |
|---|-------|--------|------|------------|---------|
| 1 | [claim] | [source] | T1 | 0.95 | Verified |
| 2 | [claim] | [source] | T3 | 0.60 | Partially Verified |

### Recommendations Cleared for Publishing
- [recommendation 1] (confidence: 0.85)
- [recommendation 2] (confidence: 0.72)

### Blocked (Below Threshold)
- [claim] (confidence: 0.45) -- requires T1/T2 corroboration

### Conflicts Detected
- [claim]: T1 source says X, T3 source says Y -- using T1 (confidence: 0.90)
```
