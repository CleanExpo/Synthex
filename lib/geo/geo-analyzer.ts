/**
 * GEO Analyzer — Core Orchestrator
 *
 * Analyzes content for AI search engine citability using 5 weighted criteria.
 * Weights: Citability(25%) + Structure(20%) + MultiModal(15%) + Authority(20%) + Technical(20%)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL) — For storing analysis results
 *
 * @module lib/geo/geo-analyzer
 */

import { logger } from '@/lib/logger';
import type { GEOAnalysisInput, GEOAnalysisResult, GEOScore, GEOPlatform, PlatformScore } from './types';
import { extractCitablePassages } from './passage-extractor';
import { scoreCitability } from './citability-scorer';
import { analyzeStructure } from './structure-analyzer';
import { optimizeForPlatform } from './platform-optimizer';
import { analyzeSchema } from './schema-enhancer';
import { generateRecommendations } from './recommendations';

// Score weights
const WEIGHTS = {
  citability: 0.25,
  structure: 0.20,
  multiModal: 0.15,
  authority: 0.20,
  technical: 0.20,
} as const;

export async function analyzeGEO(input: GEOAnalysisInput): Promise<GEOAnalysisResult> {
  const startTime = Date.now();
  logger.info('Starting GEO analysis', { contentLength: input.contentText.length, platform: input.platform || 'all' });

  try {
    // Extract passages
    const passages = extractCitablePassages(input.contentText);

    // Analyze structure
    const structureAnalysis = analyzeStructure(input.contentText);

    // Score citability
    const citabilityScore = scoreCitability(passages, input.contentText);

    // Analyze schema issues
    const schemaIssues = analyzeSchema(input.contentText, input.contentUrl);

    // Count citations (patterns like [1], (Source, 2024), etc.)
    const citationPatterns = input.contentText.match(/\[\d+\]|\([A-Z][a-z]+(?:\s+(?:et al\.)?)?,?\s*\d{4}\)|(?:according to|source:|cited from|reference:)/gi) || [];
    const citationCount = citationPatterns.length;
    const wordCount = input.contentText.split(/\s+/).filter(Boolean).length;
    const citationDensity = wordCount > 0 ? (citationCount / wordCount) * 200 : 0;

    // Multi-modal detection (images, tables, code blocks, diagrams references)
    const multiModalSignals = {
      hasImages: /!\[.*?\]\(.*?\)|<img\s|data:image|\.png|\.jpg|\.webp/i.test(input.contentText),
      hasTables: /<table|<th|<td|\|[-:]+\|/i.test(input.contentText) || structureAnalysis.hasTables,
      hasCodeBlocks: /```[\s\S]*?```|<pre>|<code>/i.test(input.contentText),
      hasCharts: /chart|graph|diagram|figure|infographic|visualization/i.test(input.contentText),
      hasVideo: /video|youtube|vimeo|embed/i.test(input.contentText),
    };
    const multiModalCount = Object.values(multiModalSignals).filter(Boolean).length;
    const multiModalScore = Math.min(100, multiModalCount * 20);

    // Authority signals
    const authoritySignals = {
      hasByline: /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+|author:|written by/i.test(input.contentText),
      hasCredentials: /Ph\.?D|M\.?D|MBA|CPA|certified|licensed|professor|researcher/i.test(input.contentText),
      hasMethodology: /methodology|research method|data collection|sample size|survey/i.test(input.contentText),
      hasDates: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i.test(input.contentText),
      hasExternalLinks: /https?:\/\/(?!(?:example\.com|localhost))/gi.test(input.contentText),
      citationDensityMet: citationDensity >= 1,
    };
    const authorityCount = Object.values(authoritySignals).filter(Boolean).length;
    const authorityScore = Math.min(100, Math.round((authorityCount / 6) * 100));

    // Technical score
    const technicalSignals = {
      hasSchema: structureAnalysis.hasSchema,
      hasHeadingHierarchy: structureAnalysis.headingHierarchy,
      hasMetaDescription: /meta\s+(?:name=["']description["']|property=["']og:description["'])/i.test(input.contentText),
      hasCanonical: /rel=["']canonical["']/i.test(input.contentText),
      hasLangAttribute: /lang=["'][a-z]{2}/i.test(input.contentText),
      isStructuredContent: structureAnalysis.hasLists || structureAnalysis.hasTables || structureAnalysis.hasFAQ,
    };
    const technicalCount = Object.values(technicalSignals).filter(Boolean).length;
    const technicalScore = Math.min(100, Math.round((technicalCount / 6) * 100));

    // Calculate weighted overall
    const score: GEOScore = {
      citability: citabilityScore,
      structure: structureAnalysis.readabilityScore,
      multiModal: multiModalScore,
      authority: authorityScore,
      technical: technicalScore,
      overall: Math.round(
        citabilityScore * WEIGHTS.citability +
        structureAnalysis.readabilityScore * WEIGHTS.structure +
        multiModalScore * WEIGHTS.multiModal +
        authorityScore * WEIGHTS.authority +
        technicalScore * WEIGHTS.technical
      ),
    };

    // Platform-specific scores
    const platforms: GEOPlatform[] = input.platform === 'all' || !input.platform
      ? ['google_aio', 'chatgpt', 'perplexity', 'bing_copilot']
      : [input.platform];
    const platformScores: PlatformScore[] = platforms.map(p => optimizeForPlatform(score, structureAnalysis, passages, p));

    // Generate recommendations
    const recommendations = generateRecommendations(score, structureAnalysis, passages, citationDensity);

    const optimalPassageCount = passages.filter(p => p.isOptimalLength).length;

    const result: GEOAnalysisResult = {
      score,
      citablePassages: passages,
      structureAnalysis,
      platformScores,
      recommendations,
      schemaIssues,
      metadata: {
        wordCount,
        citationCount,
        citationDensity: Math.round(citationDensity * 100) / 100,
        passageCount: passages.length,
        optimalPassageCount,
        analyzedAt: new Date().toISOString(),
      },
    };

    logger.info('GEO analysis complete', { overall: score.overall, duration: Date.now() - startTime });
    return result;
  } catch (error) {
    logger.error('GEO analysis failed', { error });
    throw error;
  }
}
