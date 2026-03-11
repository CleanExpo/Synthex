/**
 * AI Slop Tell-Phrase Scanner
 * Detects AI-generated content patterns in text.
 * @module lib/voice/slop-scanner
 */

import type { SlopMatch, SlopScanResult, SlopCategory, SlopSeverity } from './types';

interface SlopPattern {
  pattern: RegExp;
  phrase: string;       // canonical display form
  category: SlopCategory;
  severity: SlopSeverity;
  suggestion?: string;
}

export const SLOP_PATTERNS_V1: SlopPattern[] = [
  // TRANSITION — lazy transitions
  { pattern: /\bin conclusion\b/gi, phrase: 'in conclusion', category: 'transition', severity: 'error', suggestion: 'End naturally or summarise directly' },
  { pattern: /\bin summary\b/gi, phrase: 'in summary', category: 'transition', severity: 'error', suggestion: 'Summarise without the signal phrase' },
  { pattern: /\bto summarize\b/gi, phrase: 'to summarize', category: 'transition', severity: 'error' },
  { pattern: /\bto summarise\b/gi, phrase: 'to summarise', category: 'transition', severity: 'error' },
  { pattern: /\bfurthermore\b/gi, phrase: 'furthermore', category: 'transition', severity: 'warning', suggestion: 'Also, or restructure the sentence' },
  { pattern: /\bmoreover\b/gi, phrase: 'moreover', category: 'transition', severity: 'warning', suggestion: 'Also, and, or restructure' },
  { pattern: /\badditionally\b/gi, phrase: 'additionally', category: 'transition', severity: 'warning', suggestion: 'Also, or start a new sentence' },
  { pattern: /\bit should be noted\b/gi, phrase: 'it should be noted', category: 'transition', severity: 'error' },
  { pattern: /\bneedless to say\b/gi, phrase: 'needless to say', category: 'transition', severity: 'error', suggestion: "Remove entirely — if needless, don't say it" },

  // FILLER — meaningless qualifiers
  { pattern: /\bit'?s important to note\b/gi, phrase: "it's important to note", category: 'filler', severity: 'error', suggestion: 'State the fact directly' },
  { pattern: /\bit'?s worth noting\b/gi, phrase: "it's worth noting", category: 'filler', severity: 'error', suggestion: 'State the fact directly' },
  { pattern: /\bit is important to\b/gi, phrase: 'it is important to', category: 'filler', severity: 'error' },
  { pattern: /\bas you can see\b/gi, phrase: 'as you can see', category: 'filler', severity: 'error', suggestion: 'Remove — the reader can see' },
  { pattern: /\bof course\b/gi, phrase: 'of course', category: 'filler', severity: 'warning' },
  { pattern: /\bobviously\b/gi, phrase: 'obviously', category: 'filler', severity: 'warning', suggestion: "If obvious, don't say it" },
  { pattern: /\bclearly\b/gi, phrase: 'clearly', category: 'filler', severity: 'warning' },

  // OVERUSED_WORD — LLM vocabulary
  { pattern: /\bdelves?\b/gi, phrase: 'delve', category: 'overused-word', severity: 'error', suggestion: 'explores, examines, looks at' },
  { pattern: /\bdelving\b/gi, phrase: 'delving', category: 'overused-word', severity: 'error', suggestion: 'exploring, examining' },
  { pattern: /\brobust\b/gi, phrase: 'robust', category: 'overused-word', severity: 'error', suggestion: 'strong, reliable, solid' },
  { pattern: /\bleverag(e|ing|ed|es)\b/gi, phrase: 'leverage', category: 'overused-word', severity: 'error', suggestion: 'use, apply, harness' },
  { pattern: /\bfoster(s|ing|ed)?\b/gi, phrase: 'foster', category: 'overused-word', severity: 'error', suggestion: 'build, grow, encourage' },
  { pattern: /\benhance(s|d|ment)?\b/gi, phrase: 'enhance', category: 'overused-word', severity: 'warning', suggestion: 'improve, strengthen' },
  { pattern: /\bcomprehensive\b/gi, phrase: 'comprehensive', category: 'overused-word', severity: 'error', suggestion: 'complete, full, thorough' },
  { pattern: /\binnovative\b/gi, phrase: 'innovative', category: 'overused-word', severity: 'warning', suggestion: 'new, fresh, novel — or be specific' },
  { pattern: /\bdynamic\b/gi, phrase: 'dynamic', category: 'overused-word', severity: 'warning' },
  { pattern: /\bseamlessly\b/gi, phrase: 'seamlessly', category: 'overused-word', severity: 'error', suggestion: 'smoothly, easily, without friction' },
  { pattern: /\btapestr(y|ies)\b/gi, phrase: 'tapestry', category: 'overused-word', severity: 'error' },
  { pattern: /\bnuanced?\b/gi, phrase: 'nuance', category: 'overused-word', severity: 'warning' },
  { pattern: /\bmultifaceted\b/gi, phrase: 'multifaceted', category: 'overused-word', severity: 'warning', suggestion: 'complex, varied, many-sided' },
  { pattern: /\bpivotal\b/gi, phrase: 'pivotal', category: 'overused-word', severity: 'warning', suggestion: 'key, critical, decisive' },
  { pattern: /\bparamount\b/gi, phrase: 'paramount', category: 'overused-word', severity: 'error', suggestion: 'most important, essential, critical' },
  { pattern: /\bcutting[- ]edge\b/gi, phrase: 'cutting-edge', category: 'overused-word', severity: 'warning', suggestion: 'leading, latest, state-of-the-art' },
  { pattern: /\bgame[- ]chang(ing|er)\b/gi, phrase: 'game-changer', category: 'overused-word', severity: 'warning' },

  // STRUCTURAL_PATTERN — AI templates
  { pattern: /not only .{3,60} but also/gi, phrase: 'not only ... but also', category: 'structural-pattern', severity: 'error', suggestion: 'Restructure into two separate statements' },
  { pattern: /\bin today'?s fast[- ]paced world\b/gi, phrase: "in today's fast-paced world", category: 'structural-pattern', severity: 'error', suggestion: 'Lead with your actual point' },
  { pattern: /\bas we navigate\b/gi, phrase: 'as we navigate', category: 'structural-pattern', severity: 'error' },
  { pattern: /\bin the ever[- ]evolving\b/gi, phrase: 'in the ever-evolving', category: 'structural-pattern', severity: 'error' },
  { pattern: /\bthe landscape of\b/gi, phrase: 'the landscape of', category: 'structural-pattern', severity: 'warning' },

  // HEDGE — excessive hedging
  { pattern: /\barguably\b/gi, phrase: 'arguably', category: 'hedge', severity: 'warning', suggestion: 'Make a direct claim or cite evidence' },
  { pattern: /\bto some extent\b/gi, phrase: 'to some extent', category: 'hedge', severity: 'warning' },
  { pattern: /\bin a way\b/gi, phrase: 'in a way', category: 'hedge', severity: 'warning', suggestion: 'Be specific about how' },
  { pattern: /\bsort of\b/gi, phrase: 'sort of', category: 'hedge', severity: 'warning' },
  { pattern: /\bkind of\b/gi, phrase: 'kind of', category: 'hedge', severity: 'warning' },
];

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

  // Sort by position
  matches.sort((a, b) => a.startIndex - b.startIndex);

  const errorCount = matches.filter(m => m.severity === 'error').length;
  const warningCount = matches.filter(m => m.severity === 'warning').length;
  const slopDensity = wordCount > 0 ? Math.round((matches.length / wordCount) * 100 * 100) / 100 : 0;

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
