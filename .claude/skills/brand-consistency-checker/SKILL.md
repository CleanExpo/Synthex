---
name: brand-consistency-checker
description: >-
  Synthex brand consistency enforcer. NEVER produce vague feedback ("sounds
  on-brand", "good feel", "consistent with your voice"). ALWAYS score against
  specific criteria: vocabulary match percentage, anti-pattern phrase count,
  and CTA quality. Every feedback item must be specific enough to act on
  immediately. Activate on ANY request to check brand consistency, audit
  content against brand guidelines, review voice alignment, or validate that
  content matches a Business DNA profile.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: capability-uplift-content
  triggers:
    - brand check
    - on-brand
    - brand audit
    - review content
    - brand consistency
    - does this match
    - check my post
    - quality gate
    - check brand
    - voice check
    - brand alignment
context: fork
---

# Brand Consistency Checker

## Purpose

Acts as the brand quality gate for all Synthex content. Scores submitted content
against the Business DNA profile across five brand dimensions, flags specific issues,
and returns actionable rewrites for any off-brand elements.

This turns Synthex into a brand compliance tool — ensuring every post published
through the platform sounds like the brand, not like a generic AI output.

## Workflow

```
1. Receive content to audit (paste, post ID, or scheduled post reference)
2. Load Business DNA for this brand/business
3. Score across 5 brand dimensions
4. Flag specific violations with line-level detail
5. Suggest targeted rewrites for flagged sections
6. Return PASS / CONDITIONAL / FAIL verdict
```

## Brand Scoring Dimensions

Score each dimension 0–100. Overall = weighted average.

### 1. Tone of Voice (30%)

Compare the content's tone against `dna.toneOfVoice` and `dna.languageStyle`.

Check for:

- Formality level match (formal vs casual)
- Energy level (enthusiastic vs measured)
- Perspective (first-person brand voice vs third-person)
- Authenticity (genuine vs generic "AI-sounding" phrases)

**Automatic fails (score 0):**

- Generic opener: "In today's fast-paced world..."
- Hollow superlatives: "world-class", "cutting-edge", "game-changing" (unless in brand vocabulary)
- Passive voice overuse (>20% of sentences)

### 2. Vocabulary Compliance (25%)

Check `dna.vocabulary` (required terms) and `dna.avoidWords` (forbidden terms).

```
Required terms present: [count]/[total] ✓/✗
Forbidden terms found: [list any violations]
Industry jargon: appropriate/excessive
Competitor references: none/flagged
```

### 3. Message Alignment (20%)

Compare key messages against `dna.usp`, `dna.keyBenefits`, and `dna.differentiators`.

- Does the content reinforce the USP?
- Are key benefits represented?
- Is the target audience (`dna.targetAudience`) addressed?
- Is the BYOK/value proposition present (if relevant)?

### 4. Platform Appropriateness (15%)

If platform is known, check against platform rules in `platform-content-adaptor` skill:

- Length within platform limits
- Hashtag count appropriate
- Format correct (thread vs single, portrait vs landscape reference)
- CTA present and appropriate to platform

### 5. CTA and Conversion (10%)

- CTA present: yes/no
- CTA matches campaign goal: yes/no/partial
- CTA is specific and actionable (not "learn more" alone)
- Urgency present (if promotional content)

## Scoring Thresholds

| Score  | Verdict        | Action                                      |
| ------ | -------------- | ------------------------------------------- |
| 85–100 | ✅ PASS        | Ready to publish                            |
| 70–84  | ⚠️ CONDITIONAL | Minor tweaks recommended                    |
| 50–69  | 🔶 REVISE      | Specific rewrites needed before publishing  |
| 0–49   | ❌ FAIL        | Significant brand misalignment — regenerate |

## Output Format

```
──────────────────────────────────────────
 BRAND CONSISTENCY AUDIT
 Brand: [name]  |  Platform: [platform]  |  Date: [DD/MM/YYYY]
──────────────────────────────────────────

OVERALL SCORE: 76/100 ⚠️ CONDITIONAL

DIMENSION SCORES
  Tone of Voice:         82/100 ✓
  Vocabulary:            90/100 ✓
  Message Alignment:     65/100 ⚠
  Platform Fit:          80/100 ✓
  CTA & Conversion:      60/100 ⚠

ISSUES FOUND

  [Line 3] "In today's competitive landscape..."
  → OFF-BRAND: Generic opener. Your brand voice is direct and specific.
  → SUGGESTED: "[Brand name] solves [specific problem]..."

  [Line 8] Missing: USP reference. Your USP is "[usp]"
  → Add a line that connects this post back to your core offer.

  No CTA detected.
  → Add: "[Your CTA from Business DNA]"

VERDICT: ⚠️ CONDITIONAL — fix 3 issues then publish.
```

## Integration with Synthex Workflow

- **Pre-publish gate:** Run this check before approving any AI-generated post
- **Batch audit:** Check all scheduled posts in a campaign before launch
- **Persona training:** Patterns from failing posts improve persona prompts over time

Use `lib/ai/content-scorer.ts` for the Platform Fit and Engagement dimensions.
Apply brand dimension scoring via LLM call using the Business DNA as context.

## Reference

- Business DNA: `.claude/skills/business-dna/`
- Content scorer: `lib/ai/content-scorer.ts`
- Persona system: `lib/ai/content-generator.ts` (personaId + system prompt)
- Brand profile: `app/dashboard/settings/brand-profile`

---

## Capability Uplift — Override Defaults

**NEVER** output vague brand feedback: "this sounds on-brand", "good feel",
"consistent with your voice", "aligns with your brand values". This feedback
is useless — it cannot be acted on. Never approve content that contains
anti-pattern phrases from content-standards.md without flagging them.

**INSTEAD** every consistency check produces a structured score:

BRAND CONSISTENCY REPORT
─────────────────────────
Vocabulary match: [X]% — [N] DNA words used, [N] missing from expected set
Anti-patterns found: [N] — [list each phrase explicitly]
CTA quality: [Pass/Fail] — [exact CTA text] → names action: [Y/N] + benefit: [Y/N]
Tone match: [X]/10 — [specific description of what's aligned and what isn't]
Overall: [Pass ≥7/10 / Revise <7/10]

Specific fixes:

- Line [N]: Replace "[exact phrase]" → "[suggested replacement]"

**REFERENCE** `.claude/skills/synthex-standards/references/content-standards.md`
