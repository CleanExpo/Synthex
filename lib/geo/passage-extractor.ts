/**
 * Passage Extractor
 *
 * Splits content into citable passage blocks and evaluates each.
 * Optimal AI citation passage: 134-167 words.
 *
 * @module lib/geo/passage-extractor
 */

import type { CitablePassage } from './types';

const OPTIMAL_MIN_WORDS = 134;
const OPTIMAL_MAX_WORDS = 167;

export function extractCitablePassages(content: string): CitablePassage[] {
  // Split by double newlines (paragraph breaks) or heading markers
  const blocks = content.split(/\n{2,}|(?=^#{1,6}\s)/m).filter(b => b.trim().length > 0);

  const passages: CitablePassage[] = [];

  for (const block of blocks) {
    const cleanBlock = block.replace(/^#{1,6}\s+/m, '').trim();
    if (!cleanBlock) continue;

    const words = cleanBlock.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Skip very short blocks (likely headings or captions)
    if (wordCount < 20) continue;

    const startIndex = content.indexOf(cleanBlock);
    const isOptimalLength = wordCount >= OPTIMAL_MIN_WORDS && wordCount <= OPTIMAL_MAX_WORDS;

    // Check if passage starts with a direct answer (answer-first formatting)
    const answerFirst = checkAnswerFirst(cleanBlock);

    // Check for inline citations
    const hasCitation = /\[\d+\]|\([A-Z][a-z]+,?\s*\d{4}\)|according to|source:/i.test(cleanBlock);

    // Calculate passage score
    const score = calculatePassageScore(wordCount, answerFirst, hasCitation, isOptimalLength);

    passages.push({
      text: cleanBlock,
      wordCount,
      startIndex: startIndex >= 0 ? startIndex : 0,
      endIndex: startIndex >= 0 ? startIndex + cleanBlock.length : cleanBlock.length,
      score,
      isOptimalLength,
      answerFirst,
      hasCitation,
    });
  }

  return passages.sort((a, b) => b.score - a.score);
}

function checkAnswerFirst(text: string): boolean {
  const firstSentence = text.split(/[.!?]/)[0]?.trim() || '';
  // Answer-first: starts with a declarative statement (not a question, not a dependent clause)
  const startsWithAnswer = /^[A-Z][^?]*(?:is|are|was|were|has|have|can|will|should|provides?|shows?|reveals?|indicates?|demonstrates?|finds?|suggests?)\b/i.test(firstSentence);
  const startsWithNumber = /^\d/.test(firstSentence);
  const startsWithKey = /^(?:The|A|An|This|These|Our|According)\s/i.test(firstSentence);
  return startsWithAnswer || startsWithNumber || startsWithKey;
}

function calculatePassageScore(
  wordCount: number,
  answerFirst: boolean,
  hasCitation: boolean,
  isOptimalLength: boolean
): number {
  let score = 40; // Base score

  // Length scoring (max 30 points)
  if (isOptimalLength) {
    score += 30;
  } else if (wordCount >= 100 && wordCount <= 200) {
    score += 20;
  } else if (wordCount >= 50 && wordCount <= 300) {
    score += 10;
  }

  // Answer-first (15 points)
  if (answerFirst) score += 15;

  // Citation presence (15 points)
  if (hasCitation) score += 15;

  return Math.min(100, score);
}
