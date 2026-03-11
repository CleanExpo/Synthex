/**
 * AI Backlink Prospector — Backlink Analyser (Phase 95)
 *
 * Orchestrates opportunity discovery, domain scoring, and result assembly.
 * Combines Google CSE results with OpenPageRank domain authority scores.
 *
 * @module lib/backlinks/backlink-analyzer
 */

import { findAllOpportunities }          from './opportunity-finder';
import { scoreDomains, getDomainAuthorityTier } from './domain-scorer';
import type {
  AnalyzeParams,
  AnalysisResult,
  ScoredProspect,
  BacklinkOpportunityType,
} from './types';
import type { BacklinkScoringWeights } from '@/lib/bayesian/surfaces/backlink-scoring';

const MIN_DOMAIN_AUTHORITY = 20;   // Filter out very low DA domains
const MAX_PROSPECTS_RETURNED = 50; // Cap returned prospects

// Mapping from BacklinkOpportunityType string values to BacklinkScoringWeights keys
const TYPE_TO_WEIGHT: Record<string, keyof BacklinkScoringWeights> = {
  'resource-page':      'resourcePageWeight',
  'guest-post':         'guestPostWeight',
  'broken-link':        'brokenLinkWeight',
  'competitor-link':    'competitorLinkWeight',
  'journalist-mention': 'journalistMentionWeight',
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a full backlink opportunity analysis.
 *
 * Flow:
 * 1. Find opportunities via Google CSE (all 5 strategies in parallel)
 * 2. Extract unique domains
 * 3. Score domains via OpenPageRank API (or heuristics)
 * 4. Merge scores back into prospects
 * 5. Filter, deduplicate, sort by DA desc
 * 6. Return top 50
 */
export async function analyzeOpportunities(
  params: AnalyzeParams,
  scoringWeights?: BacklinkScoringWeights,
): Promise<AnalysisResult> {
  const { topic, userDomain, competitorDomains } = params;

  // 1. Discover opportunities
  const rawOpportunities = await findAllOpportunities({
    topic,
    userDomain,
    brandName: topic, // Use topic as brand name for journalist mention searches
    competitorDomains,
  });

  if (rawOpportunities.length === 0) {
    return buildEmptyResult(topic, userDomain);
  }

  // 2. Extract unique domains for scoring
  const uniqueDomains = [...new Set(rawOpportunities.map(o => o.domain))];

  // 3. Score domains (batch call)
  const domainScores = await scoreDomains(uniqueDomains);
  const scoreMap = new Map(domainScores.map(s => [s.domain, s]));

  // 4. Merge scores into prospects
  const scored: ScoredProspect[] = rawOpportunities.map(opp => {
    const score = scoreMap.get(opp.domain);
    const da = score?.domainAuthority ?? 25;
    const pr = score?.pageRank ?? 0;
    return {
      ...opp,
      domainAuthority: da,
      pageRank: pr,
      authorityTier: getDomainAuthorityTier(da),
    };
  });

  // 5. Filter (minimum DA) + deduplicate by domain per type
  const filtered = scored.filter(p => p.domainAuthority >= MIN_DOMAIN_AUTHORITY);

  // Deduplicate: keep highest DA prospect per (domain × type) combination
  const domainTypeMap = new Map<string, ScoredProspect>();
  for (const p of filtered) {
    const key = `${p.domain}::${p.opportunityType}`;
    const existing = domainTypeMap.get(key);
    if (!existing || p.domainAuthority > existing.domainAuthority) {
      domainTypeMap.set(key, p);
    }
  }

  // 6. Sort by DA desc (or BO-weighted DA × type multiplier) and cap
  const finalProspects = [...domainTypeMap.values()]
    .sort((a, b) => {
      const wA = scoringWeights?.[TYPE_TO_WEIGHT[a.opportunityType]] ?? 0.20;
      const wB = scoringWeights?.[TYPE_TO_WEIGHT[b.opportunityType]] ?? 0.20;
      return (b.domainAuthority * wB) - (a.domainAuthority * wA);
    })
    .slice(0, MAX_PROSPECTS_RETURNED);

  // 7. Build stats
  const highValueCount = finalProspects.filter(p => p.domainAuthority >= 40).length;

  const byType = finalProspects.reduce<Record<BacklinkOpportunityType, number>>(
    (acc, p) => {
      acc[p.opportunityType] = (acc[p.opportunityType] ?? 0) + 1;
      return acc;
    },
    {
      'resource-page':      0,
      'guest-post':         0,
      'broken-link':        0,
      'competitor-link':    0,
      'journalist-mention': 0,
    }
  );

  return {
    topic,
    userDomain,
    prospects: finalProspects,
    linksFound: finalProspects.length,
    highValueCount,
    byType,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmptyResult(topic: string, userDomain: string): AnalysisResult {
  return {
    topic,
    userDomain,
    prospects: [],
    linksFound: 0,
    highValueCount: 0,
    byType: {
      'resource-page':      0,
      'guest-post':         0,
      'broken-link':        0,
      'competitor-link':    0,
      'journalist-mention': 0,
    },
  };
}
