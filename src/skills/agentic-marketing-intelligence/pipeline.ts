/**
 * Scoring pipeline (INFRA-2).
 *
 * Runs PageMetrics (from the GSC adapter, optionally enriched by the crawl adapter) through
 * the scoring models and produces a confidence-adjusted, risk-gated, prioritised backlog —
 * the same shape consumed by outputs.schema.json.
 *
 * Honesty guarantee preserved: each action's dataStatus is the WORST of its component scores,
 * so a backlog item built on placeholder inputs is marked DATA_REQUIRED and blocked from
 * auto-execution by confidenceAdjustedAction().
 */

import type {
  ActionPriority,
  ConfidenceLabel,
  DataStatus,
  EffortSize,
  GeoInputs,
  PageMetrics,
} from './types';
import {
  confidenceAdjustedAction,
  contentDecay,
  freshnessPriority,
  geoVisibility,
  prioritiseBacklog,
  rankingOpportunity,
} from './scoring-models';

export interface BacklogOptions {
  /** Confidence of the claim(s) the action relies on. Default 'INFERRED'. */
  claimConfidence?: ConfidenceLabel;
  /** Risk-register score for the action class. Default 0.2 (e.g. title/meta rewrite). */
  riskScore?: number;
  /** Effort t-shirt size. Default 'S'. */
  effort?: EffortSize;
  /** Optional GEO inputs per page URL (AEO/GEO test candidates). */
  geoInputsByUrl?: Record<string, GeoInputs>;
}

export interface BacklogResult {
  prioritised: ActionPriority[];
  summary: { verified: number; partial: number; dataRequired: number; blocked: number };
}

function worstStatus(...statuses: DataStatus[]): DataStatus {
  if (statuses.includes('DATA_REQUIRED')) return 'DATA_REQUIRED';
  if (statuses.includes('PARTIAL')) return 'PARTIAL';
  if (statuses.includes('HYPOTHESIS_FOR_TESTING')) return 'HYPOTHESIS_FOR_TESTING';
  return 'VERIFIED';
}

export function buildBacklog(metrics: PageMetrics[], opts: BacklogOptions = {}): BacklogResult {
  const demandMax = Math.max(1, ...metrics.map(m => m.impressions ?? m.searchVolume ?? 0));
  const trafficMax = Math.max(1, ...metrics.map(m => m.clicks ?? 0));

  const actions = metrics.map(m => {
    const ro = rankingOpportunity(m, demandMax);
    const fp = freshnessPriority(m, trafficMax);
    const decay = contentDecay(m);
    const geo = opts.geoInputsByUrl?.[m.url] ? geoVisibility(opts.geoInputsByUrl[m.url]) : null;

    const dataStatus = worstStatus(ro.dataStatus, fp.dataStatus, decay.dataStatus);

    return confidenceAdjustedAction({
      url: m.url,
      project: m.project,
      rankingOpportunity: ro.value,
      // a decaying page strengthens the freshness case — take the stronger signal
      freshnessPriority: Math.max(fp.value, decay.value),
      geoVisibility: geo?.value ?? 0,
      claimConfidence: opts.claimConfidence ?? 'INFERRED',
      riskScore: opts.riskScore ?? 0.2,
      dataStatus,
      effort: opts.effort ?? 'S',
    });
  });

  const prioritised = prioritiseBacklog(actions);
  return {
    prioritised,
    summary: {
      verified: actions.filter(a => a.dataStatus === 'VERIFIED').length,
      partial: actions.filter(a => a.dataStatus === 'PARTIAL').length,
      dataRequired: actions.filter(a => a.dataStatus === 'DATA_REQUIRED').length,
      blocked: actions.filter(a => !!a.blockedReason).length,
    },
  };
}
