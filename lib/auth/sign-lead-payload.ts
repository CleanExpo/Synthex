/**
 * Server-side helper to sign a JSON payload destined for `POST /api/leads`.
 *
 * Used exclusively by the server-side signing shim at
 * `app/api/internal/sign-lead/route.ts` so the public benchmark form can
 * submit a lead without ever shipping `LEAD_CAPTURE_HMAC_SECRET` to the
 * browser. The shim is the only authorised caller.
 *
 * Pure function — no I/O, no side effects, no logger import. Throws if the
 * secret is missing so a misconfigured deployment fails loudly rather than
 * silently producing invalid signatures.
 *
 * @module lib/auth/sign-lead-payload
 * @task SYN-801
 */

import 'server-only';
import { createHmac } from 'crypto';

export interface SignedLeadPayload {
  /** The exact JSON string that must be sent as the request body. */
  body: string;
  /** Header value: `sha256=<hex>` — pass as `x-synthex-signature`. */
  signature: string;
}

/**
 * Sign an arbitrary lead payload with `LEAD_CAPTURE_HMAC_SECRET`.
 *
 * The returned `body` is the canonical string that was signed — callers
 * must forward this exact string to `/api/leads`, not re-stringify the
 * object, otherwise the signature will not verify.
 *
 * @throws Error when `LEAD_CAPTURE_HMAC_SECRET` is not configured.
 */
export function signLeadPayload(payload: unknown): SignedLeadPayload {
  const secret = process.env.LEAD_CAPTURE_HMAC_SECRET;
  if (!secret) {
    throw new Error(
      'LEAD_CAPTURE_HMAC_SECRET is not configured — cannot sign lead payload'
    );
  }

  const body = JSON.stringify(payload);
  const digest = createHmac('sha256', secret).update(body).digest('hex');

  return {
    body,
    signature: `sha256=${digest}`,
  };
}
