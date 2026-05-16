/**
 * HMAC-signed token for journey tracking-pixel URLs.
 *
 * Closes the cross-tenant write vector on /api/journey/{click,pulse,pulse-confirm}:
 * before this helper, client_id + moment_id were taken from query string and
 * passed straight into service-role .eq() filters. Now they're carried inside
 * a signed payload that the route verifies before issuing the write.
 *
 * Token shape: `<base64url(JSON-payload)>.<base64url(sig)>`
 * Signature:   HMAC-SHA256(KEY, base64url-payload-bytes)
 *
 * Two-key support: sign always uses `JOURNEY_PIXEL_SIGNING_KEY_PRIMARY`;
 * verify accepts either `_PRIMARY` or `_SECONDARY`, enabling zero-downtime
 * rotation by setting _SECONDARY = old, _PRIMARY = new, then dropping
 * _SECONDARY after the TTL window elapses.
 *
 * Audience field (`aud`) is in the signed payload, NOT the URL — the route
 * passes its expected aud to the verifier, blocking cross-route replay.
 *
 * @module lib/journey/pixel-token
 * @task journey-hmac (service-role leak fix 2/N)
 */

import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

export const PIXEL_AUDIENCES = {
  click: 'journey.click.v1',
  pulse: 'journey.pulse.v1',
  pulseConfirm: 'journey.pulse-confirm.v1',
} as const;

export type PixelAudience = (typeof PIXEL_AUDIENCES)[keyof typeof PIXEL_AUDIENCES];

export interface PixelTokenPayload {
  /** Token version — bump when the payload shape changes. */
  v: 1;
  /** Audience: which route this token is valid for. */
  aud: PixelAudience;
  /** Client ID — the `client_journey_events.client_id` for defence-in-depth row scoping. */
  cid: string;
  /** Moment ID — the `client_journey_events.id` row to update. */
  mid: string;
  /** Score (pulse / pulse-confirm only): 1-5 satisfaction rating. */
  s?: 1 | 2 | 3 | 4 | 5;
  /** Destination URL (click only): where to redirect after recording. */
  u?: string;
  /** Expiry — unix seconds. */
  exp: number;
}

export interface SignArgs {
  aud: PixelAudience;
  clientId: string;
  momentId: string;
  /** Optional satisfaction score (pulse / pulse-confirm). */
  score?: 1 | 2 | 3 | 4 | 5;
  /** Optional redirect URL (click). */
  url?: string;
  /** Override TTL (seconds). Defaults to env JOURNEY_PIXEL_TTL_DAYS * 86400. */
  ttlSeconds?: number;
  /** Override clock (test seam). Defaults to Date.now(). */
  nowMs?: number;
}

export type VerifyFailureReason =
  | 'missing-token'
  | 'malformed-token'
  | 'bad-signature'
  | 'expired'
  | 'aud-mismatch'
  | 'payload-shape'
  | 'config-missing';

export type VerifyResult =
  | { ok: true; payload: PixelTokenPayload }
  | { ok: false; reason: VerifyFailureReason };

const DEFAULT_TTL_DAYS = 60;

/**
 * Sign a journey pixel token. Always uses `JOURNEY_PIXEL_SIGNING_KEY_PRIMARY`.
 *
 * @throws if the primary signing key env var is missing.
 */
export function signJourneyToken(args: SignArgs): string {
  const primary = process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY;
  if (!primary) {
    throw new Error(
      'JOURNEY_PIXEL_SIGNING_KEY_PRIMARY is not configured — cannot sign journey token'
    );
  }

  const now = args.nowMs ?? Date.now();
  const ttlDays = Number(process.env.JOURNEY_PIXEL_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const ttlSec = args.ttlSeconds ?? ttlDays * 86400;
  const exp = Math.floor(now / 1000) + ttlSec;

  const payload: PixelTokenPayload = {
    v: 1,
    aud: args.aud,
    cid: args.clientId,
    mid: args.momentId,
    exp,
  };
  if (args.score !== undefined) payload.s = args.score;
  if (args.url !== undefined) payload.u = args.url;

  const encoded = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = createHmac('sha256', primary).update(encoded).digest();
  return `${encoded}.${b64urlEncode(sig)}`;
}

/**
 * Verify a journey pixel token. Tries primary key, then secondary if present.
 *
 * Never throws — always returns a result. Routes can fail silently
 * (return 200 / pixel / redirect) without leaking the failure mode.
 */
export function verifyJourneyToken(
  token: string | null | undefined,
  expectedAud: PixelAudience,
  opts?: { nowMs?: number }
): VerifyResult {
  if (!token) return { ok: false, reason: 'missing-token' };

  const primary = process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY;
  const secondary = process.env.JOURNEY_PIXEL_SIGNING_KEY_SECONDARY;
  if (!primary) return { ok: false, reason: 'config-missing' };

  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0 || dotIdx === token.length - 1) {
    return { ok: false, reason: 'malformed-token' };
  }
  const encoded = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);

  const providedSigBytes = b64urlDecode(providedSig);
  if (!providedSigBytes) return { ok: false, reason: 'malformed-token' };

  const validUnder = (key: string): boolean => {
    const expected = createHmac('sha256', key).update(encoded).digest();
    if (expected.length !== providedSigBytes.length) return false;
    try {
      return timingSafeEqual(expected, providedSigBytes);
    } catch {
      return false;
    }
  };

  const sigOk = validUnder(primary) || (secondary ? validUnder(secondary) : false);
  if (!sigOk) return { ok: false, reason: 'bad-signature' };

  const payloadBytes = b64urlDecode(encoded);
  if (!payloadBytes) return { ok: false, reason: 'malformed-token' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed-token' };
  }

  if (!isPixelPayload(parsed)) return { ok: false, reason: 'payload-shape' };
  if (parsed.aud !== expectedAud) return { ok: false, reason: 'aud-mismatch' };

  const nowSec = Math.floor((opts?.nowMs ?? Date.now()) / 1000);
  if (parsed.exp < nowSec) return { ok: false, reason: 'expired' };

  return { ok: true, payload: parsed };
}

function isPixelPayload(x: unknown): x is PixelTokenPayload {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (typeof o.aud !== 'string') return false;
  if (typeof o.cid !== 'string' || o.cid.length === 0) return false;
  if (typeof o.mid !== 'string' || o.mid.length === 0) return false;
  if (typeof o.exp !== 'number' || !Number.isFinite(o.exp)) return false;
  if (o.s !== undefined && ![1, 2, 3, 4, 5].includes(o.s as number)) return false;
  if (o.u !== undefined && typeof o.u !== 'string') return false;
  const validAuds: PixelAudience[] = [
    PIXEL_AUDIENCES.click,
    PIXEL_AUDIENCES.pulse,
    PIXEL_AUDIENCES.pulseConfirm,
  ];
  return validAuds.includes(o.aud as PixelAudience);
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer | null {
  try {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
  } catch {
    return null;
  }
}
