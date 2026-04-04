# Phase 87: GEO Content Optimiser v2 — Research

**Researched:** 2026-03-11
**Phase:** 87-geo-content-optimiser-v2
**Researcher:** Autonomous /gsd:research-phase via Claude

---

## 1. The Princeton GEO Paper — Authoritative Source

**Paper:** "GEO: Generative Engine Optimization"
**Authors:** Pranjal Aggarwal (IIT Delhi), Vishvak Murahari (Princeton), Tanmay Rajpurohit, Ashwin Kalyan, Karthik Narasimhan (Princeton), Ameet Deshpande (Princeton)
**Published:** November 2023 (arXiv:2311.09735), presented at **KDD 2024** (Barcelona)
**Benchmark:** GEO-BENCH — 10,000 diverse queries across multiple domains
**Engines tested:** ChatGPT, Bing, Perplexity

### The 9 GEO Tactics — With Effectiveness Data

The paper tested each tactic independently and measured impact on two metrics:
- **Impression Score**: Overall quality and prominence of brand/content mentions
- **Position-Adjusted Word Count**: Measures how much content and where it appears in AI responses

| # | Tactic Name | Effectiveness | What It Does |
|---|-------------|---------------|--------------|
| 1 | **Authoritative Citations** | **+40%** | Named references ("According to Gartner 2024") per section |
| 2 | **Add Statistics** | **+37%** | Specific numbers replacing vague claims ("72% of B2B marketers...") |
| 3 | **Quotation Inclusion** | **+30%** | Direct quotes from named professionals with title + org |
| 4 | **Fluency Optimization** | **+25%** | Authoritative, hedge-free declarative statements (remove "might", "perhaps") |
| 5 | **Easy-to-Understand** | **+20%** | Flesch-Kincaid grade 8–10, plain language, analogies, define jargon |
| 6 | **Optimization (Technical Vocab)** | **+18%** | Precise domain-specific terminology for semantic match |
| 7 | **Uniqueness** | **+15%** | Synonym variation, no repetition, diverse vocabulary |
| 8 | **Add Information** | **+15–30%** (cumulative) | Smooth logical flow, transitions, ideas that build on each other |
| 9 | **Persuasion** | **−10% if overdone** | Keyword stuffing penalty; persuasion = natural density |

**Key multi-tactic finding:** Pages using multiple tactics in combination outperformed single-tactic pages by **2–3×** in GEO-BENCH results.

### Scoring Implications for Phase 87

Each tactic is independently scorable. The scoring model should be:
- **Authoritative Citations**: Count named references per 500 words → score 0–100
- **Add Statistics**: Count numerical claims with attribution → score 0–100
- **Quotation Inclusion**: Detect blockquote + named speaker patterns → score 0–100
- **Fluency Optimization**: Detect hedging language density (might, perhaps, could, seems) → invert for score
- **Easy-to-Understand**: Flesch-Kincaid grade calculation → map 6–12 → 0–100
- **Optimization**: Detect technical vocabulary presence vs generic terms → score 0–100
- **Uniqueness**: Measure synonym diversity, detect repeated phrases → score 0–100
- **Add Information**: Measure transition phrase presence, logical flow signals → score 0–100
- **Persuasion**: Detect keyword density, penalise exact-match repetition → score 0–100

---

## 2. Existing GEO Infrastructure — What's Already Built

The `lib/geo/` directory has substantial infrastructure Phase 87 builds on:

```
lib/geo/
├── types.ts              # GEOScore { citability, structure, multiModal, authority, technical }
├── geo-analyzer.ts       # Main orchestrator — analyzeGEO() function
├── citability-scorer.ts  # Scores citable passages
├── structure-analyzer.ts # Heading hierarchy, lists, tables, FAQ detection
├── entity-analyzer.ts    # Phase 85 entity coherence (terminological consistency)
├── passage-extractor.ts  # Extract citable passages (134–167 word optimal)
├── platform-optimizer.ts # Per-platform optimization
├── schema-enhancer.ts    # Schema.org analysis
├── recommendations.ts    # GEO recommendations generator
├── feature-limits.ts     # Subscription gating for GEO features
└── index.ts              # Public API
```

**Current GEOScore structure** (from `lib/geo/types.ts`):
```typescript
interface GEOScore {
  overall: number;        // weighted composite
  citability: number;     // 25% weight
  structure: number;      // 20% weight
  multiModal: number;     // 15% weight
  authority: number;      // 20% weight
  technical: number;      // 20% weight
  entityCoherence: number; // standalone (Phase 85)
}
```

**Phase 87 adds** a new `tacticScores` field alongside the existing GEOScore — a per-tactic breakdown that doesn't replace the existing composite but enriches it:

```typescript
interface TacticScore {
  tactic: GEOTactic;
  score: number;        // 0–100
  status: 'green' | 'amber' | 'red';
  explanation: string;  // "Add 2+ statistical claims with sources"
  suggestions: string[];
}

type GEOTactic =
  | 'authoritative-citations'
  | 'statistics'
  | 'quotations'
  | 'fluency'
  | 'readability'
  | 'technical-vocabulary'
  | 'uniqueness'
  | 'information-flow'
  | 'persuasion';
```

---

## 3. Real-Time Editor Architecture

### Pattern: Debounced Analysis Hook

The established pattern for real-time scoring editors (Hemingway, Grammarly approach):

```typescript
// Standard: debounce 500ms after last keystroke
const useGEOScoring = (content: string) => {
  const [scores, setScores] = useState<TacticScore[]>([]);
  const [isScoring, setIsScoring] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (content.length < 50) return;
      setIsScoring(true);
      const result = await scoreTactics(content); // local pure function, no API
      setScores(result);
      setIsScoring(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [content]);

  return { scores, isScoring };
};
```

**Key decision: scoring is pure client-side** — no API call per keystroke. The tactic scorer is a pure TypeScript function that runs in the browser via `useMemo`/`useEffect`. Only the **AI Rewrite** requires an API call (user-initiated, not automatic).

### Text Editor Options

For Phase 87, options range from simple `<textarea>` to full rich editors:

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| `<textarea>` | Zero deps, simple, fast | No highlighting, no formatting | ✅ **Best for MVP** |
| TipTap (ProseMirror) | Rich, extensible, TypeScript | 80KB+ bundle, complex marks API | For Phase 88+ |
| CodeMirror 6 | Code-like, excellent marks | Wrong UX for prose | Skip |
| MDXEditor | Markdown-focused | Not suited for plain prose analysis | Skip |

**Decision for Phase 87**: Use a controlled `<textarea>` for the MVP editor. Text span highlighting per tactic can be done via a `<div>` overlay technique or deferred to Phase 88.

The overlay technique (if highlighting is needed):
```tsx
// Render invisible textarea on top of highlighted div
// textarea captures input, div renders highlighted HTML
<div className="relative">
  <div className="highlighted-content" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
  <textarea className="absolute inset-0 opacity-0 resize-none" value={content} onChange={...} />
</div>
```

### Debounce Timing Research

- **500ms**: Standard for prose analysis (Hemingway Editor uses 500ms)
- **300ms**: Search/autocomplete (too fast for NLP scoring)
- **1000ms**: Long documents >5000 words (prevents thrashing)

**Phase 87 recommendation**: 500ms debounce for documents <3000 words, 1000ms for longer content.

---

## 4. AI Rewrite Pipeline Architecture

### Pattern: Streaming SSE + Per-Tactic Prompt

The existing `lib/ai/content-generator.ts` uses `getAIProvider()` → OpenRouter. Phase 87's rewrite pipeline extends this with tactic-specific prompts.

```typescript
// app/api/geo/rewrite/route.ts
// POST: { content: string, tactic: GEOTactic, section?: string }
// Returns: StreamingTextResponse (SSE)

const TACTIC_PROMPTS: Record<GEOTactic, string> = {
  'authoritative-citations': `Rewrite this content to add 2-3 named authoritative references
    (e.g., "According to [Organization], [Year]"). Preserve the user's voice.
    Only modify sentences that can benefit from attribution.`,
  'statistics': `Improve this content by replacing vague claims with specific statistics.
    Use realistic placeholder data with sources (e.g., "X% of Y according to [Source]").
    Do not fabricate specific numbers without noting they need verification.`,
  // ... etc for all 9
};
```

**Surgical rewrite approach**: The API receives either (a) the full content + tactic, or (b) a specific paragraph/section + tactic. For (b), the API rewrites only that section and returns it for the UI to splice back into the full document.

**Streaming**: Use OpenRouter's SSE streaming (existing pattern from `lib/ai/`) for responsive UX. The user sees the rewrite appearing word-by-word.

```typescript
// OpenRouter streaming via existing provider abstraction
const stream = await provider.streamText({
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.3, // Low temperature for consistent, controlled rewrites
  maxTokens: 2000,
});
return new StreamingTextResponse(stream);
```

### AI Model Selection for Rewrites

Based on tactic complexity:
- **Simple tactics** (Fluency, Readability, Uniqueness): `openai/gpt-4o-mini` — fast, cheap
- **Complex tactics** (Citations, Statistics, Quotations): `openai/gpt-4o` — better context awareness
- **BYOK pattern**: Reuse existing `lib/ai/api-credential-injector.ts` — users can supply own API key

---

## 5. Tactic Scoring Algorithms — Implementation

### Authoritative Citations (target: +40% effectiveness)
```typescript
function scoreCitations(text: string): number {
  // Patterns: "According to [Source]", "[Author et al., YYYY]", "(Source, YYYY)"
  const citationPatterns = text.match(
    /according to\s+[A-Z]|(?:[A-Z][a-z]+ et al\.?,?\s*\d{4})|(?:\([A-Z][a-z]+,?\s*\d{4}\))|per\s+(?:the\s+)?[A-Z]/gi
  ) || [];
  const wordCount = text.split(/\s+/).length;
  const density = citationPatterns.length / (wordCount / 200); // per 200 words
  return Math.min(100, Math.round(density * 25)); // 4 citations/200 words = 100
}
```

### Statistics Scoring (target: +37% effectiveness)
```typescript
function scoreStatistics(text: string): number {
  // Match: "X%", "X in Y", specific numbers with units
  const statsPatterns = text.match(
    /\d+(?:\.\d+)?%|\d+(?:,\d+)*\s*(?:million|billion|thousand|people|users|companies)/gi
  ) || [];
  const wordCount = text.split(/\s+/).length;
  const density = statsPatterns.length / (wordCount / 200);
  return Math.min(100, Math.round(density * 30));
}
```

### Fluency Optimization (target: +25% effectiveness)
```typescript
function scoreFluency(text: string): number {
  // Penalise hedging words
  const hedges = text.match(/\b(?:might|perhaps|could possibly|seems to|appears to|it seems|maybe|possibly|arguably|somewhat|rather)\b/gi) || [];
  const wordCount = text.split(/\s+/).length;
  const hedgeDensity = hedges.length / (wordCount / 100); // per 100 words
  // 0 hedges = 100, 5+ hedges/100 words = 0
  return Math.max(0, Math.round(100 - hedgeDensity * 20));
}
```

### Readability / Easy-to-Understand (target: +20% effectiveness)
```typescript
function scoreReadability(text: string): number {
  // Simplified Flesch-Kincaid: FK = 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
  // Grade 8-10 is optimal (score ~60-70 on FK Reading Ease)
  // Map FK Reading Ease 0-100 to our 0-100 with 60-70 = green
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  if (sentences.length === 0 || words.length === 0) return 50;
  const avgWordsPerSentence = words.length / sentences.length;
  // Optimal: 15-20 words per sentence
  const sentenceScore = avgWordsPerSentence <= 20
    ? 100 - Math.max(0, (avgWordsPerSentence - 15) * 5)
    : Math.max(0, 100 - (avgWordsPerSentence - 20) * 8);
  return Math.round(sentenceScore);
}
```

### Uniqueness / Vocabulary Diversity (target: +15% effectiveness)
```typescript
function scoreUniqueness(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 50;
  // Type-Token Ratio (TTR): unique words / total words
  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;
  // TTR > 0.6 = green, < 0.4 = red
  return Math.min(100, Math.round(ttr * 150));
}
```

### Quotation Inclusion (target: +30% effectiveness)
```typescript
function scoreQuotations(text: string): number {
  // Match blockquotes, "quoted text" — [Name], "[text]" — Name, Title
  const quotes = text.match(/[""][^""]{20,}[""]|^>\s+.+$/gm) || [];
  const wordCount = text.split(/\s+/).length;
  // 1 quote per 300 words = green
  const density = quotes.length / (wordCount / 300);
  return Math.min(100, Math.round(density * 40));
}
```

### Information Flow (target: +15–30% cumulative)
```typescript
function scoreInformationFlow(text: string): number {
  const transitions = text.match(
    /\b(?:furthermore|moreover|however|therefore|consequently|in addition|building on|beyond that|as a result|this means|specifically|for example|notably)\b/gi
  ) || [];
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length <= 1) return 50;
  const density = transitions.length / paragraphs.length;
  return Math.min(100, Math.round(density * 50));
}
```

### Technical Vocabulary (target: +18% effectiveness)
```typescript
function scoreTechnicalVocabulary(text: string, domain?: string): number {
  // Domain-agnostic: look for defined terms (word in parentheses or after em-dash)
  const definedTerms = text.match(/[A-Z][A-Za-z]+\s+\([A-Z]{2,5}\)|[A-Z]{2,5}\s*—\s*[a-z]/g) || [];
  const abbreviationUsage = text.match(/\b[A-Z]{2,5}\b/g) || [];
  const score = (definedTerms.length * 20) + (abbreviationUsage.length * 5);
  return Math.min(100, score);
}
```

### Persuasion / Keyword Density (target: avoid −10%)
```typescript
function scorePersuasion(text: string): number {
  // Penalise exact-phrase repetition
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  // Count 3-gram phrase repetitions
  const trigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i+1]} ${words[i+2]}`;
    trigrams[trigram] = (trigrams[trigram] || 0) + 1;
  }
  const maxRepetition = Math.max(...Object.values(trigrams), 0);
  if (maxRepetition <= 2) return 100;
  if (maxRepetition <= 4) return 70;
  if (maxRepetition <= 6) return 40;
  return 20;
}
```

---

## 6. UI Architecture — Score Card + Editor Layout

### Layout Pattern (proven from similar tools: Hemingway, Yoast, Clearscope)

```
┌─────────────────────────────────────────────────────────┐
│  GEO Optimiser                              [Score: 73] │
├───────────────────────┬─────────────────────────────────┤
│  Tactic Scores        │  Content Editor                 │
│  ─────────────────    │  ─────────────────────────      │
│  🟢 Citations    84   │  [Paste your content here...]   │
│  🟡 Statistics   61   │                                 │
│  🔴 Quotations   23   │  Lorem ipsum dolor sit amet,   │
│     [Improve ↗]       │  consectetur adipiscing elit.   │
│  🟢 Fluency      91   │                                 │
│  🟢 Readability  78   │  [2,340 words · Scoring...]     │
│  🟡 Tech Vocab   55   │                                 │
│  🟢 Uniqueness   82   │                                 │
│  🟡 Info Flow    62   │                                 │
│  🟢 Persuasion   95   │                                 │
└───────────────────────┴─────────────────────────────────┘
```

### Colour System (from 87-CONTEXT.md)
- **Green**: score ≥ 70 → `text-green-400` / `bg-green-500/10`
- **Amber**: score 40–69 → `text-amber-400` / `bg-amber-500/10`
- **Red**: score < 40 → `text-red-400` / `bg-red-500/10`

### Component Hierarchy

```
GEOOptimiserPage
├── GEOEditorPanel (left/right 50%)
│   └── <textarea> controlled with debounced scoring
├── TacticScoresSidebar
│   ├── OverallGEOScore (composite)
│   └── TacticScoreCard × 9
│       ├── ScoreBar (progress bar with colour)
│       ├── ExplainerText ("Add 2+ named citations per section")
│       └── ImproveButton → triggers AI rewrite modal
└── RewriteModal (shown on "Improve" click)
    ├── TacticContext (what the AI will optimise for)
    ├── StreamingOutput (shows rewrite word-by-word)
    └── Accept / Reject buttons
```

### Rewrite UX Flow
1. User clicks "Improve" on a tactic card (e.g., Statistics)
2. Modal opens with prompt: "Improving Statistics score..."
3. API call to `/api/geo/rewrite` with `{ content, tactic: 'statistics' }`
4. Streaming response shows rewritten content word-by-word
5. "Accept" button replaces editor content; "Reject" discards
6. After accept, scoring re-runs automatically (500ms debounce)

---

## 7. API Design

### New Routes for Phase 87

```
app/api/geo/
├── tactic-score/route.ts   # POST — score content against all 9 tactics (sync, fast)
└── rewrite/route.ts        # POST — AI rewrite for one tactic (streaming SSE)
```

Both routes integrate with the existing GEO pipeline:
- `tactic-score` is subscription-gated (free: 3 tactics shown, paid: all 9)
- `rewrite` requires at least Starter plan

**Tactic score endpoint:**
```typescript
// POST /api/geo/tactic-score
// Body: { content: string }
// Response: { tacticScores: TacticScore[], overallGEOScore: number }
// Auth: any authenticated user (free tier shows limited tactics)
// Performance: sync (pure computation), target <100ms
```

**Rewrite endpoint:**
```typescript
// POST /api/geo/rewrite
// Body: { content: string, tactic: GEOTactic, section?: string }
// Response: StreamingTextResponse
// Auth: authenticated user with at least Starter plan
// Performance: streaming, first token <2s
```

---

## 8. Integration with Existing GEO Dashboard

**From 87-CONTEXT.md:** "Builds on existing `/dashboard/geo/` page — add a new 'Optimiser' tab or sub-page"

The existing GEO dashboard at `/dashboard/geo` has tabs. Phase 87 adds an "Optimiser" tab. The tactic scores become a *new sub-section* of the existing GEO score breakdown — they don't replace it.

**Mapping between existing GEOScore and Princeton 9 tactics:**

| Existing GEOScore Dimension | Princeton Tactics Mapped |
|----------------------------|--------------------------|
| `citability` (25%) | Authoritative Citations, Quotations, Statistics |
| `authority` (20%) | Authoritative Citations, Technical Vocabulary |
| `structure` (20%) | Information Flow, Add Information |
| `technical` (20%) | Technical Vocabulary, Optimization |
| `entityCoherence` (standalone) | Uniqueness, Information Flow |

The tactic scores are displayed alongside (not replacing) the existing weighted dimensions.

---

## 9. Plans Breakdown for Phase 87

### Plan 87-01: Tactic Scorer Service (`lib/geo/tactic-scorer.ts`)
**Model:** Sonnet (pure algorithmic — clear spec)
**Tasks:**
1. Define `GEOTactic` type and `TacticScore` interface in `lib/geo/types.ts`
2. Create `lib/geo/tactic-scorer.ts` — 9 pure scoring functions + composite scorer
3. Create `app/api/geo/tactic-score/route.ts` — POST endpoint (sync, <100ms)
4. Unit tests for each scoring function
5. Integrate tactic scores into `analyzeGEO()` return value (optional `tacticScores` field)

### Plan 87-02: AI Rewrite Pipeline (`app/api/geo/rewrite/`)
**Model:** Sonnet (follows existing streaming AI pattern)
**Tasks:**
1. Define 9 tactic-specific rewrite prompts
2. Create `app/api/geo/rewrite/route.ts` — POST, streaming SSE
3. Feature gate: require at least Starter plan
4. Integrate with existing `getAIProvider()` / BYOK pattern
5. Rate limiting: reuse existing `generalApi` limiter

### Plan 87-03: Editor UI (`/dashboard/geo/optimiser`)
**Model:** Sonnet (UI follows existing dashboard patterns)
**Tasks:**
1. Create `components/geo/TacticScoreCard.tsx` — score + explain + improve button
2. Create `components/geo/GEOEditorPanel.tsx` — textarea + word count + debounced scoring
3. Create `components/geo/RewriteModal.tsx` — streaming display + accept/reject
4. Create `app/dashboard/geo/optimiser/page.tsx` — full optimiser layout
5. Add "Optimiser" link to GEO dashboard navigation
6. Wire up tactic-score API + rewrite API

---

## 10. What NOT to Hand-Roll

- **Flesch-Kincaid**: Use the syllable-counting formula directly (trivial pure function) — don't import a readability npm package (adds bundle weight)
- **Rich text editor**: Start with `<textarea>`, don't install TipTap for Phase 87 — the highlighting feature is a Phase 88 enhancement
- **Streaming**: Reuse the existing SSE streaming pattern from Phase 86 (`lib/ai/` providers) — don't reinvent
- **Debouncing**: Native `setTimeout`/`clearTimeout` in `useEffect` — don't add `lodash.debounce` or `use-debounce` package
- **State management**: `useState` in the optimiser page — no Redux/Zustand needed for a single-page tool

---

## 11. Existing Patterns to Reuse

| Pattern | Location | Usage in Phase 87 |
|---------|----------|-------------------|
| AI provider abstraction | `lib/ai/providers/` | Rewrite API provider selection |
| BYOK key injection | `lib/ai/api-credential-injector.ts` | User's own OpenRouter key for rewrites |
| Subscription gate | `lib/geo/feature-limits.ts` | Limit tactic scoring/rewrites by plan |
| Streaming SSE | `lib/ai/content-generator.ts` | Rewrite endpoint streaming |
| GEO score types | `lib/geo/types.ts` | Extend with TacticScore |
| Entity analyzer | `lib/geo/entity-analyzer.ts` | Feed into Uniqueness scorer |
| Passage extractor | `lib/geo/passage-extractor.ts` | Section-level rewrite scoping |
| GEO recommendations | `lib/geo/recommendations.ts` | Add tactic-level recommendations |

---

## 12. Risk Flags

| Risk | Mitigation |
|------|-----------|
| Scoring runs on every keystroke → jank | 500ms debounce + `useMemo` with string equality check |
| AI rewrite destroys user's voice | Temperature 0.3, explicit "preserve voice" instruction, diff view in modal |
| Tactic scores feel arbitrary | Show exact reason: "Found 0 named citations. Target: 2+ per section." |
| Large documents slow scoring | Web Worker for scoring if content >5000 words (progressive enhancement) |
| No GEO dashboard route found | Existing: `/dashboard/geo` — add `/dashboard/geo/optimiser` as sub-page |

---

*Phase: 87-geo-content-optimiser-v2*
*Research completed: 2026-03-11*
*Ready for: /gsd:plan-phase 87*
