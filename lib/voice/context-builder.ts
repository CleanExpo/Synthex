/**
 * Writing Context Builder
 * Generates a structured WritingContextResult from a VoiceFingerprint.
 * Infers audience, goal, tone signals, and formality level from stylometric data.
 * @module lib/voice/context-builder
 */

import type { VoiceFingerprint, WritingContextResult } from './types';

function inferAudience(fingerprint: VoiceFingerprint): string {
  const { fleschReadingEase, avgWordLength, ttr } = fingerprint;

  if (fleschReadingEase >= 70 && avgWordLength <= 4.5) {
    return 'general consumers';
  }
  if (fleschReadingEase >= 50 && fleschReadingEase < 70) {
    if (ttr > 0.55) return 'informed professionals';
    return 'business readers';
  }
  if (fleschReadingEase < 50 && avgWordLength > 5.5) {
    return 'subject matter experts';
  }
  if (fleschReadingEase < 30) {
    return 'academic or technical specialists';
  }
  return 'general business audience';
}

function inferGoal(fingerprint: VoiceFingerprint): string {
  const { questionRate, firstPersonRate, adverbDensity, passiveVoiceEstimate } = fingerprint;

  if (questionRate > 1.0) {
    return 'engage and provoke thought';
  }
  if (firstPersonRate > 0.04) {
    return 'share personal perspective';
  }
  if (passiveVoiceEstimate > 0.3) {
    return 'inform and report objectively';
  }
  if (adverbDensity > 0.05) {
    return 'persuade and motivate action';
  }
  return 'educate and inform';
}

function inferToneSignals(fingerprint: VoiceFingerprint): string[] {
  const signals: string[] = [];
  const {
    fleschReadingEase,
    firstPersonRate,
    emDashRate,
    questionRate,
    adverbDensity,
    passiveVoiceEstimate,
    sentenceLengths,
    punctuationDensity,
  } = fingerprint;

  if (firstPersonRate > 0.02) signals.push('conversational');
  if (firstPersonRate < 0.005 && passiveVoiceEstimate > 0.2) signals.push('formal');
  if (questionRate > 0.5) signals.push('inquisitive');
  if (emDashRate > 0.5) signals.push('parenthetical');
  if (sentenceLengths.stdDev > 8) signals.push('varied rhythm');
  if (sentenceLengths.stdDev < 3) signals.push('measured pace');
  if (adverbDensity > 0.05) signals.push('emphatic');
  if (adverbDensity < 0.02) signals.push('direct');
  if (fleschReadingEase >= 70) signals.push('accessible');
  if (fleschReadingEase < 40) signals.push('dense');
  if (punctuationDensity > 2.5) signals.push('complex sentence structure');

  return signals.slice(0, 5);
}

function computeFormalityScore(fingerprint: VoiceFingerprint): number {
  const {
    fleschReadingEase,
    avgWordLength,
    passiveVoiceEstimate,
    firstPersonRate,
    adverbDensity,
    sentenceLengths,
  } = fingerprint;

  let score = 0.5; // baseline

  // Lower readability → more formal
  score += (100 - fleschReadingEase) / 100 * 0.25;

  // Longer words → more formal
  if (avgWordLength > 5.5) score += 0.1;
  if (avgWordLength < 4.0) score -= 0.1;

  // Passive voice → more formal
  score += passiveVoiceEstimate * 0.15;

  // First person → less formal
  if (firstPersonRate > 0.03) score -= 0.15;

  // High adverb density with short sentences → casual
  if (adverbDensity > 0.06 && sentenceLengths.mean < 12) score -= 0.1;

  // Long sentences → more formal
  if (sentenceLengths.mean > 20) score += 0.1;
  if (sentenceLengths.mean < 10) score -= 0.1;

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Build a WritingContextResult from a VoiceFingerprint.
 * The compact parameter is accepted for API compatibility but does not change the
 * output shape — it is reserved for future prompt-generation extensions.
 */
export function buildWritingContext(
  fingerprint: VoiceFingerprint,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compact = false
): WritingContextResult {
  return {
    audience: inferAudience(fingerprint),
    goal: inferGoal(fingerprint),
    toneSignals: inferToneSignals(fingerprint),
    formalityScore: computeFormalityScore(fingerprint),
  };
}
