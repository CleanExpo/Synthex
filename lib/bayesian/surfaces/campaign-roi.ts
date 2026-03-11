/**
 * Bayesian Optimisation Surface Adapter — Campaign ROI
 *
 * Provides BO-optimised platform budget allocation weights.
 * Applied in ROIService.calculateROI() to re-rank platforms by their
 * BO-informed expected return, not just their raw historical ROI.
 *
 * Surface: 'campaign_roi'
 * Dimensions: one allocation weight per social platform (8 total)
 *
 * @module lib/bayesian/surfaces/campaign-roi
 */

import { getOptimisedWeightsOrFallback } from '@/lib/bayesian/fallback';
import type { WeightResult } from '@/lib/bayesian/fallback';
import type { ParameterBounds } from '@/lib/bayesian/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CampaignROIWeights {
  youtubeAllocation:   number; // 0.05 – 0.40
  instagramAllocation: number; // 0.05 – 0.40
  tiktokAllocation:    number; // 0.05 – 0.40
  twitterAllocation:   number; // 0.05 – 0.40
  facebookAllocation:  number; // 0.05 – 0.40
  linkedinAllocation:  number; // 0.05 – 0.40
  pinterestAllocation: number; // 0.05 – 0.40
  redditAllocation:    number; // 0.05 – 0.40
}

export interface CampaignROIResult {
  weights: CampaignROIWeights;
  source:  WeightResult['source'];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default heuristic weights — loosely aligned with average social media
 * ad spend distribution data. No sumEquals constraint — each weight is an
 * independent ROI sort multiplier per platform.
 */
export const CAMPAIGN_ROI_DEFAULTS: CampaignROIWeights = {
  youtubeAllocation:   0.20,
  instagramAllocation: 0.18,
  tiktokAllocation:    0.15,
  twitterAllocation:   0.15,
  facebookAllocation:  0.12,
  linkedinAllocation:  0.10,
  pinterestAllocation: 0.05,
  redditAllocation:    0.05,
};

export const CAMPAIGN_ROI_BOUNDS: Record<keyof CampaignROIWeights, ParameterBounds> = {
  youtubeAllocation:   { min: 0.05, max: 0.40 },
  instagramAllocation: { min: 0.05, max: 0.40 },
  tiktokAllocation:    { min: 0.05, max: 0.40 },
  twitterAllocation:   { min: 0.05, max: 0.40 },
  facebookAllocation:  { min: 0.05, max: 0.40 },
  linkedinAllocation:  { min: 0.05, max: 0.40 },
  pinterestAllocation: { min: 0.05, max: 0.40 },
  redditAllocation:    { min: 0.05, max: 0.40 },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve BO-optimised weights for the campaign_roi surface.
 *
 * Returns optimised weights when the BO service is available and has
 * sufficient observations, otherwise returns CAMPAIGN_ROI_DEFAULTS.
 *
 * @param orgId — Organisation ID; BO state is per-org
 */
export async function getCampaignROIWeights(
  orgId: string,
): Promise<CampaignROIResult> {
  const result = await getOptimisedWeightsOrFallback(
    'campaign_roi',
    orgId,
    () => ({ ...CAMPAIGN_ROI_DEFAULTS }),
  );

  const raw = result.weights as Record<string, number>;
  const weights: CampaignROIWeights = {
    youtubeAllocation:   raw.youtubeAllocation   ?? CAMPAIGN_ROI_DEFAULTS.youtubeAllocation,
    instagramAllocation: raw.instagramAllocation ?? CAMPAIGN_ROI_DEFAULTS.instagramAllocation,
    tiktokAllocation:    raw.tiktokAllocation    ?? CAMPAIGN_ROI_DEFAULTS.tiktokAllocation,
    twitterAllocation:   raw.twitterAllocation   ?? CAMPAIGN_ROI_DEFAULTS.twitterAllocation,
    facebookAllocation:  raw.facebookAllocation  ?? CAMPAIGN_ROI_DEFAULTS.facebookAllocation,
    linkedinAllocation:  raw.linkedinAllocation  ?? CAMPAIGN_ROI_DEFAULTS.linkedinAllocation,
    pinterestAllocation: raw.pinterestAllocation ?? CAMPAIGN_ROI_DEFAULTS.pinterestAllocation,
    redditAllocation:    raw.redditAllocation    ?? CAMPAIGN_ROI_DEFAULTS.redditAllocation,
  };

  return { weights, source: result.source };
}
