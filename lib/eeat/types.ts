/**
 * E-E-A-T Engine Type Definitions
 *
 * Types for Experience, Expertise, Authoritativeness, Trustworthiness scoring.
 * Weights: Experience(20%), Expertise(25%), Authoritativeness(25%), Trustworthiness(30%)
 * December 2025 update: applies to ALL competitive queries, not just YMYL.
 *
 * @module lib/eeat/types
 */

export interface EEATInput {
  content: string;
  authorInfo?: AuthorInfo;
  url?: string;
  contentType?: ContentType;
}

export type ContentType = 'article' | 'product' | 'service' | 'ymyl' | 'general';

export interface AuthorInfo {
  name: string;
  credentials?: Credential[];
  socialLinks?: Record<string, string>;
  bio?: string;
}

export interface Credential {
  type: string;       // 'degree', 'certification', 'license', 'award'
  title: string;
  institution?: string;
  year?: number;
}

export interface EEATScore {
  overall: number;         // 0-100 weighted
  experience: number;      // 0-100, weight 20%
  expertise: number;       // 0-100, weight 25%
  authoritativeness: number; // 0-100, weight 25%
  trustworthiness: number; // 0-100, weight 30%
}

export interface ExperienceSignals {
  firstPersonNarratives: number;
  originalPhotos: boolean;
  caseStudies: number;
  processDocumentation: boolean;
  beforeAfterResults: boolean;
  specificExamples: number;
  signals: string[];
}

export interface ExpertiseSignals {
  authorCredentials: boolean;
  relevantQualifications: number;
  technicalAccuracy: boolean;
  specializedVocabulary: number;
  upToDate: boolean;
  bylineVisible: boolean;
  signals: string[];
}

export interface AuthoritySignals {
  externalCitations: number;
  industryRecognition: boolean;
  publicationHistory: boolean;
  brandMentions: number;
  sameAsLinks: number;
  signals: string[];
}

export interface TrustSignals {
  contactInfo: boolean;
  privacyPolicy: boolean;
  httpsValid: boolean;
  transparencyStatement: boolean;
  reviewsPresent: boolean;
  correctionsHistory: boolean;
  signals: string[];
}

export interface AIDetectionResult {
  flaggedPhrases: FlaggedPhrase[];
  aiScore: number;       // 0-100, higher = more likely AI
  cleanScore: number;    // 0-100, higher = more human-like
}

export interface FlaggedPhrase {
  phrase: string;
  category: 'opening_cliche' | 'hedging' | 'filler' | 'pomposity' | 'false_intimacy';
  position: number;
  suggestion: string;
}

export interface EEATRecommendation {
  dimension: 'experience' | 'expertise' | 'authoritativeness' | 'trustworthiness';
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: number;
}

export interface EEATAnalysisResult {
  score: EEATScore;
  experienceSignals: ExperienceSignals;
  expertiseSignals: ExpertiseSignals;
  authoritySignals: AuthoritySignals;
  trustSignals: TrustSignals;
  aiDetection: AIDetectionResult;
  citationDensity: number;
  recommendations: EEATRecommendation[];
  tier: ScoreTier;
  metadata: {
    wordCount: number;
    contentType: ContentType;
    analyzedAt: string;
  };
}

export type ScoreTier = 'exceptional' | 'strong' | 'moderate' | 'weak' | 'very_low';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 90) return 'exceptional';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  if (score >= 30) return 'weak';
  return 'very_low';
}
