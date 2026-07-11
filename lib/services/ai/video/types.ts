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
  referenceSet?: string; // owned reference set id (e.g. 'carpet-cleaning')
  useReferences?: boolean; // opt-in: ground the I2V seed from the reference library
}

export interface SubmittedJob {
  id: string; // VideoGeneration row id
  providerJobId: string;
  batchGroupId: string;
  model: string;
  estimatedCostUsd: number;
  status: 'generating';
  grounded?: boolean; // true when the seed came from an owned reference set
  referenceSet?: string; // the industry key the seed was drawn from
  groundedSubject?: string; // the manifest subject key the seed was drawn from
  groundedVendor?: string; // the vendorKey (rights lineage) of the grounded subject
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

/**
 * Submit-path liveness surfacing (WS2 / SYN-1075) — fal retires model
 * endpoints without notice ("Path /v2.5/text-to-video not found"). A bare
 * 500 buries this as a generic submit failure; this typed error makes the
 * failure mode ("model_retired") actionable for callers (MCP tool responses,
 * the weekly drift canary, studio UI) instead of a generic Error the caller
 * has to string-match.
 */
export class ModelRetiredError extends Error {
  public readonly code = 'model_retired' as const;

  constructor(
    public readonly modelId: string,
    public readonly httpStatus: number,
    public readonly providerMessage: string
  ) {
    super(
      `Video model appears retired by the provider: ${modelId} (fal ${httpStatus}: ${providerMessage.slice(0, 300)})`
    );
    this.name = 'ModelRetiredError';
  }
}

/** True for fal's 404-class "endpoint doesn't exist" responses — the shape of a retired model. */
export function isModelRetiredResponse(status: number, body: string): boolean {
  if (status === 404) return true;
  return /not found|does not exist|no longer available|deprecated|retired/i.test(
    body
  );
}
