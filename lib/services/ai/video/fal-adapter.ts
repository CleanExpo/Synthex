/**
 * fal.ai queue adapter. Submit returns a request id; completion arrives at
 * POST /api/video/webhook/fal (token-authenticated URL). Docs: fal.ai/docs queue API.
 * Webhook auth is our own URL token (phase 1); upgrading to fal's signed
 * webhooks (ed25519/JWKS) is a noted follow-up.
 */
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

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
    throw new Error(`fal submit failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { request_id: string };
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
  if (!res.ok) throw new Error(`fal status failed (${res.status})`);
  const data = (await res.json()) as { status: string };
  return data.status;
}
