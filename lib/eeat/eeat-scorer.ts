/**
 * E-E-A-T Scorer — Core Orchestrator
 *
 * Scores content against Google's E-E-A-T framework (December 2025 update).
 * Weighted: Experience(20%) + Expertise(25%) + Authoritativeness(25%) + Trustworthiness(30%)
 *
 * @module lib/eeat/eeat-scorer
 */

import { logger } from '@/lib/logger';
import type { EEATInput, EEATAnalysisResult, EEATScore, EEATRecommendation } from './types';
import { getScoreTier } from './types';
import { detectExperience } from './experience-detector';
import { validateExpertise } from './expertise-validator';
import { checkAuthority } from './authority-checker';
import { analyzeTrust } from './trust-analyzer';
import { detectAIContent } from './ai-content-detector';

const WEIGHTS = {
  experience: 0.20,
  expertise: 0.25,
  authoritativeness: 0.25,
  trustworthiness: 0.30,
} as const;

export async function scoreEEAT(input: EEATInput): Promise<EEATAnalysisResult> {
  const startTime = Date.now();
  const contentType = input.contentType || 'general';
  logger.info('Starting E-E-A-T analysis', { contentType, hasAuthor: !!input.authorInfo });

  try {
    // Run all dimension analyses
    const experienceSignals = detectExperience(input.content);
    const expertiseSignals = validateExpertise(input.content, input.authorInfo);
    const authoritySignals = checkAuthority(input.content, input.authorInfo);
    const trustSignals = analyzeTrust(input.content, input.url);
    const aiDetection = detectAIContent(input.content);

    // Calculate dimension scores
    const experienceScore = calculateExperienceScore(experienceSignals);
    const expertiseScore = calculateExpertiseScore(expertiseSignals);
    const authorityScore = calculateAuthorityScore(authoritySignals);
    const trustScore = calculateTrustScore(trustSignals);

    // AI penalty: reduce scores if high AI detection
    const aiPenalty = aiDetection.aiScore > 50 ? (aiDetection.aiScore - 50) * 0.3 : 0;

    const score: EEATScore = {
      experience: Math.max(0, Math.round(experienceScore - aiPenalty * 0.5)),
      expertise: Math.max(0, Math.round(expertiseScore - aiPenalty * 0.3)),
      authoritativeness: Math.round(authorityScore),
      trustworthiness: Math.max(0, Math.round(trustScore - aiPenalty * 0.2)),
      overall: 0,
    };

    score.overall = Math.round(
      score.experience * WEIGHTS.experience +
      score.expertise * WEIGHTS.expertise +
      score.authoritativeness * WEIGHTS.authoritativeness +
      score.trustworthiness * WEIGHTS.trustworthiness
    );

    // Citation density
    const words = input.content.split(/\s+/).filter(Boolean);
    const citations = input.content.match(/\[\d+\]|\([A-Z][a-z]+,?\s*\d{4}\)|according to|source:/gi) || [];
    const citationDensity = words.length > 0 ? (citations.length / words.length) * 200 : 0;

    // Generate recommendations
    const recommendations = generateEEATRecommendations(score, experienceSignals, expertiseSignals, authoritySignals, trustSignals, citationDensity, aiDetection);

    const result: EEATAnalysisResult = {
      score,
      experienceSignals,
      expertiseSignals,
      authoritySignals,
      trustSignals,
      aiDetection,
      citationDensity: Math.round(citationDensity * 100) / 100,
      recommendations,
      tier: getScoreTier(score.overall),
      metadata: {
        wordCount: words.length,
        contentType,
        analyzedAt: new Date().toISOString(),
      },
    };

    logger.info('E-E-A-T analysis complete', { overall: score.overall, tier: result.tier, duration: Date.now() - startTime });
    return result;
  } catch (error) {
    logger.error('E-E-A-T analysis failed', { error });
    throw error;
  }
}

function calculateExperienceScore(signals: ReturnType<typeof detectExperience>): number {
  let score = 20; // Base
  score += Math.min(30, signals.firstPersonNarratives * 10);
  if (signals.originalPhotos) score += 10;
  score += Math.min(15, signals.caseStudies * 5);
  if (signals.processDocumentation) score += 10;
  if (signals.beforeAfterResults) score += 10;
  score += Math.min(5, signals.specificExamples * 1);
  return Math.min(100, score);
}

function calculateExpertiseScore(signals: ReturnType<typeof validateExpertise>): number {
  let score = 10; // Base
  if (signals.authorCredentials) score += 20;
  score += Math.min(20, signals.relevantQualifications * 10);
  if (signals.technicalAccuracy) score += 15;
  score += Math.min(15, signals.specializedVocabulary * 3);
  if (signals.upToDate) score += 10;
  if (signals.bylineVisible) score += 10;
  return Math.min(100, score);
}

function calculateAuthorityScore(signals: ReturnType<typeof checkAuthority>): number {
  let score = 10; // Base
  score += Math.min(25, signals.externalCitations * 5);
  if (signals.industryRecognition) score += 20;
  if (signals.publicationHistory) score += 15;
  score += Math.min(15, signals.brandMentions * 3);
  score += Math.min(15, signals.sameAsLinks * 5);
  return Math.min(100, score);
}

function calculateTrustScore(signals: ReturnType<typeof analyzeTrust>): number {
  let score = 10; // Base
  if (signals.contactInfo) score += 15;
  if (signals.privacyPolicy) score += 10;
  if (signals.httpsValid) score += 15;
  if (signals.transparencyStatement) score += 20;
  if (signals.reviewsPresent) score += 15;
  if (signals.correctionsHistory) score += 15;
  return Math.min(100, score);
}

function generateEEATRecommendations(
  score: EEATScore,
  experience: any,
  expertise: any,
  authority: any,
  trust: any,
  citationDensity: number,
  aiDetection: any
): EEATRecommendation[] {
  const recs: EEATRecommendation[] = [];

  if (score.experience < 50) {
    recs.push({
      dimension: 'experience',
      priority: score.experience < 30 ? 'critical' : 'high',
      action: 'Add first-person narratives, original photos, specific case studies, and before/after results to demonstrate first-hand experience.',
      estimatedImpact: 20 - score.experience * 0.2,
    });
  }

  if (score.expertise < 50) {
    recs.push({
      dimension: 'expertise',
      priority: score.expertise < 30 ? 'critical' : 'high',
      action: 'Add author credentials, byline with qualifications, and demonstrate technical depth with specialized vocabulary.',
      estimatedImpact: 25 - score.expertise * 0.25,
    });
  }

  if (score.authoritativeness < 50) {
    recs.push({
      dimension: 'authoritativeness',
      priority: score.authoritativeness < 30 ? 'critical' : 'high',
      action: 'Build external citations, get industry recognition, maintain consistent publication history, and establish sameAs entity links.',
      estimatedImpact: 25 - score.authoritativeness * 0.25,
    });
  }

  if (score.trustworthiness < 50) {
    recs.push({
      dimension: 'trustworthiness',
      priority: score.trustworthiness < 30 ? 'critical' : 'high',
      action: 'Add clear contact information, privacy policy, transparency statement, and customer reviews.',
      estimatedImpact: 30 - score.trustworthiness * 0.3,
    });
  }

  if (citationDensity < 1) {
    recs.push({
      dimension: 'expertise',
      priority: 'critical',
      action: `Citation density is ${citationDensity.toFixed(2)} per 200 words. Increase to >= 1.0 by adding inline references from authoritative sources.`,
      estimatedImpact: 15,
    });
  }

  if (aiDetection.aiScore > 50) {
    recs.push({
      dimension: 'trustworthiness',
      priority: 'critical',
      action: `AI content detection score: ${aiDetection.aiScore}%. Remove ${aiDetection.flaggedPhrases.length} flagged AI-isms and rewrite in authentic human voice.`,
      estimatedImpact: 20,
    });
  }

  return recs.sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2, low: 3 };
    return p[a.priority] - p[b.priority] || b.estimatedImpact - a.estimatedImpact;
  });
}
