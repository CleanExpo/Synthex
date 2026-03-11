/**
 * Voice Fingerprinting & Writing Methodology — Type Definitions
 * @module lib/voice/types
 */

// ---------------------------------------------------------------------------
// Sentence-level statistics
// ---------------------------------------------------------------------------

export interface SentenceStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

// ---------------------------------------------------------------------------
// Voice Fingerprint — stylometric signature of a piece of writing
// ---------------------------------------------------------------------------

export interface VoiceFingerprint {
  /** Mean / std-dev / min / max sentence lengths (words) */
  sentenceLengths: SentenceStats;
  /** Type-token ratio: unique words / total words */
  ttr: number;
  /** Average word length in characters */
  avgWordLength: number;
  /** Internal punctuation marks per sentence (commas, semicolons, etc.) */
  punctuationDensity: number;
  /** Em-dash occurrences per 100 words */
  emDashRate: number;
  /** Question marks per 100 words */
  questionRate: number;
  /** First-person pronouns (I/me/my/mine/myself) per 100 words */
  firstPersonRate: number;
  /** Adverbs ending in -ly per 100 words */
  adverbDensity: number;
  /** Estimated passive-voice sentence ratio (0–1) */
  passiveVoiceEstimate: number;
  /** Flesch Reading Ease score (0–100, higher = easier) */
  fleschReadingEase: number;
  /** Average paragraph length in words */
  avgParagraphLength: number;
  /** Word count of the analysed sample */
  sampleWordCount: number;
  /** Sentence count of the analysed sample */
  sampleSentenceCount: number;
  /** ISO timestamp of extraction */
  extractedAt: string;
}

// ---------------------------------------------------------------------------
// Fingerprint extraction result (discriminated union)
// ---------------------------------------------------------------------------

export type FingerprintResult =
  | { valid: true; fingerprint: VoiceFingerprint }
  | { valid: false; error: string };

// ---------------------------------------------------------------------------
// Slop Scanner
// ---------------------------------------------------------------------------

export type SlopCategory =
  | 'transition'
  | 'filler'
  | 'overused-word'
  | 'structural-pattern'
  | 'hedge';

export type SlopSeverity = 'error' | 'warning';

export interface SlopMatch {
  /** Canonical display form of the matched phrase */
  phrase: string;
  category: SlopCategory;
  severity: SlopSeverity;
  /** Character start index in the source text */
  startIndex: number;
  /** Character end index (exclusive) in the source text */
  endIndex: number;
  /** Optional human-readable replacement suggestion */
  suggestion?: string;
}

export interface SlopScanResult {
  totalMatches: number;
  errorCount: number;
  warningCount: number;
  /** Slop occurrences per 100 words */
  slopDensity: number;
  matches: SlopMatch[];
  overallSeverity: 'clean' | 'warning' | 'error';
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Content Capsule — structured distillation of an article/essay
// ---------------------------------------------------------------------------

export interface ContentCapsuleResult {
  /** One-sentence summary of the core argument */
  coreClaim: string;
  /** Three to five supporting points */
  supportingPoints: string[];
  /** Named entities, concepts, and jargon extracted */
  keyTerms: string[];
  /** Estimated re-use extractability score (0–1) */
  extractability: number;
  /** Word count of original text */
  wordCount: number;
  /** ISO timestamp of capsule creation */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Writing Context — environmental signals for a piece of writing
// ---------------------------------------------------------------------------

export interface WritingContextResult {
  /** Detected target audience (e.g., "marketing managers", "developers") */
  audience: string;
  /** Inferred content goal (e.g., "persuade", "educate", "entertain") */
  goal: string;
  /** Dominant tone signals */
  toneSignals: string[];
  /** Estimated formality level: 0 (very informal) → 1 (very formal) */
  formalityScore: number;
}

// ---------------------------------------------------------------------------
// Voice Analysis — combined result from fingerprint + slop scan + context
// ---------------------------------------------------------------------------

export interface VoiceAnalysisResult {
  fingerprint: FingerprintResult;
  slopScan: SlopScanResult;
  context?: WritingContextResult;
  /** Overall voice clarity score (0–100): higher = cleaner, more distinctive */
  clarityScore: number;
  /** ISO timestamp of analysis */
  analysedAt: string;
}

// ---------------------------------------------------------------------------
// Voice Profile DTO — serialisable form of a saved VoiceProfile record
// ---------------------------------------------------------------------------

export interface VoiceProfileDTO {
  id: string;
  userId: string;
  orgId: string;
  name: string;
  sampleText: string;
  fingerprint: VoiceFingerprint;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Content Capsule DTO — serialisable form of a saved ContentCapsule record
// ---------------------------------------------------------------------------

export interface ContentCapsuleDTO {
  id: string;
  userId: string;
  orgId: string;
  originalText: string;
  capsuleOutput: ContentCapsuleResult;
  wordCount: number;
  extractability: number;
  createdAt: string;
  updatedAt: string;
}
