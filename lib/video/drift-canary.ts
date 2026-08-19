/**
 * Weekly video-model drift canary (WS2 / SYN-1075, spec §9).
 *
 * Submit-path liveness surfacing (fal-adapter.ts) catches drift the moment
 * ANY real generation submits. This canary is the paid, end-to-end proof
 * that runs on a schedule even when nobody is generating — it draft-smokes
 * the cheapest live registry model against a dedicated, isolated internal
 * canary org so a silent retirement is caught before a customer hits it.
 *
 * Registry-driven: the model id is resolved from `registry.ts` at run time —
 * never hardcoded — so the canary always tests whatever the catalog
 * currently calls "cheapest draft", the same resolution real traffic uses.
 *
 * Canary org isolation: found via `Organization.settings` JSON flag
 * (`{ videoCanary: true }`) with `parentOrgId: null` — no `is_internal`
 * column, no migration (spec §11). `parentOrgId: null` means it is a
 * top-level org like any client workspace, but being flagged + never
 * assigned real (non-system) users keeps it out of client/workspace
 * aggregates that key off real membership.
 */
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/observability/sentry-server';
import {
  resolveModel,
  estimateCostUsd,
} from '@/lib/services/ai/video/registry';
import {
  recordAttempt,
  videoAttemptKey,
} from '@/lib/services/ai/image/spend-log';
import {
  holdQuota,
  releaseQuota,
  settleQuota,
} from '@/lib/services/ai/video/quota';
import {
  submitToFal,
  getFalStatus,
  getFalResult,
} from '@/lib/services/ai/video/fal-adapter';
import {
  ModelRetiredError,
  mayHaveBeenBilled,
} from '@/lib/services/ai/video/types';

const DEFAULT_MAX_SPEND_USD = 1.0; // cheapest draft model ~USD0.24 per sec * 3s ~= USD0.73 - headroom above real pricing
const DEFAULT_DURATION_SECONDS = 3;
const DEFAULT_ASPECT_RATIO = '9:16' as const;
const DEFAULT_MAX_ATTEMPTS = 24; // ~2 minutes at 5s intervals
const DEFAULT_SLEEP_MS = 5000;

export interface VideoCanaryResult {
  status: 'pass' | 'fail' | 'skipped';
  reason?: string;
  code?: string;
  modelId?: string;
  providerJobId?: string;
  videoUrl?: string;
  canaryOrgId?: string;
  estimatedCostUsd?: number;
}

export interface VideoCanaryOptions {
  /** Poll interval between fal status checks (default 5000ms; tests set 0). */
  sleepMs?: number;
  /** Max poll attempts before treating the run as a timeout (default 24). */
  maxAttempts?: number;
  /** Hard cap in USD — abort before submitting if the estimate exceeds it. */
  maxSpendUsd?: number;
}

interface CanaryOrg {
  id: string;
  /** A real, existing user in the canary org — VideoGeneration.userId has a
   *  hard FK to User, so the canary must submit as a genuine team member
   *  (the org's own system/owner account), never a synthetic id. */
  userId: string;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolve the dedicated internal canary org + a real member user id to
 * submit as (VideoGeneration.userId has a hard FK to User). Returns null if
 * either half is missing — a config gap, not a drift failure, reported
 * distinctly so operators don't confuse "nobody set this up yet" with "the
 * model died".
 */
export async function resolveCanaryOrg(): Promise<CanaryOrg | null> {
  const org = await prisma.organization.findFirst({
    where: {
      parentOrgId: null,
      settings: { path: ['videoCanary'], equals: true },
    },
    select: { id: true },
  });
  if (!org) return null;

  const member = await prisma.teamMember.findFirst({
    where: { organizationId: org.id },
    select: { userId: true },
    orderBy: { invitedAt: 'asc' },
  });
  if (!member) return null;

  return { id: org.id, userId: member.userId };
}

/**
 * Run the registry-driven draft smoke against the canary org. Never throws —
 * all failure modes resolve to a `VideoCanaryResult` with `status: 'fail'`
 * (or `'skipped'` for config gaps) so the cron route can respond cleanly and
 * alert without an unhandled rejection.
 */
export async function runVideoCanary(
  opts: VideoCanaryOptions = {}
): Promise<VideoCanaryResult> {
  const maxSpendUsd =
    opts.maxSpendUsd ??
    Number(process.env.VIDEO_CANARY_MAX_SPEND_USD ?? DEFAULT_MAX_SPEND_USD);
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleepMs = opts.sleepMs ?? DEFAULT_SLEEP_MS;

  const canaryOrg = await resolveCanaryOrg();
  if (!canaryOrg) {
    logger.warn('video-canary: no internal canary org configured', {});
    captureServerException(
      new Error(
        'video-canary: no internal canary org configured (Organization.settings.videoCanary = true, with at least one TeamMember)'
      ),
      {
        operation: 'video/canary',
        level: 'warning',
        tags: { code: 'canary_not_configured' },
      }
    );
    return {
      status: 'skipped',
      reason: 'no canary org configured',
      code: 'canary_not_configured',
    };
  }

  let model;
  try {
    model = resolveModel('draft', {
      aspectRatio: DEFAULT_ASPECT_RATIO,
      durationSeconds: DEFAULT_DURATION_SECONDS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    captureServerException(err, {
      operation: 'video/canary',
      level: 'error',
      tags: { code: 'no_draft_model' },
    });
    return {
      status: 'fail',
      reason: message,
      code: 'no_draft_model',
      canaryOrgId: canaryOrg.id,
    };
  }

  const estimatedCostUsd = estimateCostUsd(model, DEFAULT_DURATION_SECONDS);

  // Hard spend cap — fail closed before any provider spend if the registry's
  // cheapest draft model ever prices above the cap (pricing drift or a
  // misconfigured cap).
  if (estimatedCostUsd > maxSpendUsd) {
    const message = `video-canary: estimated cost $${estimatedCostUsd.toFixed(4)} exceeds hard cap $${maxSpendUsd.toFixed(4)}`;
    logger.error(message, { modelId: model.id });
    captureServerException(new Error(message), {
      operation: 'video/canary',
      level: 'error',
      tags: { code: 'spend_cap_exceeded', modelId: model.id },
    });
    return {
      status: 'fail',
      reason: message,
      code: 'spend_cap_exceeded',
      modelId: model.id,
      canaryOrgId: canaryOrg.id,
      estimatedCostUsd,
    };
  }

  // Own quota row: holdQuota upserts a dedicated OrganizationVideoQuota row
  // scoped to the canary org id — never shared with any client org's quota.
  // SYN-1115 round-6: reservations are keyed, so the canary carries its own
  // hold id through settle/release exactly as a real job does.
  const spendHoldId = randomUUID();
  await holdQuota(canaryOrg.id, estimatedCostUsd, 'studio', spendHoldId);

  let providerJobId: string;
  try {
    const seed = Math.floor(Math.random() * 2_147_483_647);
    // SANCTIONED EXCEPTION (Real Images Only spec 2026-07-12): monitoring canary, isolated org — not product output.
    providerJobId = await submitToFal(model.id, {
      prompt:
        'synthex internal drift canary — synthetic smoke test, not for publication',
      aspect_ratio: DEFAULT_ASPECT_RATIO,
      duration: DEFAULT_DURATION_SECONDS,
      seed,
    });
  } catch (err) {
    // An accepted-but-unaddressable submit is NOT a failed one: the provider
    // took the request and may bill it, so releasing the whole reservation
    // would explicitly record a paid call as zero spend. Settle at the
    // reservation instead — erring high beats writing off real money
    // (SYN-1115). Every other submit failure genuinely produced nothing.
    // Same predicate as the generator: dispatched-but-unconfirmed is billable
    // too, so it settles rather than releasing (release review, pass 9).
    if (mayHaveBeenBilled(err)) {
      await settleQuota(
        canaryOrg.id,
        spendHoldId,
        estimatedCostUsd,
        estimatedCostUsd,
        'studio'
      ).catch(e =>
        logger.error('video-canary: settle after unaddressable submit failed', {
          e,
        })
      );
      logger.error(
        'video-canary: fal accepted the submit with no request_id — charged as billable',
        { modelId: model.id }
      );
    } else {
      await releaseQuota(
        canaryOrg.id,
        spendHoldId,
        estimatedCostUsd,
        'studio'
      ).catch(e =>
        logger.error(
          'video-canary: quota release after submit failure failed',
          { e }
        )
      );
    }
    const isRetired = err instanceof ModelRetiredError;
    const message = err instanceof Error ? err.message : String(err);
    // fal-adapter already fires a Sentry event for ModelRetiredError at
    // submit time; still capture here with the canary-specific tag so the
    // weekly-proof failure is distinguishable from an ad-hoc submit failure.
    captureServerException(err, {
      operation: 'video/canary',
      level: 'error',
      tags: {
        code: isRetired ? 'model_retired' : 'submit_failed',
        modelId: model.id,
      },
    });
    return {
      status: 'fail',
      reason: message,
      code: isRetired ? 'model_retired' : 'submit_failed',
      modelId: model.id,
      canaryOrgId: canaryOrg.id,
      estimatedCostUsd,
    };
  }

  const row = await prisma.videoGeneration.create({
    data: {
      userId: canaryOrg.userId,
      organizationId: canaryOrg.id,
      title: 'Drift canary smoke test',
      topic: 'video-canary',
      style: 'generative',
      duration: `${DEFAULT_DURATION_SECONDS}s`,
      status: 'generating',
      mode: 'generative',
      provider: 'fal',
      model: model.id,
      providerJobId,
      initiatedBy: 'studio',
      inputPrompt: 'synthex internal drift canary',
      aspectRatio: DEFAULT_ASPECT_RATIO,
      durationSeconds: DEFAULT_DURATION_SECONDS,
      estimatedCostUsd,
      // The canary never stored its hold, so the stale sweep saw a video hold
      // with NO owner row and settled it at zero — the inference "an unlinked
      // video hold cannot have submitted" is only sound when the submit path
      // always persists the link. It does now (release review, pass 3).
      spendHoldId,
    },
  });

  // Evidence that a paid call happened, independent of what the poll does next.
  // Cost is unknown until the render completes, so it is left null rather than
  // asserted as zero — an accepted submit is billable either way.
  await recordAttempt({
    attemptKey: videoAttemptKey(spendHoldId, providerJobId),
    holdId: spendHoldId,
    organizationId: canaryOrg.id,
    mediaType: 'video',
    provider: 'fal',
    modelId: model.id,
    status: 'submitted',
    costUsd: null,
    providerJobId,
  }).catch(e =>
    logger.error('video-canary: could not record provider attempt', { e })
  );

  let videoUrl: string | undefined;
  try {
    let completed = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await getFalStatus(model.id, providerJobId);
      if (status === 'COMPLETED') {
        completed = true;
        break;
      }
      await sleep(sleepMs);
    }

    if (!completed) {
      throw new Error(
        `video-canary: timed out after ${maxAttempts} polls waiting for ${model.id} request ${providerJobId}`
      );
    }

    const result = await getFalResult(model.id, providerJobId);
    videoUrl = result.videoUrl;
    if (!videoUrl) {
      throw new Error(
        `video-canary: ${model.id} request ${providerJobId} completed with no video url in result`
      );
    }
  } catch (err) {
    await prisma.videoGeneration
      .update({
        where: { id: row.id },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(e =>
        logger.error('video-canary: failed to mark row failed', { e })
      );
    // SETTLE, do not release. Everything in this try runs AFTER fal returned a
    // request id, so the provider accepted the job and may bill it. A poll
    // timeout, a status error, a result-fetch error or a missing video url all
    // describe OUR view of the render, not whether it was paid for. Releasing
    // handed the money back and consumed the hold's terminal key so nothing
    // could correct it, and repeated canary failures restored admission
    // headroom beyond the canary organisation's own caps
    // (release review, pass 3).
    await settleQuota(
      canaryOrg.id,
      spendHoldId,
      estimatedCostUsd,
      estimatedCostUsd,
      'studio'
    ).catch(e =>
      logger.error('video-canary: quota settle after render failure failed', {
        e,
      })
    );
    const isRetired = err instanceof ModelRetiredError;
    captureServerException(err, {
      operation: 'video/canary',
      level: 'error',
      tags: {
        code: isRetired ? 'model_retired' : 'render_failed',
        modelId: model.id,
        providerJobId,
      },
    });
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'fail',
      reason: message,
      code: isRetired ? 'model_retired' : 'render_failed',
      modelId: model.id,
      providerJobId,
      canaryOrgId: canaryOrg.id,
      estimatedCostUsd,
    };
  }

  await prisma.videoGeneration.update({
    where: { id: row.id },
    data: { status: 'rendered', videoUrl },
  });
  await settleQuota(
    canaryOrg.id,
    spendHoldId,
    estimatedCostUsd,
    estimatedCostUsd,
    'studio'
  ).catch(e => logger.error('video-canary: quota settle failed', { e }));

  logger.info('video-canary: pass', { modelId: model.id, providerJobId });

  return {
    status: 'pass',
    modelId: model.id,
    providerJobId,
    videoUrl,
    canaryOrgId: canaryOrg.id,
    estimatedCostUsd,
  };
}
