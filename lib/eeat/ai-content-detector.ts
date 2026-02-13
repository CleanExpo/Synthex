/**
 * AI Content Detector
 *
 * Detects AI-generated content patterns using Anti-AI Voice Protocols
 * from the authority-curator skill. Scans for forbidden phrases that
 * signal AI-generated content to Google's quality raters.
 *
 * @module lib/eeat/ai-content-detector
 */

import type { AIDetectionResult, FlaggedPhrase } from './types';

// Anti-AI Voice Protocol — Forbidden phrases (from authority-curator.skill.md)
const AI_PATTERNS: Array<{ pattern: RegExp; category: FlaggedPhrase['category']; suggestion: string }> = [
  // Opening cliches
  { pattern: /in today'?s (?:digital|fast-paced|ever-changing|modern|competitive) (?:landscape|world|era|age|environment)/gi, category: 'opening_cliche', suggestion: 'Start with a specific fact, statistic, or direct statement' },
  { pattern: /^(?:in the (?:world|realm|arena) of|when it comes to|it'?s no secret that)/gim, category: 'opening_cliche', suggestion: 'Open with a concrete claim or finding' },
  { pattern: /(?:the (?:world|industry|field) of .{3,30} is (?:rapidly|constantly|always) (?:evolving|changing|growing))/gi, category: 'opening_cliche', suggestion: 'State what specifically changed and when' },

  // Hedging language
  { pattern: /it'?s (?:important|worth|crucial|essential|vital|critical) to (?:note|mention|remember|understand|consider)/gi, category: 'hedging', suggestion: 'State the point directly without hedging' },
  { pattern: /(?:needless to say|it goes without saying|as (?:we all|everyone) know)/gi, category: 'hedging', suggestion: 'Remove — if it goes without saying, don\'t say it' },
  { pattern: /\b(?:arguably|essentially|basically|fundamentally|ultimately)\b/gi, category: 'hedging', suggestion: 'Remove qualifier — be direct' },

  // Filler transitions
  { pattern: /(?:let'?s (?:dive|delve|explore|take a (?:look|deep dive|closer look)|break (?:it |this )?down))/gi, category: 'filler', suggestion: 'Remove transition — just present the content' },
  { pattern: /(?:without further ado|with that (?:said|being said|in mind)|that being said|having said that)/gi, category: 'filler', suggestion: 'Delete — proceed directly to the next point' },
  { pattern: /(?:first and foremost|last but not least|at the end of the day|when all is said and done)/gi, category: 'filler', suggestion: 'Use a simple transition or remove entirely' },

  // AI pomposity
  { pattern: /\b(?:delve|leverage|utilize|harness|empower|synergy|synergize|paradigm|holistic|robust|seamless|cutting.edge|game.changing|revolutionary|transformative|next.generation|state.of.the.art)\b/gi, category: 'pomposity', suggestion: 'Use simpler, more specific language' },
  { pattern: /(?:unlock (?:the (?:power|potential|secrets?|mysteries))|revolutioni[sz]e|take .{3,20} to the next level|elevate your)/gi, category: 'pomposity', suggestion: 'Describe the specific benefit in plain language' },

  // False intimacy
  { pattern: /(?:you might be wondering|you'?re probably (?:thinking|wondering|asking)|imagine (?:this|a world|if)|picture this|have you ever wondered)/gi, category: 'false_intimacy', suggestion: 'Don\'t presume the reader\'s thoughts — state facts' },
  { pattern: /(?:we'?ve all been there|we all know|as (?:you|we) know|let me (?:tell|share with) you)/gi, category: 'false_intimacy', suggestion: 'Remove presumptive language' },
];

export function detectAIContent(content: string): AIDetectionResult {
  const flaggedPhrases: FlaggedPhrase[] = [];

  for (const { pattern, category, suggestion } of AI_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      flaggedPhrases.push({
        phrase: match[0],
        category,
        position: match.index,
        suggestion,
      });
    }
  }

  // Sort by position
  flaggedPhrases.sort((a, b) => a.position - b.position);

  // Calculate AI score based on density of flagged phrases
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const flagDensity = wordCount > 0 ? (flaggedPhrases.length / wordCount) * 1000 : 0;

  // AI score: 0-100 (higher = more likely AI-generated)
  // 0 flags = 0, 1 flag per 200 words = ~50, 2+ per 200 = 70+
  const aiScore = Math.min(100, Math.round(flagDensity * 10));
  const cleanScore = 100 - aiScore;

  return {
    flaggedPhrases,
    aiScore,
    cleanScore,
  };
}
