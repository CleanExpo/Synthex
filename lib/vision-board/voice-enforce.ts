/**
 * Tiny brand-voice-enforce stub for the Vision Board.
 *
 * Real enforcement lives in the brand-voice-enforce skill (~/.claude/skills/).
 * This file is the in-app version: it runs the deterministic checks (forbidden
 * words, RA abbreviation, reading-level estimate) so each panel can show a live
 * score next to a copy artefact without round-tripping through the skill.
 *
 * Used by Storyboard panel (per-scene scoring) and Copy panel (per-piece scoring).
 */

import { ra } from '@unite-group/brand-config';
import type { VoiceEnforceScore } from './types';

const BRAND_NAME_REGEX = /\b(RA)\b/g;     // standalone RA — abbreviation check

const AI_AS_ACTOR_PHRASES = [
  'AI assesses',
  'AI diagnoses',
  'AI decides',
  'AI determines',
  'AI judges',
];

// Australian English markers — these are the COMMON US spellings the copy must NOT use.
const US_ENGLISH_MARKERS = [
  'organize', 'organized', 'organizing',
  'recognize', 'recognized', 'recognizing',
  'color', 'colors', 'colored',
  'license' /* as verb */, // tricky — `licence` is the AU noun; allow `license` as verb only
  'analyze', 'analyzed', 'analyzing',
  'optimize', 'optimized', 'optimizing',
];

/**
 * Approximate Flesch-Kincaid grade level. Cheap heuristic for Vision Board
 * preview only — the real skill uses a calibrated scorer.
 */
function approximateGradeLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;

  let syllableCount = 0;
  for (const word of words) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length === 0) continue;
    // Count vowel groups as a syllable proxy.
    const matches = w.match(/[aeiouy]+/g);
    syllableCount += Math.max(1, matches ? matches.length : 1);
  }

  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllableCount / words.length;
  // Standard Flesch-Kincaid grade-level formula
  const grade = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.round(grade * 10) / 10;
}

export function voiceEnforce(text: string): VoiceEnforceScore {
  const lower = text.toLowerCase();
  const forbiddenWordHits: string[] = [];

  for (const word of ra.voice.forbiddenWords) {
    // Treat each forbidden word as a whole-word match to avoid false positives.
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'g');
    if (regex.test(lower)) forbiddenWordHits.push(word);
  }

  const raAbbreviationCount = (text.match(BRAND_NAME_REGEX) || []).length;
  const aiAsActorPhrases = AI_AS_ACTOR_PHRASES.filter(p =>
    lower.includes(p.toLowerCase())
  );

  const usMarkerHits = US_ENGLISH_MARKERS.filter(m =>
    new RegExp(`\\b${m}\\b`, 'i').test(text)
  );
  const australianEnglishOk = usMarkerHits.length === 0;

  const readingLevelGrade = approximateGradeLevel(text);

  const passed =
    forbiddenWordHits.length === 0 &&
    raAbbreviationCount === 0 &&
    aiAsActorPhrases.length === 0 &&
    australianEnglishOk &&
    readingLevelGrade <= (ra.pillars?.readingLevel?.tolerance ?? 6);

  const notes: string[] = [];
  if (forbiddenWordHits.length > 0) {
    notes.push(`Forbidden words: ${forbiddenWordHits.join(', ')}`);
  }
  if (raAbbreviationCount > 0) {
    notes.push(
      `"RA" abbreviation appears ${raAbbreviationCount}× — ra.ts forbids this in voiceover/titles.`
    );
  }
  if (!australianEnglishOk) {
    notes.push(`US spellings detected: ${usMarkerHits.join(', ')}`);
  }
  if (aiAsActorPhrases.length > 0) {
    notes.push(`AI written as actor not assistant: ${aiAsActorPhrases.join(', ')}`);
  }
  const target = ra.pillars?.readingLevel?.target ?? 4;
  const tolerance = ra.pillars?.readingLevel?.tolerance ?? 6;
  if (readingLevelGrade > tolerance) {
    notes.push(`Reading level ${readingLevelGrade} > tolerance ${tolerance} (target ${target}).`);
  }

  return {
    passed,
    forbiddenWordHits,
    readingLevelGrade,
    australianEnglishOk,
    raAbbreviationCount,
    aiAsActorPhrases,
    notes,
  };
}
