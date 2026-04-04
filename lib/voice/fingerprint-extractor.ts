/**
 * Voice Fingerprint Extractor
 * Pure TypeScript stylometric analysis — no external dependencies.
 * @module lib/voice/fingerprint-extractor
 */

import type { FingerprintResult, VoiceFingerprint, SentenceStats } from './types';

const MIN_WORDS = 200;

function countWords(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

function computeSentenceStats(sentences: string[]): SentenceStats {
  const lengths = sentences.map(s => (s.match(/\b\w+\b/g) ?? []).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  const sorted = [...lengths].sort((a, b) => a - b);
  return {
    mean: Math.round(mean * 10) / 10,
    stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function computeTTR(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
  if (words.length === 0) return 0;
  return Math.round((new Set(words).size / words.length) * 100) / 100;
}

function computeAvgWordLength(text: string): number {
  const words = text.match(/\b[a-zA-Z]+\b/g) ?? [];
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + w.length, 0);
  return Math.round((total / words.length) * 100) / 100;
}

function estimateSyllables(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouy]+/g);
  const count = groups?.length ?? 1;
  const trailingE = /[^aeiouy]e$/i.test(word) ? 1 : 0;
  return Math.max(1, count - trailingE);
}

function computeFleschReadingEase(text: string, sentences: string[]): number {
  const words = text.match(/\b[a-zA-Z]+\b/g) ?? [];
  if (words.length === 0 || sentences.length === 0) return 0;
  const syllableCount = words.reduce((sum, w) => sum + estimateSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllableCount / words.length);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

function computePunctuationDensity(sentences: string[]): number {
  if (sentences.length === 0) return 0;
  const total = sentences.reduce((sum, s) => sum + (s.match(/[,;:()\[\]{}]/g) ?? []).length, 0);
  return Math.round((total / sentences.length) * 100) / 100;
}

function computeEmDashRate(text: string, wordCount: number): number {
  const count = (text.match(/—|\s-\s/g) ?? []).length;
  return Math.round((count / wordCount) * 100 * 100) / 100;
}

function computeQuestionRate(text: string, wordCount: number): number {
  const count = (text.match(/\?/g) ?? []).length;
  return Math.round((count / wordCount) * 100 * 100) / 100;
}

function computeFirstPersonRate(text: string, wordCount: number): number {
  const count = (text.match(/\b(I|me|my|mine|myself)\b/g) ?? []).length;
  return Math.round((count / wordCount) * 100) / 100;
}

function computeAdverbDensity(text: string, wordCount: number): number {
  const count = (text.match(/\b\w+ly\b/g) ?? []).length;
  return Math.round((count / wordCount) * 100 * 100) / 100;
}

function computePassiveVoiceEstimate(sentences: string[]): number {
  if (sentences.length === 0) return 0;
  const passive = sentences.filter(s => /\b(was|were|is|are|been|being)\b.{0,50}\bby\b/i.test(s)).length;
  return Math.round((passive / sentences.length) * 100) / 100;
}

function computeAvgParagraphLength(text: string, wordCount: number): number {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  if (paragraphs.length === 0) return wordCount;
  const total = paragraphs.reduce((sum, p) => sum + (p.match(/\b\w+\b/g) ?? []).length, 0);
  return Math.round(total / paragraphs.length);
}

export function extractFingerprint(text: string): FingerprintResult {
  const wordCount = countWords(text);

  if (wordCount < MIN_WORDS) {
    return {
      valid: false,
      error: `Insufficient sample — minimum ${MIN_WORDS} words required (got ${wordCount})`,
    };
  }

  const sentences = splitSentences(text);
  const fingerprint: VoiceFingerprint = {
    sentenceLengths: computeSentenceStats(sentences),
    ttr: computeTTR(text),
    avgWordLength: computeAvgWordLength(text),
    punctuationDensity: computePunctuationDensity(sentences),
    emDashRate: computeEmDashRate(text, wordCount),
    questionRate: computeQuestionRate(text, wordCount),
    firstPersonRate: computeFirstPersonRate(text, wordCount),
    adverbDensity: computeAdverbDensity(text, wordCount),
    passiveVoiceEstimate: computePassiveVoiceEstimate(sentences),
    fleschReadingEase: computeFleschReadingEase(text, sentences),
    avgParagraphLength: computeAvgParagraphLength(text, wordCount),
    sampleWordCount: wordCount,
    sampleSentenceCount: sentences.length,
    extractedAt: new Date().toISOString(),
  };

  return { valid: true, fingerprint };
}
