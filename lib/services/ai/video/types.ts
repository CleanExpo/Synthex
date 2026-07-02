/**
 * Generative video engine — shared types.
 * Spec: docs/superpowers/specs/2026-06-11-synthex-generative-video-design.md
 */

export type ModelTier = 'draft' | 'standard' | 'premium';
export type AspectRatio = '9:16' | '1:1' | '16:9';
export type InitiatedBy = 'studio' | 'copilot' | 'mcp';

export interface VideoModelSpec {
  id: string; // fal endpoint id, e.g. 'fal-ai/wan/v2.5/text-to-video'
  name: string;
  provider: 'fal';
  tier: ModelTier;
  costPerSecondUsd: number;
  maxDurationSeconds: number;
  aspectRatios: AspectRatio[];
  supportsImageInput: boolean;
  supportsAudio: boolean;
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
}

export interface GenerativeVideoRequest {
  userId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  prompt: string; // the user's subject (fills {{subject}})
  imageUrl?: string; // I2V input
  methodCardId: string;
  modifierIds?: string[];
  brandCardId?: string; // organizationId of the brand to apply
  audio?: boolean;
  variants?: number; // 1-8, default 1
  modelTier?: ModelTier; // default 'draft'
  aspectRatio?: AspectRatio; // default '9:16'
  durationSeconds?: number; // default 6
}

export interface SubmittedJob {
  id: string; // VideoGeneration row id
  providerJobId: string;
  batchGroupId: string;
  model: string;
  estimatedCostUsd: number;
  status: 'generating';
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly cap: 'monthly' | 'daily' | 'mcp-daily',
    public readonly limitUsd: number,
    public readonly spentUsd: number
  ) {
    super(
      `Video budget cap exceeded (${cap}): $${spentUsd.toFixed(2)} spent of $${limitUsd.toFixed(2)} limit`
    );
    this.name = 'QuotaExceededError';
  }
}
