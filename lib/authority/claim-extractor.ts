/**
 * Claim Extractor — Rule-based extraction of verifiable claims from content.
 *
 * Identifies 6 claim types: statistical, factual, comparative, regulatory, temporal, causal.
 *
 * @module lib/authority/claim-extractor
 */

import type { ExtractedClaim, ClaimType } from './types';

// Sentence splitter that respects common abbreviations
function splitIntoSentences(content: string): Array<{ text: string; start: number; end: number }> {
  const sentences: Array<{ text: string; start: number; end: number }> = [];

  // Abbreviations that should NOT end a sentence
  const abbrevPattern = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|eg|ie|approx|est|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|AS|NZS|ISO|No|Vol|pp|Fig|Inc|Ltd|Pty|Corp|Co)\./gi;
  // Temporarily replace abbreviation periods with a placeholder
  const placeholder = '\x00';
  const sanitised = content.replace(abbrevPattern, match => match.slice(0, -1) + placeholder);

  // Split on sentence-ending punctuation followed by whitespace + capital letter, or end of string
  const splitRegex = /([.!?])\s+(?=[A-Z"'])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = splitRegex.exec(sanitised)) !== null) {
    const end = match.index + match[1].length;
    const rawText = content.slice(lastIndex, end).trim();
    if (rawText.length > 10) {
      sentences.push({ text: rawText, start: lastIndex, end: lastIndex + rawText.length });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining content after last split
  const remaining = content.slice(lastIndex).trim();
  if (remaining.length > 10) {
    sentences.push({ text: remaining, start: lastIndex, end: lastIndex + remaining.length });
  }

  return sentences;
}

// Claim type detection patterns
const CLAIM_PATTERNS: Record<ClaimType, RegExp[]> = {
  statistical: [
    /\b\d+(?:\.\d+)?%/,
    /\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|trillion|AUD|USD))?/i,
    /\b(?:AUD|USD|NZD)\s*[\d,]+/i,
    /\b\d+(?:\.\d+)?\s*(?:million|billion|trillion)\b/i,
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:million|billion|trillion)\b/i,
    /\b\d+\s+(?:out of|in)\s+\d+\b/i,
    /\b(?:nearly|approximately|about|roughly|over|more than|less than)\s+\d[\d,]*\b/i,
  ],
  factual: [
    /\bis\s+the\s+(?:largest|smallest|first|last|only|leading|biggest|tallest|oldest|newest)\b/i,
    /\bwas\s+(?:founded|established|created|launched|built|developed)\s+(?:in|by)\b/i,
    /\baccording\s+to\b/i,
    /\bstudies?\s+(?:show|indicate|suggest|confirm|reveal|demonstrate)\b/i,
    /\bresearch\s+(?:shows?|indicates?|suggests?|confirms?|reveals?|demonstrates?|finds?)\b/i,
    /\bdata\s+(?:shows?|indicates?|suggests?|confirms?|reveals?|demonstrates?)\b/i,
    /\breport(?:s|ed)?\s+(?:show|indicate|suggest|confirm|reveal|demonstrate|find)\b/i,
  ],
  comparative: [
    /\bmore\s+than\b/i,
    /\bless\s+than\b/i,
    /\bcompared\s+to\b/i,
    /\bfaster\s+than\b/i,
    /\bslower\s+than\b/i,
    /\bhigher\s+than\b/i,
    /\blower\s+than\b/i,
    /\bthe\s+(?:leading|fastest|largest|smallest|most|least|best|worst)\b/i,
    /\boutperforms?\b/i,
    /\bsurpasses?\b/i,
    /\bsignificantly\s+(?:more|less|better|worse|higher|lower)\b/i,
  ],
  regulatory: [
    /\bcompliant\s+with\b/i,
    /\bcertified\s+by\b/i,
    /\bAS\/NZS\s+\d+/i,
    /\bISO\s+\d+/i,
    /\bapproved\s+by\b/i,
    /\baccredited\s+(?:by|to)\b/i,
    /\bmeets?\s+(?:the\s+)?(?:requirements?|standards?|regulations?)\b/i,
    /\bcomplies?\s+with\b/i,
    /\bregulated\s+(?:by|under)\b/i,
    /\blicensed\s+(?:by|under)\b/i,
    /\bTGA\b|\bASIC\b|\bAPRA\b|\bACCC\b|\bFDA\b|\bCE\s+mark/i,
  ],
  temporal: [
    /\bsince\s+\d{4}\b/i,
    /\bover\s+(?:the\s+(?:past|last)\s+)?\d+\s+years?\b/i,
    /\bestablished\s+in\s+\d{4}\b/i,
    /\bfounded\s+in\s+\d{4}\b/i,
    /\bin\s+\d{4}\b/,
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
    /\bfor\s+(?:more\s+than\s+)?\d+\s+years?\b/i,
    /\bover\s+\d+\s+years?\s+(?:of\s+)?(?:experience|expertise|operation)\b/i,
  ],
  causal: [
    /\bcauses?\b.{1,50}\b(?:increase|decrease|reduction|growth|loss|gain|improvement|decline)/i,
    /\bresults?\s+in\b/i,
    /\bleads?\s+to\b/i,
    /\bbecause\s+of\b.{1,50}\b\d/i,
    /\bdue\s+to\b.{1,50}\b(?:increase|decrease|reduction|growth|loss|gain|improvement)\b/i,
    /\bcontributes?\s+to\b/i,
    /\bdrives?\b.{1,50}\b(?:increase|decrease|reduction|growth|improvement|decline)\b/i,
    /\breduces?\b.{1,50}\b(?:risk|cost|time|error|waste)\b/i,
    /\bincreases?\b.{1,50}\b(?:revenue|efficiency|accuracy|speed|productivity)\b/i,
    /\bimproves?\b.{1,50}\b(?:performance|outcome|result|quality|efficiency)\b/i,
  ],
};

// Entity extraction via capitalisation heuristic
function extractEntities(text: string): string[] {
  // Match sequences of capitalised words (proper nouns), excluding sentence starts
  const properNounRegex = /(?<!\. )(?<![A-Z])(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|[A-Z]{2,}(?:\s+[A-Z]{2,})*)/g;
  const matches = text.match(properNounRegex) || [];

  // Deduplicate and filter very short matches
  const seen = new Set<string>();
  return matches.filter(m => {
    const trimmed = m.trim();
    if (trimmed.length < 2 || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
}

// Determine confidence score based on claim characteristics
function assignConfidence(text: string, type: ClaimType): number {
  let score = 0.4; // Base: vague statement

  // Has specific numbers → more credible
  if (/\b\d+(?:\.\d+)?/.test(text)) score += 0.2;

  // Has a source attribution
  if (/\baccording\s+to\b|\bsource[s:]|\bby\s+[A-Z]|\bcited\s+(?:from|by)/i.test(text)) score += 0.2;

  // Has specific verbs that indicate verifiable facts
  if (/\b(?:is|was|are|were|has been|have been|will be)\b/i.test(text)) score += 0.1;

  // Regulatory / ISO / AS NZS specificity → very credible
  if (type === 'regulatory' && /AS\/NZS\s+\d+|ISO\s+\d+|[A-Z]{2,4}\s+\d+/i.test(text)) score += 0.2;

  // Specific year or date → higher confidence
  if (/\b(?:19|20)\d{2}\b/.test(text)) score += 0.1;

  // Specific percentage with context → high confidence
  if (/\b\d+(?:\.\d+)?%/.test(text) && text.length > 40) score += 0.1;

  // Dollar amounts → high confidence
  if (/\$[\d,]+|\bAUD\s+[\d,]+/i.test(text)) score += 0.1;

  return Math.min(0.95, parseFloat(score.toFixed(2)));
}

function detectClaimType(text: string): ClaimType | null {
  // Test each type in priority order
  const priority: ClaimType[] = ['regulatory', 'statistical', 'temporal', 'causal', 'comparative', 'factual'];

  for (const type of priority) {
    const patterns = CLAIM_PATTERNS[type];
    if (patterns.some(p => p.test(text))) {
      return type;
    }
  }

  return null;
}

/**
 * Extract verifiable claims from content text.
 * Returns top 50 claims sorted by confidence descending.
 */
export function extractClaims(content: string): ExtractedClaim[] {
  const sentences = splitIntoSentences(content);
  const claims: ExtractedClaim[] = [];

  for (const sentence of sentences) {
    const type = detectClaimType(sentence.text);
    if (!type) continue;

    const entities = extractEntities(sentence.text);
    const confidence = assignConfidence(sentence.text, type);

    claims.push({
      text: sentence.text,
      type,
      confidence,
      position: { start: sentence.start, end: sentence.end },
      entities,
    });
  }

  // Sort by confidence descending, return top 50
  return claims
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 50);
}
