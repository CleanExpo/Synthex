/**
 * Authority Analyzer — Orchestrator for the Authority Engine.
 *
 * Two execution paths:
 *   - Free tier  (deepValidation: false): rule-based extraction only, no connector calls
 *   - Addon tier (deepValidation: true):  validates up to 20 claims via source connectors,
 *                                          persists results to AuthorityAnalysis + AuthorityCitation
 *
 * @module lib/authority/authority-analyzer
 */

import type { AuthorityAnalysisResult, ValidatedClaim, SourceType, ExtractedClaim } from './types';
import { extractClaims } from './claim-extractor';
import type { AuthorityValidationWeights } from '@/lib/bayesian/surfaces/authority-validation';
import { scoreAuthority } from './authority-scorer';
import { generateCitations } from './citation-generator';
import { searchAllConnectors } from './source-connectors/index';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface AnalyzeAuthorityOptions {
  userId: string;
  orgId: string;
  deepValidation: boolean;
  priorityWeights?: AuthorityValidationWeights;
}

/**
 * Estimate a rough authority score for the free-tier result.
 * Uses claim count and type diversity as a proxy without connector validation.
 */
function estimateScore(claims: ExtractedClaim[]): number {
  if (claims.length === 0) return 0;

  const typeSet = new Set(claims.map(c => c.type));
  const diversity = Math.min(20, typeSet.size * 4);

  const avgConfidence = claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;
  const confidencePoints = Math.round(avgConfidence * 40);

  return Math.min(60, diversity + confidencePoints); // cap at 60 — deep validation needed for higher
}

/**
 * Analyse content for authority signals.
 *
 * Free tier returns an estimated score with addonRequired: true.
 * Addon tier validates claims via source connectors and persists to the database.
 */
export async function analyzeAuthority(
  content: string,
  options: AnalyzeAuthorityOptions
): Promise<AuthorityAnalysisResult> {
  logger.info('Starting authority analysis', {
    contentLength: content.length,
    deepValidation: options.deepValidation,
    userId: options.userId,
  });

  // ── Step 1: Extract claims (always) ─────────────────────────────────────────
  const extracted = extractClaims(content, options.priorityWeights);

  // ── Step 2: Free tier — no connector calls ───────────────────────────────────
  if (!options.deepValidation) {
    const estimatedScore = estimateScore(extracted);

    // Cast extracted claims as unverified ValidatedClaims
    const unverifiedClaims: ValidatedClaim[] = extracted.map(c => ({
      ...c,
      verified: false,
      sources: [],
      verificationScore: 0,
    }));

    const emptySourceBreakdown: Record<SourceType, number> = {
      government: 0,
      academic: 0,
      industry: 0,
      web: 0,
    };

    return {
      overallScore: estimatedScore,
      claims: unverifiedClaims,
      claimsFound: extracted.length,
      claimsVerified: 0,
      claimsFailed: 0,
      sourceBreakdown: emptySourceBreakdown,
      citations: [],
      recommendations: [],
      addonRequired: true,
    };
  }

  // ── Step 3: Addon tier — validate up to 20 claims via connectors ─────────────
  const toValidate = extracted.slice(0, 20);
  const validatedClaims: ValidatedClaim[] = [];

  for (let i = 0; i < toValidate.length; i += 5) {
    const batch = toValidate.slice(i, i + 5);

    const batchResults = await Promise.allSettled(
      batch.map(async claim => {
        const sources = await searchAllConnectors(claim.text);
        return {
          ...claim,
          verified: sources.length > 0,
          sources,
          verificationScore: sources[0]?.confidence ?? 0,
        } satisfies ValidatedClaim;
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        validatedClaims.push(result.value);
      } else {
        // Connector failure — mark as unverified
        validatedClaims.push({
          ...toValidate[i + j],
          verified: false,
          sources: [],
          verificationScore: 0,
        });
      }
    }
  }

  // Any claims beyond the first 20 that weren't validated
  const remainingClaims: ValidatedClaim[] = extracted.slice(20).map(c => ({
    ...c,
    verified: false,
    sources: [],
    verificationScore: 0,
  }));

  const allClaims = [...validatedClaims, ...remainingClaims];

  // ── Step 4: Build source breakdown ───────────────────────────────────────────
  const sourceBreakdown: Record<SourceType, number> = {
    government: 0,
    academic: 0,
    industry: 0,
    web: 0,
  };

  for (const claim of validatedClaims) {
    for (const source of claim.sources) {
      sourceBreakdown[source.sourceType] = (sourceBreakdown[source.sourceType] ?? 0) + 1;
    }
  }

  // ── Step 5: Score and generate citations ─────────────────────────────────────
  const overallScore = scoreAuthority(validatedClaims, sourceBreakdown);
  const citations = generateCitations(validatedClaims);

  // ── Step 6: Persist to database ──────────────────────────────────────────────
  let dbId: string | undefined;

  try {
    const analysis = await prisma.authorityAnalysis.create({
      data: {
        userId: options.userId,
        orgId: options.orgId,
        contentText: content.slice(0, 10000),
        overallScore,
        claimsFound: extracted.length,
        claimsVerified: validatedClaims.filter(c => c.verified).length,
        claimsFailed: validatedClaims.filter(c => !c.verified).length,
        sourceBreakdown,
        analysisResult: { claims: validatedClaims, citations } as object,
      },
    });

    dbId = analysis.id;

    if (citations.length > 0) {
      await prisma.authorityCitation.createMany({
        data: citations.map(c => ({
          analysisId: analysis.id,
          claimText: c.claimText,
          sourceUrl: c.sourceUrl,
          sourceType: c.sourceType,
          sourceName: c.sourceName,
          confidence: c.confidence,
          citationText: c.citationText,
          verified: true,
        })),
      });
    }

    logger.info('Authority analysis persisted', {
      analysisId: analysis.id,
      overallScore,
      claimsFound: extracted.length,
      claimsVerified: validatedClaims.filter(c => c.verified).length,
      citationsGenerated: citations.length,
    });
  } catch (dbError) {
    // Non-fatal — return result even if persistence fails
    logger.error('Authority analysis DB persistence failed', { error: dbError });
  }

  return {
    id: dbId,
    overallScore,
    claims: allClaims,
    claimsFound: extracted.length,
    claimsVerified: validatedClaims.filter(c => c.verified).length,
    claimsFailed: validatedClaims.filter(c => !c.verified).length,
    sourceBreakdown,
    citations,
    recommendations: [],
  };
}
