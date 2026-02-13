/**
 * Platform Optimizer
 *
 * Adjusts GEO scores and provides recommendations specific to each AI platform.
 * Platforms: Google AI Overviews, ChatGPT, Perplexity, Bing Copilot.
 *
 * @module lib/geo/platform-optimizer
 */

import type { GEOScore, GEOPlatform, PlatformScore, CitablePassage, StructureAnalysis } from './types';

// Platform-specific weight adjustments (relative to base weights)
const PLATFORM_ADJUSTMENTS: Record<GEOPlatform, Record<string, number>> = {
  google_aio: {
    citability: 1.2,   // Google AIO heavily cites structured passages
    structure: 1.3,    // Schema and structure very important for Google
    multiModal: 1.0,
    authority: 1.1,
    technical: 1.2,    // Google rewards technical SEO compliance
  },
  chatgpt: {
    citability: 1.3,   // ChatGPT prefers well-formatted citable blocks
    structure: 0.9,
    multiModal: 0.8,   // ChatGPT is text-focused
    authority: 1.3,    // Wikipedia/academic sources weighted heavily
    technical: 0.7,
  },
  perplexity: {
    citability: 1.4,   // Perplexity is citation-heavy
    structure: 1.0,
    multiModal: 0.9,
    authority: 1.2,    // Reddit mentions 46.7% of citations
    technical: 0.8,
  },
  bing_copilot: {
    citability: 1.1,
    structure: 1.2,
    multiModal: 1.1,
    authority: 1.0,
    technical: 1.3,    // Bing rewards Bing-specific technical signals
  },
  all: {
    citability: 1.0,
    structure: 1.0,
    multiModal: 1.0,
    authority: 1.0,
    technical: 1.0,
  },
};

export function optimizeForPlatform(
  score: GEOScore,
  structure: StructureAnalysis,
  passages: CitablePassage[],
  platform: GEOPlatform
): PlatformScore {
  const adjustments = PLATFORM_ADJUSTMENTS[platform] || PLATFORM_ADJUSTMENTS.all;

  const adjustedScore = Math.round(
    Math.min(100, score.citability * adjustments.citability) * 0.25 +
    Math.min(100, score.structure * adjustments.structure) * 0.20 +
    Math.min(100, score.multiModal * adjustments.multiModal) * 0.15 +
    Math.min(100, score.authority * adjustments.authority) * 0.20 +
    Math.min(100, score.technical * adjustments.technical) * 0.20
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // Platform-specific analysis
  switch (platform) {
    case 'google_aio':
      if (structure.hasSchema) strengths.push('Schema markup detected — high AIO extraction probability');
      else recommendations.push('Add JSON-LD schema markup for Google AIO snippet eligibility');
      if (structure.hasFAQ) strengths.push('FAQ structure enhances AIO feature eligibility');
      else recommendations.push('Add FAQ section with question-based headings');
      if (score.technical < 60) weaknesses.push('Low technical score reduces Google crawl quality signals');
      break;

    case 'chatgpt':
      if (score.authority >= 70) strengths.push('Strong authority signals — likely to be cited by ChatGPT');
      else weaknesses.push('ChatGPT prioritizes authoritative academic/institutional sources');
      if (passages.some(p => p.isOptimalLength)) strengths.push('Contains optimal-length passages for ChatGPT citation');
      else recommendations.push('Restructure key findings into 134-167 word self-contained blocks');
      recommendations.push('Ensure content is indexed by Bing (ChatGPT uses Bing index)');
      break;

    case 'perplexity':
      if (score.citability >= 70) strengths.push('High citability — Perplexity favours well-cited content');
      else recommendations.push('Increase citation density for Perplexity compatibility');
      recommendations.push('Ensure content is available on Reddit or discussion platforms for Perplexity discovery');
      if (passages.filter(p => p.hasCitation).length > 3) strengths.push('Multiple cited passages increase Perplexity extraction rate');
      break;

    case 'bing_copilot':
      if (structure.hasSchema) strengths.push('Schema markup boosts Bing Copilot visibility');
      if (score.technical >= 70) strengths.push('Strong technical foundation for Bing indexing');
      else recommendations.push('Improve technical SEO signals for Bing crawler compatibility');
      break;
  }

  return {
    platform,
    score: adjustedScore,
    strengths,
    weaknesses,
    recommendations,
  };
}
