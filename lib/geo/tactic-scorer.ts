/**
 * GEO Tactic Scorer — Princeton 9-Tactic Scoring Engine
 *
 * Pure TypeScript scoring functions (no external API calls, <100ms per call).
 * Based on the Princeton KDD 2024 paper "GEO: Generative Engine Optimisation"
 * (arXiv:2311.09735) by Aggarwal, Murahari et al.
 *
 * Each scorer receives the full text and returns a 0–100 score.
 *
 * Composite weighting (from paper effectiveness ratings):
 *   citations: 20%, statistics: 18%, quotations: 15%, fluency: 12%,
 *   readability: 10%, technical-vocabulary: 9%, uniqueness: 8%,
 *   information-flow: 5%, persuasion: 3%
 *
 * @module lib/geo/tactic-scorer
 */

import type { GEOTactic, TacticScore, TacticScoreResult, TacticStatus } from './types';
import { getTacticWeights, TACTIC_DEFAULTS } from '@/lib/bayesian/surfaces/tactic-weights';

// ─── Constants ─────────────────────────────────────────────────────────────────

// Retained as the fallback constant — used when no orgId is provided
const COMPOSITE_WEIGHTS: Record<GEOTactic, number> = TACTIC_DEFAULTS;

const TACTIC_LABELS: Record<GEOTactic, string> = {
  'authoritative-citations': 'Authoritative Citations',
  'statistics':              'Statistics',
  'quotations':              'Quotations',
  'fluency':                 'Fluency',
  'readability':             'Readability',
  'technical-vocabulary':    'Technical Vocabulary',
  'uniqueness':              'Uniqueness',
  'information-flow':        'Information Flow',
  'persuasion':              'Persuasion',
};

// ─── Utility ───────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toStatus(score: number): TacticStatus {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Individual Scorers ────────────────────────────────────────────────────────

/**
 * 1. Authoritative Citations (+40%)
 * Named references per 200 words. Target: 4 citations per 200 words = 100.
 * Patterns: "According to [Source]", "(Author, YYYY)", "per the [Org]", "reported by"
 */
function scoreAuthoritativeCitations(text: string): { score: number; found: number } {
  const words = wordCount(text);
  const per200 = words > 0 ? 200 / words : 1;

  const patterns = [
    /according to\s+[A-Z][a-zA-Z\s]+(?:,|\.|'s)?/gi,
    /\(\s*[A-Z][a-zA-Z\-]+(?:\s+et\s+al\.?)?,?\s*(?:19|20)\d{2}\s*\)/gi,
    /per\s+(?:the\s+)?[A-Z][a-zA-Z\s]{2,30}(?:report|study|data|survey|research)?/gi,
    /reported by\s+[A-Z][a-zA-Z\s]+/gi,
    /(?:cited by|as noted by|as stated by)\s+[A-Z][a-zA-Z\s]+/gi,
    /[A-Z][a-zA-Z\s]{2,30}(?:\s+\d{4})?\s+(?:found|shows?|reports?|states?|notes?)\s+that/gi,
    /source:\s*[A-Z][a-zA-Z\s]+/gi,
    /—\s*[A-Z][a-zA-Z\s]{2,30},\s+(?:19|20)\d{2}/g,
  ];

  let found = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) found += matches.length;
  }

  // 4 per 200 words = 100; scale linearly
  const normalised = found * per200 * 25; // 4 citations → 100
  return { score: clamp(normalised), found };
}

/**
 * 2. Statistics (+37%)
 * Specific numbers with context. Target: 3 stats per 200 words = 100.
 * Match: percentages, numbers with units (million/billion/thousand/%)
 */
function scoreStatistics(text: string): { score: number; found: number } {
  const words = wordCount(text);
  const per200 = words > 0 ? 200 / words : 1;

  const patterns = [
    /\d+(?:\.\d+)?%/g,                                          // percentages
    /\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|thousand|k|M|B)\b/gi, // large numbers
    /\$\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:million|billion|k|M|B))?/g,   // currency amounts
    /\d+(?:\.\d+)?\s*(?:times|x|fold)\s+(?:more|less|greater|higher|lower)/gi,
    /(?:increased?|decreased?|grew|declined?|rose|fell)\s+by\s+\d+(?:\.\d+)?%/gi,
    /\d+\s+(?:out of|in)\s+\d+/gi,                             // ratios
    /\d+(?:,\d{3})+/g,                                          // large formatted numbers
  ];

  const seen = new Set<string>();
  let found = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern) ?? [];
    for (const m of matches) {
      if (!seen.has(m)) {
        seen.add(m);
        found++;
      }
    }
  }

  // 3 per 200 words = 100
  const normalised = found * per200 * (100 / 3);
  return { score: clamp(normalised), found };
}

/**
 * 3. Quotations (+30%)
 * Attributed direct quotes >20 chars. Target: 1 per 300 words = 100.
 * Patterns: "quoted text" — Name or > blockquote markers
 */
function scoreQuotations(text: string): { score: number; found: number } {
  const words = wordCount(text);
  const per300 = words > 0 ? 300 / words : 1;

  // Match quoted text longer than 20 chars
  const quotePatterns = [
    /"([^"]{20,})"/g,
    /\u201C([^\u201D]{20,})\u201D/g,  // curly double quotes
    /\u2018([^\u2019]{20,})\u2019/g,  // curly single quotes
    />\s*(.{20,})/gm,                 // blockquote markers
  ];

  let found = 0;
  for (const pattern of quotePatterns) {
    const matches = text.match(pattern);
    if (matches) found += matches.length;
  }

  // 1 per 300 words = 100
  const normalised = found * per300 * 100;
  return { score: clamp(normalised), found };
}

/**
 * 4. Fluency (+25%)
 * Inverted hedge density. 0 hedges/100 words = 100. 5+ hedges/100 words = 0.
 * Hedge words: might, perhaps, could possibly, seems to, appears to, maybe,
 *              possibly, arguably, somewhat, rather
 */
function scoreFluency(text: string): { score: number; hedgeCount: number } {
  const words = wordCount(text);
  if (words === 0) return { score: 50, hedgeCount: 0 };

  const hedgePatterns = [
    /\bmight\b/gi,
    /\bperhaps\b/gi,
    /\bcould possibly\b/gi,
    /\bseems? to\b/gi,
    /\bappears? to\b/gi,
    /\bit seems?\b/gi,
    /\bmaybe\b/gi,
    /\bpossibly\b/gi,
    /\barguably\b/gi,
    /\bsomewhat\b/gi,
    /\brather\b/gi,
    /\bkind of\b/gi,
    /\bsort of\b/gi,
    /\baround\b/gi,     // when used vaguely ("around 50%")
    /\bapproximately\b/gi,
    /\btend to\b/gi,
    /\bcan sometimes\b/gi,
  ];

  let hedgeCount = 0;
  for (const pattern of hedgePatterns) {
    const matches = text.match(pattern);
    if (matches) hedgeCount += matches.length;
  }

  const hedgesPer100 = (hedgeCount / words) * 100;
  // 0 hedges = 100, 5+ hedges/100 words = 0. Linear interpolation.
  const score = Math.max(0, 100 - (hedgesPer100 / 5) * 100);
  return { score: clamp(score), hedgeCount };
}

/**
 * 5. Readability (+20%)
 * Sentence length proxy (Flesch-Kincaid approximation).
 * Target: 15-18 words avg = 100. <10 or >25 = 50. >35 = 20.
 */
function scoreReadability(text: string): { score: number; avgSentenceLength: number } {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  if (sentences.length === 0) return { score: 50, avgSentenceLength: 0 };

  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

  let score: number;
  if (avg >= 15 && avg <= 18) {
    score = 100;
  } else if (avg > 18 && avg <= 25) {
    // Linear from 100 at 18 to 50 at 25
    score = 100 - ((avg - 18) / 7) * 50;
  } else if (avg > 25 && avg <= 35) {
    // Linear from 50 at 25 to 20 at 35
    score = 50 - ((avg - 25) / 10) * 30;
  } else if (avg > 35) {
    score = 20;
  } else if (avg >= 10) {
    // 10-14: linear from 50 at 10 to 100 at 15
    score = 50 + ((avg - 10) / 5) * 50;
  } else {
    // <10: too short/choppy
    score = 50;
  }

  return { score: clamp(score), avgSentenceLength: Math.round(avg) };
}

/**
 * 6. Technical Vocabulary (+18%)
 * Defined terms and domain abbreviations.
 * Patterns: "Term (ABBR)", "ABBR — definition", standalone 2-5 char ALLCAPS
 * defined term = 20pts, abbreviation usage = 5pts each. Cap at 100.
 */
function scoreTechnicalVocabulary(text: string): { score: number; termCount: number; abbrCount: number } {
  // Defined terms: "Something (ABBR)" or "ABBR (definition)"
  const definedTermPattern = /[A-Z][a-zA-Z\s]{2,30}\s*\([A-Z]{2,6}\)/g;
  // Abbreviation definitions: "ABBR — some definition" or "ABBR: definition"
  const abbrDefinitionPattern = /\b[A-Z]{2,6}\s*(?:—|-|:)\s+[a-z]/g;
  // Standalone ALLCAPS abbreviations (2-5 chars)
  const standaloneAbbrPattern = /\b[A-Z]{2,5}\b/g;

  const definedTerms = text.match(definedTermPattern) ?? [];
  const abbrDefs = text.match(abbrDefinitionPattern) ?? [];

  // Filter out common false-positive ALL-CAPS (I, A, US, UK, etc.)
  const commonWords = new Set(['I', 'A', 'AN', 'THE', 'OR', 'AND', 'TO', 'IN', 'IS', 'IT', 'ON', 'AT', 'BY', 'NO', 'SO', 'DO', 'GO']);
  const standaloneAbbrs = (text.match(standaloneAbbrPattern) ?? []).filter(m => !commonWords.has(m));

  const termCount = definedTerms.length + abbrDefs.length;
  const abbrCount = standaloneAbbrs.length;

  const score = (termCount * 20) + (abbrCount * 5);
  return { score: clamp(score), termCount, abbrCount };
}

/**
 * 7. Uniqueness (+15%)
 * Type-token ratio (TTR) for vocabulary diversity.
 * TTR > 0.65 = 100, TTR < 0.35 = 10. Linear between.
 * Also penalise 3-gram repetition (>3 occurrences of same 3-gram).
 */
function scoreUniqueness(text: string): { score: number; ttr: number } {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { score: 50, ttr: 0 };

  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;

  let score: number;
  if (ttr >= 0.65) {
    score = 100;
  } else if (ttr <= 0.35) {
    score = 10;
  } else {
    // Linear from 10 at 0.35 to 100 at 0.65
    score = 10 + ((ttr - 0.35) / 0.30) * 90;
  }

  // Penalise repeated 3-grams (reduce by 5pts per repeated 3-gram found more than once)
  const trigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigrams.set(trigram, (trigrams.get(trigram) ?? 0) + 1);
  }

  let repetitions = 0;
  for (const count of trigrams.values()) {
    if (count > 2) repetitions += count - 2;
  }

  score = Math.max(10, score - repetitions * 5);
  return { score: clamp(score), ttr: Math.round(ttr * 100) / 100 };
}

/**
 * 8. Information Flow (+15-30%)
 * Transition phrase density. Target: 1 transition per paragraph = 100.
 */
function scoreInformationFlow(text: string): { score: number; transitionCount: number; paragraphCount: number } {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);
  const paragraphCount = Math.max(1, paragraphs.length);

  const transitions = [
    /\bfurthermore\b/gi,
    /\bmoreover\b/gi,
    /\bhowever\b/gi,
    /\btherefore\b/gi,
    /\bconsequently\b/gi,
    /\bin addition\b/gi,
    /\bbuilding on\b/gi,
    /\bbeyond that\b/gi,
    /\bas a result\b/gi,
    /\bthis means\b/gi,
    /\bspecifically\b/gi,
    /\bfor example\b/gi,
    /\bfor instance\b/gi,
    /\bnotably\b/gi,
    /\badditionally\b/gi,
    /\bin contrast\b/gi,
    /\bon the other hand\b/gi,
    /\bin summary\b/gi,
    /\bto summarise\b/gi,
    /\boverall\b/gi,
    /\bultimately\b/gi,
    /\bthis is why\b/gi,
    /\bas a consequence\b/gi,
    /\bthus\b/gi,
    /\bhence\b/gi,
  ];

  let transitionCount = 0;
  for (const t of transitions) {
    const matches = text.match(t);
    if (matches) transitionCount += matches.length;
  }

  // 1 transition per paragraph = 100. 0 = 20. Cap at 100.
  const ratio = transitionCount / paragraphCount;
  const score = 20 + Math.min(80, ratio * 80);
  return { score: clamp(score), transitionCount, paragraphCount };
}

/**
 * 9. Persuasion (-10% if overdone)
 * Inverted keyword density. Penalise 3-gram repetitions.
 * 0-2 max repetitions = 100, 3-4 = 70, 5-6 = 40, 7+ = 20.
 */
function scorePersuasion(text: string): { score: number; maxRepetitions: number } {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);

  const trigrams = new Map<string, number>();
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigrams.set(trigram, (trigrams.get(trigram) ?? 0) + 1);
  }

  let maxRepetitions = 0;
  for (const count of trigrams.values()) {
    if (count > maxRepetitions) maxRepetitions = count;
  }

  let score: number;
  if (maxRepetitions <= 2) {
    score = 100;
  } else if (maxRepetitions <= 4) {
    score = 70;
  } else if (maxRepetitions <= 6) {
    score = 40;
  } else {
    score = 20;
  }

  return { score, maxRepetitions };
}

// ─── Explanation & Suggestions ─────────────────────────────────────────────────

interface TacticMeta {
  explanation: (score: number, data: Record<string, unknown>) => string;
  suggestions: (score: number, data: Record<string, unknown>) => string[];
}

const TACTIC_META: Record<GEOTactic, TacticMeta> = {
  'authoritative-citations': {
    explanation: (score, data) => {
      const found = data.found as number;
      if (score >= 70) return `Good citation density (${found} found). Continue adding named sources.`;
      if (score >= 40) return `Add 1–2 more named citations per section (${found} found).`;
      return `Add named citations (e.g., "According to [Source], [Year]") to every major point.`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Maintain current citation density', 'Ensure citations include year and organisation name'];
      if (score >= 40) return [
        'Add "According to [Source Name], [Year]," before key claims',
        'Include industry reports, research papers, or government sources',
        'Use "(Author, Year)" format for academic-style citations',
      ];
      return [
        'Add a named citation to every major claim or statistic',
        'Reference authoritative sources: industry bodies, research institutions, government agencies',
        'Format: "According to Gartner (2024), [claim]" or "(Source, 2024)"',
      ];
    },
  },

  'statistics': {
    explanation: (score, data) => {
      const found = data.found as number;
      if (score >= 70) return `Good statistical density (${found} figures found). Keep quantifying claims.`;
      if (score >= 40) return `Add more specific numbers (${found} found). Replace vague claims with figures.`;
      return `Replace vague claims with specific statistics. AI engines strongly prefer quantified content.`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Add attribution to existing statistics', 'Use percentages and precise numbers'];
      if (score >= 40) return [
        'Replace "many companies" with a specific percentage or count',
        'Add "(Source: [Industry Body])" after each statistic',
        'Include year-over-year comparisons with numbers',
      ];
      return [
        'Quantify every claim: "most businesses" → "72% of businesses (Source: 2024 survey)"',
        'Add statistics for scale: market size, growth rates, adoption rates',
        'Use specific numbers rather than ranges where possible',
      ];
    },
  },

  'quotations': {
    explanation: (score, data) => {
      const found = data.found as number;
      if (score >= 70) return `Good use of attributed quotes (${found} found).`;
      if (score >= 40) return `Add 1–2 more attributed quotes (${found} found).`;
      return `Add direct quotes from named experts or studies (${found} found).`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Keep quotes attributed with name, title, and organisation'];
      if (score >= 40) return [
        'Add a quote from an industry expert or study author',
        'Format: "Name, Title at Organisation, states: \'[quote]\'"',
      ];
      return [
        'Add at least 1 attributed quote per major section',
        'Use format: "[Expert Name], [Title], [Organisation]: \'[quote text]\'"',
        'Quotes >20 characters score better — use substantive excerpts',
      ];
    },
  },

  'fluency': {
    explanation: (score, data) => {
      const hedgeCount = data.hedgeCount as number;
      if (score >= 70) return `Strong declarative language. ${hedgeCount} hedge words found.`;
      if (score >= 40) return `Reduce hedge words (${hedgeCount} found: might, perhaps, could, etc.).`;
      return `Too many hedge words (${hedgeCount} found). AI engines prefer confident, declarative statements.`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Maintain confident, declarative tone'];
      if (score >= 40) return [
        'Replace "might" with "will" or "does" where accurate',
        'Replace "perhaps" and "arguably" with direct assertions',
        'Convert "it seems that X" to "X is" where factually accurate',
      ];
      return [
        'Replace all hedge words: might→will, perhaps→(remove), could→does',
        'Rewrite vague assertions as confident factual statements',
        'Use active voice: "Studies show X" not "X may possibly be shown"',
      ];
    },
  },

  'readability': {
    explanation: (score, data) => {
      const avg = data.avgSentenceLength as number;
      if (score >= 70) return `Good sentence length (avg ${avg} words). Optimal for AI engines.`;
      if (avg > 22) return `Sentences too long (avg ${avg} words). Split long sentences.`;
      return `Aim for 15–18 word average sentences (currently avg ${avg} words).`;
    },
    suggestions: (score, data) => {
      const avg = data.avgSentenceLength as number;
      if (score >= 70) return ['Maintain current sentence length balance'];
      if (avg > 25) return [
        'Split sentences over 25 words into two shorter sentences',
        'Use full stops more liberally to break up complex ideas',
        'Aim for 15–18 words per sentence on average',
      ];
      return [
        'Ensure sentences are complete thoughts (not too short or fragmented)',
        'Join very short sentences (<8 words) into natural compounds',
        'Target a mix of short punchy sentences and medium-length explanations',
      ];
    },
  },

  'technical-vocabulary': {
    explanation: (score, data) => {
      const termCount = data.termCount as number;
      if (score >= 70) return `Good technical vocabulary (${termCount} defined terms/abbreviations).`;
      if (score >= 40) return `Add more defined terms (${termCount} found). Include domain abbreviations.`;
      return `Add domain-specific terms with definitions (${termCount} found).`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Continue defining technical terms on first use'];
      if (score >= 40) return [
        'Introduce domain acronyms: "Search Engine Results Pages (SERPs)"',
        'Define key concepts on first use: "Term (definition)"',
        'Use precise technical language instead of generic descriptions',
      ];
      return [
        'Define all technical terms on first use: "Machine Learning (ML)"',
        'Use precise industry terminology rather than generic language',
        'Include relevant acronyms with their full forms',
      ];
    },
  },

  'uniqueness': {
    explanation: (score, data) => {
      const ttr = data.ttr as number;
      if (score >= 70) return `Good vocabulary diversity (TTR: ${ttr}). Low repetition detected.`;
      if (score >= 40) return `Moderate repetition (TTR: ${ttr}). Vary vocabulary more.`;
      return `High repetition detected (TTR: ${ttr}). Diversify word choices.`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Maintain vocabulary diversity', 'Use synonyms for frequently repeated concepts'];
      if (score >= 40) return [
        'Find the 3 most-repeated words and use synonyms in some instances',
        'Vary sentence starters — avoid beginning multiple consecutive sentences the same way',
        'Replace generic words (good, great, important) with specific descriptors',
      ];
      return [
        'Identify and replace repeated 3-word phrases using synonyms',
        'Use a thesaurus to diversify your core vocabulary',
        'Ensure each paragraph introduces new ideas rather than restating previous ones',
      ];
    },
  },

  'information-flow': {
    explanation: (score, data) => {
      const tc = data.transitionCount as number;
      const pc = data.paragraphCount as number;
      if (score >= 70) return `Good logical flow (${tc} transitions across ${pc} paragraphs).`;
      if (score >= 40) return `Add more transitions (${tc} across ${pc} paragraphs). Target 1 per paragraph.`;
      return `Poor information flow (${tc} transitions). Add logical connectors between paragraphs.`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Maintain transition phrase usage between paragraphs'];
      if (score >= 40) return [
        'Add "Furthermore," or "Building on this," at the start of paragraphs',
        'Use "As a result," to show cause-effect relationships',
        'Add "Specifically," or "For example," to introduce supporting details',
      ];
      return [
        'Start each paragraph with a transition phrase (Furthermore, Moreover, In contrast)',
        'Ensure each paragraph\'s final sentence sets up the next topic',
        'Use "This means that..." to explicitly connect ideas',
      ];
    },
  },

  'persuasion': {
    explanation: (score, data) => {
      const maxRep = data.maxRepetitions as number;
      if (score >= 70) return `Natural keyword density. No keyword stuffing detected (max ${maxRep} repetitions).`;
      if (score >= 40) return `Some keyword repetition (max ${maxRep} exact phrase repetitions). Reduce slightly.`;
      return `Keyword stuffing detected (${maxRep} repetitions of same phrase). Reduce repetition.`;
    },
    suggestions: (score) => {
      if (score >= 70) return ['Maintain natural keyword density'];
      if (score >= 40) return [
        'Identify the most-repeated 3-word phrases and replace duplicates with synonyms',
        'Replace superlatives ("best", "most") with specific evidence',
        'Vary how you refer to key concepts rather than using exact phrases repeatedly',
      ];
      return [
        'Rewrite duplicate 3-word phrases — never repeat the same phrase more than twice',
        'Replace keyword stuffing with semantic variations',
        'AI engines penalise over-optimised content — write for readers, not search engines',
      ];
    },
  },
};

// ─── Main Orchestrator ─────────────────────────────────────────────────────────

/**
 * Score content against all 9 Princeton GEO tactics.
 *
 * Accepts an optional orgId to enable BO-optimised weights per organisation.
 * Falls back to heuristic weights when orgId is absent or the BO service is
 * unavailable — no user-visible impact.
 *
 * @param text  - Content to score (plain text)
 * @param orgId - Optional organisation ID for BO weight lookup
 * @returns TacticScoreResult with all 9 TacticScore objects and composite score
 */
export async function scoreTactics(text: string, orgId?: string): Promise<TacticScoreResult> {
  // Resolve weights: BO-optimised per org when available, heuristic otherwise
  const weights = orgId
    ? (await getTacticWeights(orgId)).weights
    : COMPOSITE_WEIGHTS;

  const words = wordCount(text);

  // Guard: insufficient content
  if (text.trim().length < 50 || words < 10) {
    const neutralScores: TacticScore[] = (Object.keys(weights) as GEOTactic[]).map(tactic => ({
      tactic,
      label: TACTIC_LABELS[tactic],
      score: 50,
      status: 'amber' as TacticStatus,
      explanation: 'Add more content to score',
      suggestions: ['Add at least 50 characters of content to enable tactic scoring'],
    }));

    return {
      tacticScores: neutralScores,
      compositeGEOScore: 50,
      wordCount: words,
      scoredAt: new Date().toISOString(),
    };
  }

  // Run all 9 scorers
  const citationsResult = scoreAuthoritativeCitations(text);
  const statisticsResult = scoreStatistics(text);
  const quotationsResult = scoreQuotations(text);
  const fluencyResult = scoreFluency(text);
  const readabilityResult = scoreReadability(text);
  const techVocabResult = scoreTechnicalVocabulary(text);
  const uniquenessResult = scoreUniqueness(text);
  const infoFlowResult = scoreInformationFlow(text);
  const persuasionResult = scorePersuasion(text);

  const rawScores: Record<GEOTactic, { score: number; data: Record<string, unknown> }> = {
    'authoritative-citations': { score: citationsResult.score, data: { found: citationsResult.found } },
    'statistics':              { score: statisticsResult.score, data: { found: statisticsResult.found } },
    'quotations':              { score: quotationsResult.score, data: { found: quotationsResult.found } },
    'fluency':                 { score: fluencyResult.score, data: { hedgeCount: fluencyResult.hedgeCount } },
    'readability':             { score: readabilityResult.score, data: { avgSentenceLength: readabilityResult.avgSentenceLength } },
    'technical-vocabulary':    { score: techVocabResult.score, data: { termCount: techVocabResult.termCount, abbrCount: techVocabResult.abbrCount } },
    'uniqueness':              { score: uniquenessResult.score, data: { ttr: uniquenessResult.ttr } },
    'information-flow':        { score: infoFlowResult.score, data: { transitionCount: infoFlowResult.transitionCount, paragraphCount: infoFlowResult.paragraphCount } },
    'persuasion':              { score: persuasionResult.score, data: { maxRepetitions: persuasionResult.maxRepetitions } },
  };

  // Build TacticScore objects
  const tacticScores: TacticScore[] = (Object.keys(weights) as GEOTactic[]).map(tactic => {
    const { score, data } = rawScores[tactic];
    const status = toStatus(score);
    const meta = TACTIC_META[tactic];
    return {
      tactic,
      label: TACTIC_LABELS[tactic],
      score,
      status,
      explanation: meta.explanation(score, data),
      suggestions: meta.suggestions(score, data),
    };
  });

  // Composite weighted score using resolved weights
  const compositeGEOScore = clamp(
    tacticScores.reduce((sum, ts) => sum + ts.score * weights[ts.tactic], 0)
  );

  return {
    tacticScores,
    compositeGEOScore,
    wordCount: words,
    scoredAt: new Date().toISOString(),
  };
}
