/**
 * fal.ai queue adapter. Submit returns a request id; completion arrives at
 * POST /api/video/webhook/fal (token-authenticated URL). Docs: fal.ai/docs queue API.
 * Webhook auth is our own URL token (phase 1); upgrading to fal's signed
 * webhooks (ed25519/JWKS) is a noted follow-up.
 */
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/observability/sentry-server';
import { ModelRetiredError, isModelRetiredResponse } from './types';

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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15000),
  });

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
  const data = (await res.json()) as { request_id?: string };
  // A 2xx without a usable request id is not a successful submit: the job is
  // unaddressable, the completion webhook cannot be correlated to it, and the
  // spend attempt key derived from it would collide with every other variant
  // of the same batch (SYN-1115). Fail loudly rather than proceed with an
  // empty identifier.
  if (typeof data.request_id !== 'string' || data.request_id.trim() === '') {
    throw new Error(
      `fal submit returned ${res.status} with no request_id — job is unaddressable`
    );
  }
  return data.request_id;
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
