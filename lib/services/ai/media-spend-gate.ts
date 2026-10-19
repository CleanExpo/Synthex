/**
 * Media spend gate for the synchronous paid media routes that are not image or
 * video generation: ElevenLabs speech and HeyGen avatar video (P5, spec M10).
 *
 * Those routes called their provider with no hold at all, so a caller could
 * spend without limit. They now reserve against the SAME append-only media
 * spend log and the SAME org media quota the image and video paths use
 * (`lib/services/ai/image/spend-log.ts`), so one organisation has one media
 * budget enforced identically from every side.
 *
 * The contract, mirroring `holdImageSpend` / `holdQuota`:
 *
 *  - price first, in the module that owns the provider (an unpriced request
 *    throws there, before this module is reached);
 *  - `holdMediaSpend` reserves the dearest plausible cost BEFORE the provider
 *    call. An exhausted cap refuses (429, `media_quota_exceeded`); a quota or
 *    budget read error refuses (503, `media_quota_unavailable`). Either way
 *    nothing was reserved and no provider was called;
 *  - `settleMediaSpend` charges what actually ran and writes the one
 *    pipeline_cost_ledger row; `releaseMediaSpend` returns the hold when the
 *    provider produced nothing. Both share the hold's finalize key, so a replay
 *    no-ops and only the first terminal outcome stands.
 *
 * Holds are recorded with mediaType 'audio' so spend reports can tell voice
 * and avatar spend from images. For the stale sweep only 'video' is special
 * (asynchronous, owner row); 'audio' calls are synchronous with no owner row,
 * so like images the sweep charges the full reservation if a request dies
 * before settling.
 */
import { randomUUID } from 'crypto';
import {
  reserveSpendBatch,
  finalizeSpend,
} from '@/lib/services/ai/image/spend-log';
import { QuotaExceededError } from '@/lib/services/ai/video/types';
import type { InitiatedBy } from '@/lib/services/ai/video/types';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import {
  isSystemOrganization,
  SYSTEM_ORGANIZATION_ID,
} from '@/lib/ai/generation-context';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

export type MediaSpendRefusalCode =
  | 'media_quota_exceeded'
  | 'media_quota_unavailable'
  | 'media_unpriced'
  | 'media_unattributed';

/** A spend refused before any provider call. `status` is the honest HTTP answer. */
export class MediaSpendRefusedError extends Error {
  constructor(
    public readonly code: MediaSpendRefusalCode,
    public readonly status: 403 | 422 | 429 | 503,
    message: string
  ) {
    super(message);
    this.name = 'MediaSpendRefusedError';
  }
}

export interface MediaSpendHold {
  holdId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  heldUsd: number;
  /** pipeline_cost_ledger pipeline_name, e.g. 'voice-generation'. */
  pipeline: string;
  /** Model or plan the ledger row names, e.g. 'eleven_multilingual_v2'. */
  model: string;
}

/**
 * Who pays for a media request. A validated service token (cross-product,
 * machine caller) spends against the system organisation under the agent
 * ('mcp') sub-cap, the stricter one; a signed-in user spends against their
 * effective organisation. No organisation, or an unreadable one, refuses:
 * spend that cannot be attributed is spend that cannot be capped.
 */
export async function resolveMediaSpendOwner(
  caller: { isService: true } | { isService: false; userId: string }
): Promise<{ organizationId: string; initiatedBy: InitiatedBy }> {
  if (caller.isService) {
    return { organizationId: SYSTEM_ORGANIZATION_ID, initiatedBy: 'mcp' };
  }
  let organizationId: string | null;
  try {
    organizationId = await getEffectiveOrganizationId(caller.userId);
  } catch (error) {
    logger.error('media spend: organisation lookup failed — refusing', {
      error,
    });
    throw new MediaSpendRefusedError(
      'media_quota_unavailable',
      503,
      'Media budget could not be read; the request was refused before any provider call'
    );
  }
  if (!organizationId) {
    throw new MediaSpendRefusedError(
      'media_unattributed',
      403,
      'No organisation resolved for this account; the spend could not be attributed'
    );
  }
  return { organizationId, initiatedBy: 'studio' };
}

interface HoldParams {
  organizationId: string;
  initiatedBy: InitiatedBy;
  pipeline: string;
  model: string;
}

/**
 * Reserve `perHoldUsd` under `count` holds, admitted or refused as one unit.
 * Throws MediaSpendRefusedError; never returns without every hold written.
 */
export async function holdMediaSpendBatch(
  params: HoldParams & { perHoldUsd: number; count: number }
): Promise<MediaSpendHold[]> {
  const { perHoldUsd, count, ...rest } = params;
  if (!Number.isFinite(perHoldUsd) || perHoldUsd <= 0) {
    // A zero or NaN hold would reserve nothing and let the call through free.
    throw new MediaSpendRefusedError(
      'media_unpriced',
      422,
      `media spend for ${params.model} has no positive price`
    );
  }
  const holdIds = Array.from({ length: count }, () => randomUUID());
  try {
    await reserveSpendBatch({
      holdIds,
      organizationId: params.organizationId,
      initiatedBy: params.initiatedBy,
      perHoldUsd,
      mediaType: 'audio',
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      throw new MediaSpendRefusedError(
        'media_quota_exceeded',
        429,
        error.message
      );
    }
    // Unreadable quota is not an empty quota: refuse, never spend unbudgeted.
    logger.error('media spend: quota read failed — refusing', {
      organizationId: params.organizationId,
      pipeline: params.pipeline,
      error,
    });
    throw new MediaSpendRefusedError(
      'media_quota_unavailable',
      503,
      'Media budget could not be read; the request was refused before any provider call'
    );
  }
  return holdIds.map(holdId => ({ holdId, heldUsd: perHoldUsd, ...rest }));
}

export async function holdMediaSpend(
  params: HoldParams & { heldUsd: number }
): Promise<MediaSpendHold> {
  const { heldUsd, ...rest } = params;
  const [hold] = await holdMediaSpendBatch({
    ...rest,
    perHoldUsd: heldUsd,
    count: 1,
  });
  return hold;
}

/**
 * Charge what actually ran. Idempotent: a replay hits the finalize key and
 * writes neither a second event nor a second ledger row. Never throws — the
 * provider already succeeded, so a bookkeeping error must not turn the paid
 * result into a failure; an unsettled hold stays charged at its reservation
 * until the stale sweep finalises it (errs high, never low).
 */
export async function settleMediaSpend(
  hold: MediaSpendHold,
  actualUsd: number
): Promise<void> {
  const charged = Math.round(actualUsd * 10000) / 10000;
  let wrote = false;
  try {
    wrote = await finalizeSpend({
      holdId: hold.holdId,
      organizationId: hold.organizationId,
      initiatedBy: hold.initiatedBy,
      heldUsd: hold.heldUsd,
      actualUsd: charged,
      kind: 'settle',
    });
  } catch (error) {
    logger.error('media spend: settle failed — hold left for the sweep', {
      holdId: hold.holdId,
      error,
    });
    return;
  }
  if (!wrote || charged <= 0) return;
  try {
    await trackPipelineCost({
      pipeline_name: hold.pipeline,
      client_id: isSystemOrganization(hold.organizationId)
        ? null
        : hold.organizationId,
      run_id: hold.holdId,
      model: hold.model,
      // Billed per character / per second, not tokens; the columns are NOT NULL.
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: charged,
    });
  } catch (error) {
    logger.error('media spend: ledger write failed', {
      holdId: hold.holdId,
      error,
    });
  }
}

/** Return the whole hold: the provider produced nothing. Never throws. */
export async function releaseMediaSpend(hold: MediaSpendHold): Promise<void> {
  try {
    await finalizeSpend({
      holdId: hold.holdId,
      organizationId: hold.organizationId,
      initiatedBy: hold.initiatedBy,
      heldUsd: hold.heldUsd,
      kind: 'release',
    });
  } catch (error) {
    logger.error('media spend: release failed — hold left for the sweep', {
      holdId: hold.holdId,
      error,
    });
  }
}

/** The response body for a refused spend, or null when `error` is not one. */
export function mediaSpendRefusal(error: unknown): {
  body: { success: false; error: string; code: string };
  status: number;
} | null {
  if (!(error instanceof MediaSpendRefusedError)) return null;
  return {
    body: { success: false, error: error.message, code: error.code },
    status: error.status,
  };
}
