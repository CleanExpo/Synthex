/**
 * Content Capsule Formatter
 * Transforms content into AI-extractable Content Capsule format.
 * @module lib/voice/capsule-formatter
 */

import type { ContentCapsuleResult } from './types';

const QUESTION_WORDS = /^(what|how|why|when|where|which|who|can|should|does|do|is|are|will)\b/i;

function countWords(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

function isQuestionHeading(text: string): boolean {
  return text.trim().endsWith('?') || QUESTION_WORDS.test(text.trim());
}

function extractSections(text: string): Array<{ heading: string; body: string }> {
  const lines = text.split('\n');
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
      }
      currentHeading = headingMatch[1];
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
  }

  return sections;
}

function extractBullets(body: string): string[] {
  return body
    .split('\n')
    .filter(l => /^\s*[-*•]\s+/.test(l))
    .map(l => l.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(l => l.length > 0);
}

function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.split('\n')[0]?.trim() ?? '';
}

function extractKeyTerms(text: string): string[] {
  // Extract capitalised phrases and technical terms (simple heuristic)
  const capitalised = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  const unique = Array.from(new Set(capitalised))
    .filter(t => t.length > 3 && !/(The|This|That|These|Those|With|From|Into|When|Where|What|Which|How|Why)\b/.test(t));
  return unique.slice(0, 8);
}

function scoreExtractability(
  sections: Array<{ heading: string; body: string; wordCount: number }>,
  totalSections: number
): number {
  if (totalSections === 0) return 0;
  let score = 0;

  const questionHeadings = sections.filter(s => isQuestionHeading(s.heading)).length;
  score += Math.round((questionHeadings / totalSections) * 20);

  const capsuleReady = sections.filter(s => s.wordCount >= 75 && s.wordCount <= 120).length;
  score += Math.round((capsuleReady / totalSections) * 20);

  const withBullets = sections.filter(s => extractBullets(s.body).length > 0).length;
  score += Math.round((withBullets / totalSections) * 20);

  // Check first section for direct answer (short first sentence ≤ 20 words)
  if (sections[0]) {
    const firstSentence = extractFirstSentence(sections[0].body);
    if (firstSentence && countWords(firstSentence) <= 20) score += 20;
  }

  // Question words in headings
  const questionWordHeadings = sections.filter(s => QUESTION_WORDS.test(s.heading)).length;
  if (questionWordHeadings > 0) score += 20;

  return Math.min(100, score);
}

export function formatAsCapsule(text: string): ContentCapsuleResult {
  const wordCount = countWords(text);
  const rawSections = extractSections(text);
  const headingCount = rawSections.filter(s => s.heading).length;

  // Content type check: fewer than 2 headings → not informational/capsule-ready
  if (headingCount < 2) {
    // Still return a valid result — derive core claim from first paragraph
    const firstParagraph = text.split(/\n\n+/)[0]?.trim() ?? text.slice(0, 300);
    const coreClaim = extractFirstSentence(firstParagraph);
    const bullets = extractBullets(text);
    return {
      coreClaim: coreClaim || 'No clear core claim detected.',
      supportingPoints: bullets.slice(0, 5),
      keyTerms: extractKeyTerms(text),
      extractability: 0,
      wordCount,
      createdAt: new Date().toISOString(),
    };
  }

  const scoredSections = rawSections
    .filter(s => s.heading || s.body)
    .map(s => ({
      heading: s.heading || 'Overview',
      body: s.body,
      wordCount: countWords(s.body),
    }));

  const extractabilityScore = scoreExtractability(scoredSections, scoredSections.length);

  // Core claim: first non-empty sentence from first section body
  const firstBody = scoredSections[0]?.body ?? '';
  const coreClaim = extractFirstSentence(firstBody) || 'No clear core claim detected.';

  // Supporting points: heading text from subsequent sections (up to 5)
  const supportingPoints = scoredSections
    .slice(1)
    .map(s => s.heading)
    .filter(h => h && h !== 'Overview')
    .slice(0, 5);

  // Key terms: extracted from full text
  const keyTerms = extractKeyTerms(text);

  // Normalise extractability to 0–1 range
  const extractability = Math.round((extractabilityScore / 100) * 100) / 100;

  return {
    coreClaim,
    supportingPoints,
    keyTerms,
    extractability,
    wordCount,
    createdAt: new Date().toISOString(),
  };
}
