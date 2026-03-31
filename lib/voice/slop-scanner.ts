/**
 * AI Slop Tell-Phrase Scanner
 * Detects AI-generated content patterns in text.
 * @module lib/voice/slop-scanner
 */

import type {
  SlopMatch,
  SlopScanResult,
  SlopCategory,
  SlopSeverity,
} from './types';

interface SlopPattern {
  pattern: RegExp;
  phrase: string; // canonical display form
  category: SlopCategory;
  severity: SlopSeverity;
  suggestion?: string;
}

export const SLOP_PATTERNS_V1: SlopPattern[] = [
  // TRANSITION — lazy transitions
  {
    pattern: /\bin conclusion\b/gi,
    phrase: 'in conclusion',
    category: 'transition',
    severity: 'error',
    suggestion: 'End naturally or summarise directly',
  },
  {
    pattern: /\bin summary\b/gi,
    phrase: 'in summary',
    category: 'transition',
    severity: 'error',
    suggestion: 'Summarise without the signal phrase',
  },
  {
    pattern: /\bto summarize\b/gi,
    phrase: 'to summarize',
    category: 'transition',
    severity: 'error',
  },
  {
    pattern: /\bto summarise\b/gi,
    phrase: 'to summarise',
    category: 'transition',
    severity: 'error',
  },
  {
    pattern: /\bfurthermore\b/gi,
    phrase: 'furthermore',
    category: 'transition',
    severity: 'warning',
    suggestion: 'Also, or restructure the sentence',
  },
  {
    pattern: /\bmoreover\b/gi,
    phrase: 'moreover',
    category: 'transition',
    severity: 'warning',
    suggestion: 'Also, and, or restructure',
  },
  {
    pattern: /\badditionally\b/gi,
    phrase: 'additionally',
    category: 'transition',
    severity: 'warning',
    suggestion: 'Also, or start a new sentence',
  },
  {
    pattern: /\bit should be noted\b/gi,
    phrase: 'it should be noted',
    category: 'transition',
    severity: 'error',
  },
  {
    pattern: /\bneedless to say\b/gi,
    phrase: 'needless to say',
    category: 'transition',
    severity: 'error',
    suggestion: "Remove entirely — if needless, don't say it",
  },

  // FILLER — meaningless qualifiers
  {
    pattern: /\bit'?s important to note\b/gi,
    phrase: "it's important to note",
    category: 'filler',
    severity: 'error',
    suggestion: 'State the fact directly',
  },
  {
    pattern: /\bit'?s worth noting\b/gi,
    phrase: "it's worth noting",
    category: 'filler',
    severity: 'error',
    suggestion: 'State the fact directly',
  },
  {
    pattern: /\bit is important to\b/gi,
    phrase: 'it is important to',
    category: 'filler',
    severity: 'error',
  },
  {
    pattern: /\bas you can see\b/gi,
    phrase: 'as you can see',
    category: 'filler',
    severity: 'error',
    suggestion: 'Remove — the reader can see',
  },
  {
    pattern: /\bof course\b/gi,
    phrase: 'of course',
    category: 'filler',
    severity: 'warning',
  },
  {
    pattern: /\bobviously\b/gi,
    phrase: 'obviously',
    category: 'filler',
    severity: 'warning',
    suggestion: "If obvious, don't say it",
  },
  {
    pattern: /\bclearly\b/gi,
    phrase: 'clearly',
    category: 'filler',
    severity: 'warning',
  },

  // OVERUSED_WORD — LLM vocabulary
  {
    pattern: /\bdelves?\b/gi,
    phrase: 'delve',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'explores, examines, looks at',
  },
  {
    pattern: /\bdelving\b/gi,
    phrase: 'delving',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'exploring, examining',
  },
  {
    pattern: /\brobust\b/gi,
    phrase: 'robust',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'strong, reliable, solid',
  },
  {
    pattern: /\bleverag(e|ing|ed|es)\b/gi,
    phrase: 'leverage',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'use, apply, harness',
  },
  {
    pattern: /\bfoster(s|ing|ed)?\b/gi,
    phrase: 'foster',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'build, grow, encourage',
  },
  {
    pattern: /\benhance(s|d|ment)?\b/gi,
    phrase: 'enhance',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'improve, strengthen',
  },
  {
    pattern: /\bcomprehensive\b/gi,
    phrase: 'comprehensive',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'complete, full, thorough',
  },
  {
    pattern: /\binnovative\b/gi,
    phrase: 'innovative',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'new, fresh, novel — or be specific',
  },
  {
    pattern: /\bdynamic\b/gi,
    phrase: 'dynamic',
    category: 'overused-word',
    severity: 'warning',
  },
  {
    pattern: /\bseamlessly\b/gi,
    phrase: 'seamlessly',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'smoothly, easily, without friction',
  },
  {
    pattern: /\btapestr(y|ies)\b/gi,
    phrase: 'tapestry',
    category: 'overused-word',
    severity: 'error',
  },
  {
    pattern: /\bnuanced?\b/gi,
    phrase: 'nuance',
    category: 'overused-word',
    severity: 'warning',
  },
  {
    pattern: /\bmultifaceted\b/gi,
    phrase: 'multifaceted',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'complex, varied, many-sided',
  },
  {
    pattern: /\bpivotal\b/gi,
    phrase: 'pivotal',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'key, critical, decisive',
  },
  {
    pattern: /\bparamount\b/gi,
    phrase: 'paramount',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'most important, essential, critical',
  },
  {
    pattern: /\bcutting[- ]edge\b/gi,
    phrase: 'cutting-edge',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'leading, latest, state-of-the-art',
  },
  {
    pattern: /\bgame[- ]chang(ing|er)\b/gi,
    phrase: 'game-changer',
    category: 'overused-word',
    severity: 'warning',
  },

  // OVERUSED_WORD — video-sourced (Leila Hormozi memo analysis, SYN-567)
  {
    pattern: /\bembarked\b/gi,
    phrase: 'embarked',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'started, began',
  },
  {
    pattern: /\binvaluable\b/gi,
    phrase: 'invaluable',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'useful, essential',
  },
  {
    pattern: /\brelentless(ly)?\b/gi,
    phrase: 'relentless',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'steady, persistent',
  },
  {
    pattern: /\bgroundbreaking\b/gi,
    phrase: 'groundbreaking',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'new, first',
  },
  {
    pattern: /\bendeavou?r(s|ing|ed)?\b/gi,
    phrase: 'endeavour',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'effort, project, work',
  },
  {
    pattern: /\benlight(en|ened|ening)\b/gi,
    phrase: 'enlighten',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'inform, teach',
  },
  {
    pattern: /\besteemed\b/gi,
    phrase: 'esteemed',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'respected',
  },
  {
    pattern: /\bshed light\b/gi,
    phrase: 'shed light',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'explain, clarify, show',
  },
  {
    pattern: /\btreasure trove\b/gi,
    phrase: 'treasure trove',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'collection, source',
  },
  {
    pattern: /\btestament\b/gi,
    phrase: 'testament',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'proof, evidence, sign',
  },
  {
    pattern: /\bpertinent\b/gi,
    phrase: 'pertinent',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'relevant',
  },
  {
    pattern: /\bsynerg(y|ies)\b/gi,
    phrase: 'synergy',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'combined effect, cooperation',
  },
  {
    pattern: /\bunderscore[sd]?\b/gi,
    phrase: 'underscores',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'show, highlight',
  },
  {
    pattern: /\bnavigate the complexities\b/gi,
    phrase: 'navigate the complexities',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'handle, deal with, work through',
  },
  {
    pattern: /\bever[- ]changing landscape\b/gi,
    phrase: 'ever-changing landscape',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'Name the specific change',
  },
  {
    pattern: /\bdeep understanding\b/gi,
    phrase: 'deep understanding',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'knowledge of, familiarity with',
  },
  {
    pattern: /\bintricate\b/gi,
    phrase: 'intricate',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'complex, detailed',
  },
  {
    pattern: /\bcrucial\b/gi,
    phrase: 'crucial',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'important, key',
  },
  {
    pattern: /\belevat(e|es|ed|ing)\b/gi,
    phrase: 'elevate',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'raise, improve, lift',
  },
  {
    pattern: /\bresonat(e|es|ed|ing)\b/gi,
    phrase: 'resonate',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'connect, appeal, land',
  },
  {
    pattern: /\bofferings\b/gi,
    phrase: 'offerings',
    category: 'overused-word',
    severity: 'error',
    suggestion: 'products, services',
  },
  {
    pattern: /\bstreamlined?\b/gi,
    phrase: 'streamlined',
    category: 'overused-word',
    severity: 'warning',
    suggestion: 'simplified, faster',
  },

  // STRUCTURAL_PATTERN — AI templates
  {
    pattern: /not only .{3,60} but also/gi,
    phrase: 'not only ... but also',
    category: 'structural-pattern',
    severity: 'error',
    suggestion: 'Restructure into two separate statements',
  },
  {
    pattern: /\bin today'?s fast[- ]paced world\b/gi,
    phrase: "in today's fast-paced world",
    category: 'structural-pattern',
    severity: 'error',
    suggestion: 'Lead with your actual point',
  },
  {
    pattern: /\bas we navigate\b/gi,
    phrase: 'as we navigate',
    category: 'structural-pattern',
    severity: 'error',
  },
  {
    pattern: /\bin the ever[- ]evolving\b/gi,
    phrase: 'in the ever-evolving',
    category: 'structural-pattern',
    severity: 'error',
  },
  {
    pattern: /\bthe landscape of\b/gi,
    phrase: 'the landscape of',
    category: 'structural-pattern',
    severity: 'warning',
  },
  {
    pattern: /\bnot\s+(?:about\s+)?\w+,?\s+but\s+(?:rather\s+)?/gi,
    phrase: 'not X, but rather Y',
    category: 'structural-pattern',
    severity: 'warning',
    suggestion: 'State what it IS directly',
  },

  // VOICE_PATTERN — corporate therapist voice (SYN-567)
  {
    pattern: /\blean into\b/gi,
    phrase: 'lean into',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'commit to, focus on',
  },
  {
    pattern: /\bfoster a culture of\b/gi,
    phrase: 'foster a culture of',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'build, create',
  },
  {
    pattern: /\bpowerful opportunity\b/gi,
    phrase: 'powerful opportunity',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'chance, opening',
  },
  {
    pattern: /\bresilient and agile\b/gi,
    phrase: 'resilient and agile',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'State what specifically',
  },
  {
    pattern: /\bholistic approach\b/gi,
    phrase: 'holistic approach',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'full, complete',
  },
  {
    pattern: /\bempower(s|ing|ed)?\b/gi,
    phrase: 'empower',
    category: 'voice-pattern',
    severity: 'warning',
    suggestion: 'enable, help, let',
  },
  {
    pattern: /\bunlock(s|ing|ed)?\s+potential\b/gi,
    phrase: 'unlock potential',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'improve, grow',
  },
  {
    pattern: /\bunleash\b/gi,
    phrase: 'unleash',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'release, start, begin',
  },

  // VOICE_PATTERN — neat-bow conclusions (SYN-567)
  {
    pattern: /\bultimately,?\s+the goal is\b/gi,
    phrase: 'ultimately the goal is',
    category: 'voice-pattern',
    severity: 'warning',
    suggestion: 'State the specific next step',
  },
  {
    pattern: /\bat the end of the day\b/gi,
    phrase: 'at the end of the day',
    category: 'voice-pattern',
    severity: 'warning',
    suggestion: 'Cut this, lead with the point',
  },
  {
    pattern: /\bmoving forward\b/gi,
    phrase: 'moving forward',
    category: 'voice-pattern',
    severity: 'warning',
    suggestion: 'Specify what happens next',
  },
  {
    pattern: /\bin an ever[- ]changing\b/gi,
    phrase: 'in an ever-changing',
    category: 'voice-pattern',
    severity: 'error',
    suggestion: 'Name the specific change',
  },

  // HEDGE — excessive hedging
  {
    pattern: /\barguably\b/gi,
    phrase: 'arguably',
    category: 'hedge',
    severity: 'warning',
    suggestion: 'Make a direct claim or cite evidence',
  },
  {
    pattern: /\bto some extent\b/gi,
    phrase: 'to some extent',
    category: 'hedge',
    severity: 'warning',
  },
  {
    pattern: /\bin a way\b/gi,
    phrase: 'in a way',
    category: 'hedge',
    severity: 'warning',
    suggestion: 'Be specific about how',
  },
  {
    pattern: /\bsort of\b/gi,
    phrase: 'sort of',
    category: 'hedge',
    severity: 'warning',
  },
  {
    pattern: /\bkind of\b/gi,
    phrase: 'kind of',
    category: 'hedge',
    severity: 'warning',
  },
];

// ---------------------------------------------------------------------------
// Structural scanners — paragraph-level analysis (SYN-567)
// ---------------------------------------------------------------------------

const TRANSITION_OPENERS =
  /^(moreover|furthermore|additionally|that said|importantly|notably|consequently|similarly|in addition|what'?s more)\b/i;

/**
 * Flag text where >= 40% of paragraphs (min 3 total) open with a transition word.
 * One or two is fine; a pattern is an AI giveaway.
 */
function scanTransitionOpeners(text: string): SlopMatch[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
  if (paragraphs.length < 3) return [];

  const hits: SlopMatch[] = [];
  for (const para of paragraphs) {
    const firstLine = para.split('\n')[0].trim();
    const m = firstLine.match(TRANSITION_OPENERS);
    if (m) {
      const startIndex = text.indexOf(para);
      hits.push({
        phrase: `paragraph opens with "${m[0]}"`,
        category: 'formatting-pattern',
        severity: 'warning',
        startIndex: startIndex >= 0 ? startIndex : 0,
        endIndex: (startIndex >= 0 ? startIndex : 0) + m[0].length,
        suggestion:
          'Vary paragraph openings — do not start every paragraph with a transition word',
      });
    }
  }

  // Only flag if >=40% of paragraphs are affected
  if (hits.length / paragraphs.length < 0.4) return [];
  return hits;
}

/**
 * Detect >= 3 consecutive lines matching the **Bold:** explanation bullet pattern.
 */
function scanBoldColonBullets(text: string): SlopMatch[] {
  const lines = text.split('\n');
  // Matches **Word:** pattern where the colon is inside the bold markers
  // Also handles list markers (- , + , * ) before the bold text
  const boldColonRe = /^\s*(?:[-+]\s+|\*\s+)?\*\*\S[^*]*:\*\*/;
  let consecutiveCount = 0;
  let runStartIdx = 0;
  const hits: SlopMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (boldColonRe.test(lines[i])) {
      if (consecutiveCount === 0) runStartIdx = i;
      consecutiveCount++;
    } else {
      if (consecutiveCount >= 3) {
        const startLine = lines[runStartIdx];
        const startIndex = text.indexOf(startLine);
        hits.push({
          phrase: `${consecutiveCount} consecutive bold-colon bullets`,
          category: 'formatting-pattern',
          severity: 'warning',
          startIndex: startIndex >= 0 ? startIndex : 0,
          endIndex: (startIndex >= 0 ? startIndex : 0) + startLine.length,
          suggestion:
            'Vary bullet formatting — not every point needs a bolded label',
        });
      }
      consecutiveCount = 0;
    }
  }
  // Check trailing run
  if (consecutiveCount >= 3) {
    const startLine = lines[runStartIdx];
    const startIndex = text.indexOf(startLine);
    hits.push({
      phrase: `${consecutiveCount} consecutive bold-colon bullets`,
      category: 'formatting-pattern',
      severity: 'warning',
      startIndex: startIndex >= 0 ? startIndex : 0,
      endIndex: (startIndex >= 0 ? startIndex : 0) + startLine.length,
      suggestion:
        'Vary bullet formatting — not every point needs a bolded label',
    });
  }

  return hits;
}

/**
 * Flag em-dash (—) overuse: > 3 in < 500 words, or > 1.5 per 100 words.
 */
function scanEmDashOveruse(text: string, wordCount: number): SlopMatch[] {
  const emDash = '\u2014'; // — Unicode em-dash
  const indices: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === emDash) indices.push(i);
  }

  if (indices.length === 0) return [];

  const tooManyForShortText = wordCount < 500 && indices.length > 3;
  // Only apply density check on longer text (>=100 words) to avoid false positives
  // on short sentences that legitimately use 1-2 em-dashes
  const highDensity =
    wordCount >= 100 && (indices.length / wordCount) * 100 > 1.5;

  if (!tooManyForShortText && !highDensity) return [];

  return indices.map(idx => ({
    phrase: 'em-dash (—)',
    category: 'formatting-pattern' as SlopCategory,
    severity: 'warning' as SlopSeverity,
    startIndex: idx,
    endIndex: idx + 1,
    suggestion:
      'Replace em-dashes with full stops, commas, or restructure the sentence',
  }));
}

/**
 * Check the final paragraph for generic neat-bow conclusion phrases.
 * These are conclusions that could apply to literally any company.
 */
function scanNeatBowConclusion(text: string): SlopMatch[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
  if (paragraphs.length < 2) return [];

  const lastPara = paragraphs[paragraphs.length - 1];
  const neatBowPatterns: Array<{
    re: RegExp;
    phrase: string;
    suggestion: string;
  }> = [
    {
      re: /\bultimately,?\s+the goal is\b/i,
      phrase: 'ultimately the goal is',
      suggestion: 'State the specific next step',
    },
    {
      re: /\bat the end of the day\b/i,
      phrase: 'at the end of the day',
      suggestion: 'Lead with the point',
    },
    {
      re: /\bbuild a more resilient\b/i,
      phrase: 'build a more resilient',
      suggestion: 'Name the concrete outcome',
    },
    {
      re: /\bit comes down to execution\b/i,
      phrase: 'it comes down to execution',
      suggestion: 'Specify what to execute',
    },
    {
      re: /\bin closing\b/i,
      phrase: 'in closing',
      suggestion: 'End naturally without signalling',
    },
  ];

  const hits: SlopMatch[] = [];
  const lastParaStart = text.lastIndexOf(lastPara);

  for (const { re, phrase, suggestion } of neatBowPatterns) {
    const m = lastPara.match(re);
    if (m && m.index !== undefined) {
      hits.push({
        phrase: `neat-bow conclusion: "${phrase}"`,
        category: 'voice-pattern',
        severity: 'warning',
        startIndex: lastParaStart + m.index,
        endIndex: lastParaStart + m.index + m[0].length,
        suggestion,
      });
    }
  }

  return hits;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function scanForSlop(text: string): SlopScanResult {
  const wordCount = (text.match(/\b\w+\b/g) ?? []).length;
  const matches: SlopMatch[] = [];

  for (const pattern of SLOP_PATTERNS_V1) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    while ((match = re.exec(text)) !== null) {
      matches.push({
        phrase: pattern.phrase,
        category: pattern.category,
        severity: pattern.severity,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        suggestion: pattern.suggestion,
      });
    }
  }

  // Structural scanners — paragraph-level analysis (SYN-567)
  matches.push(...scanTransitionOpeners(text));
  matches.push(...scanBoldColonBullets(text));
  matches.push(...scanEmDashOveruse(text, wordCount));
  matches.push(...scanNeatBowConclusion(text));

  // Sort by position
  matches.sort((a, b) => a.startIndex - b.startIndex);

  const errorCount = matches.filter(m => m.severity === 'error').length;
  const warningCount = matches.filter(m => m.severity === 'warning').length;
  const slopDensity =
    wordCount > 0
      ? Math.round((matches.length / wordCount) * 100 * 100) / 100
      : 0;

  let overallSeverity: SlopScanResult['overallSeverity'] = 'clean';
  if (errorCount > 0 || slopDensity >= 3) overallSeverity = 'error';
  else if (warningCount > 0 || slopDensity >= 1) overallSeverity = 'warning';

  return {
    totalMatches: matches.length,
    errorCount,
    warningCount,
    slopDensity,
    matches,
    overallSeverity,
    wordCount,
  };
}
