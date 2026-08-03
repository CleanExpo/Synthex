/**
 * fal.ai queue adapter. Submit returns a request id; completion arrives at
 * POST /api/video/webhook/fal (token-authenticated URL). Docs: fal.ai/docs queue API.
 * Webhook auth is our own URL token (phase 1); upgrading to fal's signed
 * webhooks (ed25519/JWKS) is a noted follow-up.
 */
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { isPreDispatchFailure } from '@/lib/services/ai/image/providers/errors';
import { captureServerException } from '@/lib/observability/sentry-server';
import {
  ModelRetiredError,
  isModelRetiredResponse,
  UnaddressableSubmitError,
  AmbiguousSubmitError,
} from './types';

const FAL_QUEUE_BASE = 'https://queue.fal.run';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

export function webhookUrl(): string {
  const base = requiredEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
  const token = requiredEnv('FAL_WEBHOOK_SECRET');
  // Full URL is encoded as a query-param value; fal decodes once before calling back.
  return `${base}/api/video/webhook/fal?token=${encodeURIComponent(token)}`;
}

/** Submit a generation to the fal queue; returns fal's request_id. */
export async function submitToFal(
  modelId: string,
  input: Record<string, unknown>
): Promise<string> {
  const apiKey = requiredEnv('FAL_API_KEY');
  const url = `${FAL_QUEUE_BASE}/${modelId}?fal_webhook=${encodeURIComponent(webhookUrl())}`;

  // A THROW here does not mean the request never left. Once fetch has
  // dispatched the POST, a 15-second timeout, an abort or a connection reset
  // says only that we did not hear back — fal may have accepted and queued the
  // job. Treating that as "never sent" released the hold and handed the
  // headroom back for a job the provider might be running and billing
  // (release review, pass 9).
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // NOT every fetch rejection is ambiguous. A DNS failure, a refused
    // connection or a TLS handshake error happens BEFORE any bytes reach fal,
    // so nothing can have been accepted or billed. Marking those billable
    // would let an outage systematically exhaust an organisation's caps
    // without a single provider call (release review, pass 10).
    //
    // Only a failure AFTER dispatch — a timeout or an aborted/reset connection
    // mid-flight — leaves the outcome genuinely unknown.
    if (isPreDispatchFailure(err)) throw err;
    throw new AmbiguousSubmitError(modelId, err);
  }

  if (!res.ok) {
    const body = await res.text();
    logger.error('fal submit failed', { modelId, status: res.status, body });

    // Submit-path liveness surfacing (WS2 / SYN-1075): fal retires model
    // endpoints without notice, returning a 404-class "Path ... not found"
    // response instead of a normal generation failure. Surface this as a
    // typed, actionable error immediately (not buried as a generic 500), and
    // fire a Sentry event at submit time so drift is visible before the
    // weekly canary would otherwise catch it.
    if (isModelRetiredResponse(res.status, body)) {
      const err = new ModelRetiredError(modelId, res.status, body);
      captureServerException(err, {
        operation: 'video/fal-submit',
        level: 'error',
        tags: { code: 'model_retired', modelId, httpStatus: res.status },
        extra: { providerMessage: body.slice(0, 500) },
      });
      throw err;
    }

    throw new Error(`fal submit failed (${res.status}): ${body}`);
  }
  // ANY 2xx that cannot yield a usable job id is an accepted-but-unaddressable
  // submit, however it fails to yield one. Decoding INSIDE this guard matters:
  // a malformed body makes res.json() reject and a null body makes the property
  // read throw, and either escaping as a plain error would make the caller
  // treat a request the provider ACCEPTED as never-sent — writing off spend it
  // may still bill (SYN-1115).
  let requestId: string | undefined;
  try {
    const data = (await res.json()) as { request_id?: string } | null;
    requestId = data?.request_id;
  } catch {
    requestId = undefined;
  }
  if (typeof requestId !== 'string' || requestId.trim() === '') {
    throw new UnaddressableSubmitError(modelId, res.status);
  }
  return requestId;
}

/** Constant-time check of the webhook token query param. */
export function verifyWebhookToken(token: string | null): boolean {
  const secret = process.env.FAL_WEBHOOK_SECRET ?? '';
  if (!token || !secret) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface FalWebhookResult {
  providerJobId: string;
  ok: boolean;
  videoUrl?: string;
  errorMessage?: string;
  isPolicyRejection?: boolean;
}

const POLICY_PATTERNS = /content.?policy|nsfw|safety|moderat/i;

/** Normalize fal's webhook body. Shape: { request_id, status: 'OK'|'ERROR', payload, error }. */
export function parseFalWebhook(body: unknown): FalWebhookResult {
  const b = body as {
    request_id?: string;
    status?: string;
    payload?: { video?: { url?: string } } | null;
    error?: unknown;
  };
  const providerJobId = b.request_id ?? '';
  if (b.status === 'OK' && b.payload?.video?.url) {
    return { providerJobId, ok: true, videoUrl: b.payload.video.url };
  }
  const errorMessage =
    typeof b.error === 'string'
      ? b.error
      : b.error != null
        ? JSON.stringify(b.error)
        : 'unknown fal error';
  return {
    providerJobId,
    ok: false,
    errorMessage,
    isPolicyRejection: POLICY_PATTERNS.test(errorMessage),
  };
}

/** Queue status for a request: IN_QUEUE | IN_PROGRESS | COMPLETED (or throws). */
export async function getFalStatus(
  modelId: string,
  requestId: string
): Promise<string> {
  const apiKey = requiredEnv('FAL_API_KEY');
  const res = await fetch(
    `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`,
    {
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    if (isModelRetiredResponse(res.status, body)) {
      const err = new ModelRetiredError(modelId, res.status, body);
      captureServerException(err, {
        operation: 'video/fal-status',
        level: 'error',
        tags: { code: 'model_retired', modelId, httpStatus: res.status },
        extra: { providerMessage: body.slice(0, 500) },
      });
      throw err;
    }
    throw new Error(`fal status failed (${res.status})`);
  }
  const data = (await res.json()) as { status: string };
  return data.status;
}

/**
 * Fetch the completed result payload for a COMPLETED request (video url +
 * raw payload). Used by callers that poll status directly instead of relying
 * on the async webhook — e.g. the weekly drift canary (WS2), which needs a
 * synchronous end-to-end result within the cron's execution window.
 */
export async function getFalResult(
  modelId: string,
  requestId: string
): Promise<{ videoUrl?: string; raw: unknown }> {
  const apiKey = requiredEnv('FAL_API_KEY');
  const res = await fetch(
    `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`,
    {
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    if (isModelRetiredResponse(res.status, body)) {
      const err = new ModelRetiredError(modelId, res.status, body);
      captureServerException(err, {
        operation: 'video/fal-result',
        level: 'error',
        tags: { code: 'model_retired', modelId, httpStatus: res.status },
        extra: { providerMessage: body.slice(0, 500) },
      });
      throw err;
    }
    throw new Error(`fal result fetch failed (${res.status}): ${body}`);
  }
  const raw = (await res.json()) as { video?: { url?: string } };
  return { videoUrl: raw?.video?.url, raw };
}
