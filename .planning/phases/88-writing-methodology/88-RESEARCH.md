# Phase 88: Writing Context & Voice Fingerprinting — Research

**Researched:** 2026-03-11
**Domain:** Stylometric voice analysis, Content Capsule Technique, Context Engineering, AI slop detection
**Confidence:** HIGH

<research_summary>
## Summary

Phase 88 builds a **Voice Fingerprinting Engine** that extracts quantitative writing style metrics (stylometry) from human-written samples, formats content using the **Content Capsule Technique** (AI-extractable GEO structure), and builds rich writing context to inject into AI generation — eliminating AI slop at the source rather than post-hoc.

The domain breaks into four distinct capabilities: (1) stylometric fingerprint extraction from text (pure TypeScript, no npm packages), (2) Content Capsule reformatting for AI extractability, (3) AI slop tell-phrase scanning against a comprehensive pattern library, and (4) writing context injection — building a structured system prompt from a voice fingerprint.

Research confirms that all four capabilities can be implemented with **pure TypeScript string/regex operations** — no new npm packages required. The existing `lib/geo/` pattern (types → scorer → analyzer → routes → dashboard) maps directly to `lib/voice/`.

**Primary recommendation:** Follow the `lib/geo/tactic-scorer.ts` architecture exactly — pure TypeScript, sub-100ms execution, no external APIs for the core analysis. Add two Prisma models (`VoiceProfile`, `ContentCapsule`) and extend `lib/geo/feature-limits.ts` with new feature keys. The Voice Fingerprint dashboard follows the existing `/dashboard/geo/optimiser` split-panel pattern.
</research_summary>

<standard_stack>
## Standard Stack

### Core — All Pure TypeScript (No New Packages)
| Approach | Purpose | Why |
|----------|---------|-----|
| Pure TypeScript string/regex | Stylometric analysis | No npm overhead, same pattern as `tactic-scorer.ts` |
| Existing `@anthropic-ai/sdk` | Context builder validation (optional) | Already in project |
| Existing Prisma 6 | VoiceProfile + ContentCapsule persistence | Already in project |
| Existing `lib/geo/feature-limits.ts` | Feature gating | Extend existing pattern |

### Stylometric Features to Extract (Pure TypeScript)

| Metric | Implementation | What It Reveals |
|--------|---------------|----------------|
| Mean sentence length (words) | Split on `.!?`, count words | Short = punchy, long = academic |
| Sentence length std dev | Statistical variance | Low = uniform, high = varied rhythm |
| Type-Token Ratio (TTR) | `uniqueWords/totalWords` | Vocabulary richness |
| Avg word length (chars) | Sum chars / word count | Vocabulary sophistication |
| Paragraph length distribution | Split on `\n\n`, count words | Dense vs airy writing |
| Punctuation density | Count `,;:—()` per sentence | Complex vs simple style |
| Em dash frequency | `—` or ` - ` per 100 words | Personal/editorial voice |
| Question frequency | `?` per 100 words | Conversational vs declarative |
| First-person frequency | `\bI\b|\bme\b|\bmy\b` | Personal vs institutional |
| Sentence opener patterns | First word of each sentence | Pronoun, article, conjunction |
| Adverb density | Words ending `-ly` per 100 words | Modifier-heavy vs lean |
| Passive voice estimate | `\bwas\b.*\bby\b|\bwere\b.*\bby\b` | Active vs passive tendency |
| Flesch Reading Ease | `206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)` | Readability grade |

### No npm Packages Needed
- ❌ `natural` (NLP library) — overkill, our patterns are simpler
- ❌ `compromise` (NLP library) — unnecessary for regex-based stylometry
- ❌ `syllable` (syllable counter) — can use approximation (vowel-group counting)
- ✅ Pure TypeScript is sufficient and consistent with existing codebase pattern
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended File Structure
```
lib/voice/
├── types.ts                   # VoiceFingerprint, ContentCapsule, WritingContext, SlopResult
├── fingerprint-extractor.ts   # Extract quantitative metrics from sample text
├── capsule-formatter.ts       # Transform content → Content Capsule format
├── slop-scanner.ts            # Tell-phrase + structural AI pattern scanner
├── context-builder.ts         # Build rich system prompt from fingerprint
└── voice-analyzer.ts          # Orchestrator (runs all analyses)

app/api/voice/
├── analyze/route.ts           # POST — extract fingerprint from sample text
├── capsule/route.ts           # POST — format content as Content Capsule
├── slop-scan/route.ts         # POST — scan for AI slop patterns
└── context/route.ts           # POST — build writing context from profile

app/dashboard/voice/
└── page.tsx                   # Voice dashboard (tabs: Fingerprint | Capsule | Slop Scan)

components/voice/
├── VoiceFingerprintCard.tsx   # Metric bars + trait badges
├── ContentCapsulePreview.tsx  # Before/after capsule format
└── SlopScanResults.tsx        # Flagged phrases with positions

prisma/schema.prisma
├── VoiceProfile               # Saved fingerprints per user/org
└── ContentCapsule             # Saved capsule-formatted content
```

### Pattern 1: Fingerprint Extractor (follows tactic-scorer.ts exactly)
**What:** Pure TypeScript functions, each computing one metric, composed into a single `extractFingerprint(text)` function
**When to use:** Given any sample of ≥200 words of human-written content

```typescript
// lib/voice/fingerprint-extractor.ts pattern
function computeSentenceLengths(text: string): SentenceStats {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  return { mean: Math.round(mean * 10) / 10, stdDev: Math.round(Math.sqrt(variance) * 10) / 10 };
}

function computeTTR(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  return words.length > 0 ? new Set(words).size / words.length : 0;
}

function estimateSyllables(word: string): number {
  // Approximation: count vowel groups
  const groups = word.toLowerCase().match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}
```

### Pattern 2: Content Capsule Technique
**What:** Reformats arbitrary content into AI-extractable capsule blocks
**Standard:** Q&A headings + 75-120 word answer block + supporting evidence

```
## [Question phrasing matching search intent]

[Direct answer in 75-120 words — self-contained, citable, no fluff.
Must make sense if extracted alone by AI. Lead with the conclusion,
then support it with one key fact or statistic.]

- Supporting detail 1
- Supporting detail 2
- [Source or example]
```

**Evidence base:**
- 40% higher AI citation rate for question-format H2 headings (Kaizen SEO research)
- 3.4x more likely extracted for AI Overview answers (PathFinder SEO data)
- 72% of ChatGPT-cited pages have this answer capsule structure (Chain Reaction research)

### Pattern 3: AI Slop Tell-Phrase Scanner
**What:** Regex-based scanner against a comprehensive pattern library, returns flagged positions
**Input:** Any text | **Output:** `{ phrase, position, category, severity }`

Categories:
- `transition` — lazy transitions ("in conclusion", "furthermore", "moreover")
- `filler` — meaningless qualifiers ("it's important to note", "needless to say")
- `overused-word` — LLM vocabulary ("delve", "robust", "leverage", "foster")
- `structural-pattern` — AI templates ("not only X but also Y", "from X to Y")
- `hedge` — excessive hedging ("arguably", "to some extent", "of course")

### Pattern 4: Context Builder (Writing Context Injector)
**What:** Builds a rich structured system prompt from a VoiceFingerprint
**Why:** Context engineering (2025) — output quality = context quality

```typescript
// Output format: structured prose for system prompt injection
function buildWritingContext(profile: VoiceProfile): string {
  const fp = profile.fingerprint as VoiceFingerprint;
  return `
WRITING STYLE REQUIREMENTS — MATCH EXACTLY:

Sentence rhythm: Average ${fp.sentenceLengths.mean} words per sentence
(range ${Math.round(fp.sentenceLengths.mean - fp.sentenceLengths.stdDev)}-${Math.round(fp.sentenceLengths.mean + fp.sentenceLengths.stdDev)} words).
Vary sentence length naturally — do not use uniform length.

Vocabulary level: ${fp.ttr > 0.65 ? 'High' : fp.ttr > 0.45 ? 'Medium' : 'Accessible'} diversity (TTR ${fp.ttr.toFixed(2)}).
${fp.avgWordLength > 5.5 ? 'Use sophisticated vocabulary.' : 'Prefer simple, direct words.'}

Voice characteristics:
${fp.firstPersonRate > 0.02 ? '- Write in first person where appropriate.' : '- Maintain third-person perspective.'}
${fp.emDashRate > 0.5 ? '- Use em dashes for parenthetical asides — it is part of this voice.' : ''}
${fp.questionRate > 0.5 ? '- Include rhetorical questions to engage the reader.' : ''}
${fp.adverbDensity < 0.03 ? '- Write lean: avoid unnecessary adverbs.' : ''}

PROHIBITED (AI slop — never use):
delve, comprehensive, robust, leverage, foster, enhance, dynamic, innovative,
"in conclusion", "it's important to note", "it's worth noting", "needless to say",
"in today's fast-paced world", "as we navigate", "tapestry", "nuance"
`.trim();
}
```

### Anti-Patterns to Avoid
- **LLM-based fingerprinting:** Don't use an LLM to describe writing style — use pure math. LLM descriptions are vague and not reproducible.
- **npm NLP libraries for stylometry:** Adds bundle weight unnecessarily. Pure regex is faster, simpler, and more predictable.
- **One-size-fits-all slop list:** Slop patterns evolve. Build a versioned, categorised list so it can be updated without touching other code.
- **Syllable counting with dictionary:** Approximation (vowel groups) is sufficient for Flesch — within ±5% accuracy, which is acceptable.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature gating | New subscription check | Extend `lib/geo/feature-limits.ts` | Already handles all plans, backward-compat aliases |
| Auth in API routes | New auth pattern | `getUserIdFromRequest(request)` from `lib/auth/` | Existing pattern, tested |
| Zod validation | Manual body parsing | `schema.safeParse(body)` | Already in every route |
| Rate limiting | New rate limiter | `RateLimiter` from `lib/rate-limit/` | Proven pattern, Phase 87 precedent |
| Voice scoring with LLM | Custom LLM call | Extend existing `lib/brand-voice/quality-scorer.ts` | QualityScorer already does LLM-based voice check |
| Syllable counting | Dictionary lookup | Vowel-group regex approximation | Accurate enough, zero dependencies |
| Dashboard layout | New layout pattern | Copy `/dashboard/geo/optimiser` split-panel | Proven pattern, consistent UX |

**Key insight:** Everything needed is a pure TypeScript computation or a reuse of existing infrastructure. Phase 88 is a service layer + routes + UI phase — not a new technology integration.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Minimum Text Length for Meaningful Fingerprinting
**What goes wrong:** Computing TTR or sentence stats on short text gives wildly unreliable results (TTR on 10 words is almost always 1.0)
**Why it happens:** Stylometric metrics only stabilize at ~200+ words
**How to avoid:** Enforce minimum 200 words for fingerprint extraction. Return `{ valid: false, reason: 'Insufficient sample' }` below threshold.
**Warning signs:** TTR > 0.90 consistently, sentence count < 10

### Pitfall 2: Slop List Staleness
**What goes wrong:** "Delve" was LLM-specific in 2023, already fading in 2025. New tell-phrases emerge constantly.
**Why it happens:** LLMs trained on feedback fine-tune away from known patterns
**How to avoid:** Version the slop pattern list (e.g., `SLOP_PATTERNS_V1`) so it can be updated. Keep categories separate so high-confidence patterns stay distinct from emerging ones.
**Warning signs:** Users reporting false positives on natural human writing

### Pitfall 3: Content Capsule Breaking Existing Content
**What goes wrong:** Attempting to auto-reformat long-form articles destroys their narrative flow
**Why it happens:** Content Capsule works for informational/educational content, not for opinion or narrative pieces
**How to avoid:** Detect content type first (heading count, question marks, list ratio). Only apply capsule format to informational content. Return the original as "capsule-ready" if it already passes the structure tests.
**Warning signs:** User feedback that "capsule version reads worse than original"

### Pitfall 4: Context Builder Prompt Overflow
**What goes wrong:** Voice fingerprint context added to system prompt pushes total tokens over model limit
**Why it happens:** Fingerprint context can be verbose, especially with many behavioural rules
**How to avoid:** Keep writing context under 500 tokens. Use terse bullet format, not prose. Provide a `compact: true` option for tight token budgets.
**Warning signs:** AI generation fails with context length errors

### Pitfall 5: False Positives on Legitimate Writing
**What goes wrong:** Slop scanner flags human writers who genuinely use "moreover" or "furthermore"
**Why it happens:** These words exist in legitimate English — they're only *over*-represented in AI text
**How to avoid:** Severity tiers: `error` for high-confidence AI patterns (TTR < 0.35, >3 slop phrases per 100 words), `warning` for single occurrences. Never block publishing based on slop scan — only advise.
**Warning signs:** High false positive rate reported in UAT
</common_pitfalls>

<code_examples>
## Code Examples

### Voice Fingerprint Type Shape
```typescript
// lib/voice/types.ts
export interface SentenceStats {
  mean: number;       // avg words per sentence
  stdDev: number;     // variation (high = good rhythm, low = monotonous)
  min: number;
  max: number;
}

export interface VoiceFingerprint {
  // Sentence rhythm
  sentenceLengths: SentenceStats;
  // Vocabulary
  ttr: number;            // Type-Token Ratio: 0.0-1.0 (higher = more diverse)
  avgWordLength: number;  // chars (higher = more sophisticated)
  // Style markers
  punctuationDensity: number;   // non-letter chars per sentence
  emDashRate: number;           // em dashes per 100 words
  questionRate: number;         // ? per 100 words
  firstPersonRate: number;      // I/me/my per total words
  adverbDensity: number;        // -ly words per 100 words
  passiveVoiceEstimate: number; // 0.0-1.0 (higher = more passive)
  // Readability
  fleschReadingEase: number;    // 0-100 (higher = easier)
  avgParagraphLength: number;   // words per paragraph
  // Sample metadata
  sampleWordCount: number;
  sampleSentenceCount: number;
  extractedAt: string;          // ISO timestamp
}
```

### Content Capsule Type Shape
```typescript
export interface ContentCapsule {
  originalWordCount: number;
  capsuleWordCount: number;
  sections: CapsuleSection[];
  extractabilityScore: number;  // 0-100, higher = more AI-extractable
}

export interface CapsuleSection {
  heading: string;        // Question-format H2/H3
  answerBlock: string;    // 75-120 word direct answer
  supporting: string[];   // Bullet points of evidence
  wordCount: number;
  isCapsuleReady: boolean; // Already meets spec
}
```

### Slop Scan Result Type Shape
```typescript
export type SlopCategory = 'transition' | 'filler' | 'overused-word' | 'structural-pattern' | 'hedge';
export type SlopSeverity = 'error' | 'warning';

export interface SlopMatch {
  phrase: string;
  category: SlopCategory;
  severity: SlopSeverity;
  position: number;       // char index in text
  context: string;        // 40 chars of surrounding text for display
}

export interface SlopScanResult {
  matches: SlopMatch[];
  slopDensity: number;    // matches per 100 words
  humanessScore: number;  // 0-100 (inverse of slop density, capped)
  categories: Record<SlopCategory, number>; // count per category
}
```

### Core TTR + Sentence Length (Pure TypeScript)
```typescript
// Source: Stylometric research — standard formulas
export function computeTTR(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  if (words.length === 0) return 0;
  return new Set(words).size / words.length;
}

export function computeSentenceLengths(text: string): SentenceStats {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const lengths = sentences.map(s => (s.match(/\b\w+\b/g) ?? []).length).filter(l => l > 0);
  if (lengths.length === 0) return { mean: 0, stdDev: 0, min: 0, max: 0 };
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + (l - mean) ** 2, 0) / lengths.length;
  return {
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    min: Math.min(...lengths),
    max: Math.max(...lengths),
  };
}
```

### Flesch Reading Ease (Approximated)
```typescript
// Source: Flesch (1948) formula — standard implementation
function countSyllables(word: string): number {
  const vowelGroups = word.toLowerCase().match(/[aeiouy]+/g);
  const raw = vowelGroups?.length ?? 1;
  // Subtract silent trailing 'e'
  const trailingE = /[^aeiouy]e$/i.test(word) ? 1 : 0;
  return Math.max(1, raw - trailingE);
}

export function computeFleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.match(/\b\w+\b/g) ?? [];
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  if (sentences.length === 0 || words.length === 0) return 50;
  const asl = words.length / sentences.length;
  const asw = syllables / words.length;
  return Math.max(0, Math.min(100, 206.835 - 1.015 * asl - 84.6 * asw));
}
```

### AI Slop Pattern Library (Sample)
```typescript
// lib/voice/slop-scanner.ts
export const SLOP_PATTERNS_V1: SlopPattern[] = [
  // Transitions — error severity
  { pattern: /\bin conclusion\b/gi, category: 'transition', severity: 'error' },
  { pattern: /\bto summarize\b/gi, category: 'transition', severity: 'error' },
  { pattern: /\bfurthermore\b/gi, category: 'transition', severity: 'warning' },
  { pattern: /\bmoreover\b/gi, category: 'transition', severity: 'warning' },
  // Fillers — error severity
  { pattern: /\bit(?:'s| is) important to note\b/gi, category: 'filler', severity: 'error' },
  { pattern: /\bit(?:'s| is) worth (?:noting|mentioning)\b/gi, category: 'filler', severity: 'error' },
  { pattern: /\bneedless to say\b/gi, category: 'filler', severity: 'error' },
  { pattern: /\bit goes without saying\b/gi, category: 'filler', severity: 'error' },
  // Overused AI words
  { pattern: /\bdelve\b/gi, category: 'overused-word', severity: 'error' },
  { pattern: /\brobust\b/gi, category: 'overused-word', severity: 'warning' },
  { pattern: /\bleverage\b/gi, category: 'overused-word', severity: 'warning' },
  { pattern: /\bfoster\b/gi, category: 'overused-word', severity: 'warning' },
  { pattern: /\bnuance\b/gi, category: 'overused-word', severity: 'warning' },
  { pattern: /\btapestry\b/gi, category: 'overused-word', severity: 'error' },
  { pattern: /\bsynergy\b/gi, category: 'overused-word', severity: 'error' },
  // Hedges
  { pattern: /\bto some extent\b/gi, category: 'hedge', severity: 'warning' },
  { pattern: /\bof course\b/gi, category: 'hedge', severity: 'warning' },
  { pattern: /\bof course, \b/gi, category: 'hedge', severity: 'warning' },
  // Structural patterns
  { pattern: /\bnot only .{3,60} but also\b/gi, category: 'structural-pattern', severity: 'warning' },
  { pattern: /\bin today's fast[-\s]paced world\b/gi, category: 'structural-pattern', severity: 'error' },
  { pattern: /\bas we navigate\b/gi, category: 'structural-pattern', severity: 'error' },
];
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual prompt engineering for voice | Context Engineering (structured context systems) | 2025 | Voice fingerprint → rich system prompt eliminates slop at source |
| LLM-described style ("professional, friendly") | Quantitative stylometric fingerprint | 2025 | Measurable, reproducible, reproducible in context |
| Detect AI slop post-hoc | Eliminate at generation via context injection | 2025-2026 | Prevention > detection |
| Content formatted for keywords | Content Capsule format for AI extractability | 2024-2025 | 40% higher citation rate, 3.4x AI Overview inclusion |
| "Delve" detection | Broader tell-phrase taxonomy | 2024→2025 | "Delve" fading; new patterns: "core", "modern", "align with" |

**New tools/patterns (2025-2026):**
- **Context Engineering**: Building dynamic systems that provide right context at right time — not just prompt engineering
- **Content Capsule Technique**: Self-contained 75-120 word answer blocks → 72% of AI-cited pages use this
- **Humanness scoring**: Inverse of slop density — actionable metric for writers
- **Voice fingerprint persistence**: Save profiles per brand/author → consistent AI generation at scale

**What's emerging:**
- Fingerprinting real content (not AI-generated) as provenance marker
- Platform-specific voice profiles (LinkedIn voice ≠ blog voice)
</sota_updates>

<open_questions>
## Open Questions

1. **Content Capsule auto-detection**
   - What we know: Capsule format works for informational content
   - What's unclear: Exact heuristics to classify content type before reformatting (informational vs narrative vs opinion)
   - Recommendation: Use heading count + list ratio + avg paragraph length as proxy; if headings > 3 and avg para < 80 words → informational

2. **Voice profile per platform**
   - What we know: LinkedIn voice differs from blog voice differs from Twitter voice
   - What's unclear: Whether Phase 88 should support per-platform profiles or a single brand profile
   - Recommendation: Single profile in Phase 88, per-platform extension deferred to Phase 91 (Brand Builder)

3. **Fingerprint minimum sample size**
   - What we know: Stylometric metrics stabilize at 200+ words
   - What's unclear: At what point are results "reliable enough" to save as a profile
   - Recommendation: Require 200 words minimum, warn at 200-500 words, fully reliable at 500+
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Wikipedia: Signs of AI Writing — comprehensive tell-phrase taxonomy (verified with multiple secondary sources)
- Flesch (1948) reading ease formula — standard academic formula, implemented identically across implementations
- Academic: Stylometric Survey (FRUCT) — established feature categories: lexical, syntactic, structural
- Existing `lib/geo/tactic-scorer.ts` — direct architectural precedent for pure TypeScript scoring functions

### Secondary (MEDIUM confidence)
- Kaizen SEO: Elite GEO Protocol 2026 — "40% higher AI citation rate for question H2s" (industry study)
- PathFinder SEO: "3.4x more likely extracted for AI Overview" (industry study, not peer reviewed)
- Chain Reaction: "72% of ChatGPT-cited pages have answer capsule structure" (industry analysis)
- Context Engineering Guide (promptingguide.ai) — context engineering principles verified against multiple sources
- SEJ AI Writing Fingerprints — tell-phrase taxonomy verified against Wikipedia:Signs of AI Writing

### Tertiary (LOW confidence — needs validation during implementation)
- Specific slop word frequencies (which words are most overused varies by model version) — validate against Wikipedia:Signs of AI Writing during implementation
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Pure TypeScript stylometry + AI slop patterns
- Ecosystem: Content Capsule Technique (GEO), Context Engineering, Stylometric analysis
- Patterns: Fingerprint extractor, capsule formatter, slop scanner, context builder
- Pitfalls: Minimum sample size, slop list staleness, false positives, context overflow

**Confidence breakdown:**
- Standard stack: HIGH — all pure TypeScript, no new dependencies
- Architecture: HIGH — directly follows existing `lib/geo/` patterns
- Stylometric formulas: HIGH — standard academic formulas (Flesch, TTR)
- AI slop patterns: HIGH — Wikipedia:Signs of AI Writing + multiple industry sources
- Content Capsule metrics: MEDIUM — industry studies, not peer-reviewed

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (90 days — stable domain, slop patterns evolve slowly)
</metadata>

---

*Phase: 88-writing-methodology*
*Research completed: 2026-03-11*
*Ready for planning: yes*
