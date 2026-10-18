/**
 * Server-issued card sessions. The card page issues the session id and signs it; the events route
 * counts an event as randomly assigned only when the signature verifies AND the variant is the one
 * assignedVariant() derives from that id. A visitor therefore cannot pick ids to steer the
 * randomised sample, and a forced ?variant= visit (never signed) is always recorded as forced
 * (Codex review of PR #1016). With no JWT_SECRET configured nothing is signed, so every event is
 * honestly recorded as forced (unverified), never as random.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { checkRateLimit } from '@/lib/auth/rate-limit';

function key(): string | null {
  const secret = process.env.JWT_SECRET;
  return secret ? `card-assignment:v1:${secret}` : null;
}

export function signSession(sessionId: string): string | null {
  const k = key();
  return k
    ? createHmac('sha256', k).update(sessionId).digest('base64url')
    : null;
}

export function verifySession(
  sessionId: string,
  sig: string | undefined
): boolean {
  const expected = signSession(sessionId);
  if (!expected || !sig) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueSession(): { id: string; sig: string | null } {
  const id = randomUUID();
  return { id, sig: signSession(id) };
}

/**
 * Issue a signed session for a visitor, at most MINT_PER_HOUR per IP per card. Reloading the page
 * to shop for a variant mints a new signed session each time; past the cap the session is still
 * issued but unsigned, so it records as forced and never enters the randomised sample. Residual
 * risk, accepted and documented: an anonymous public page cannot stop a visitor who rotates IPs
 * from self-selecting a variant; the pilot's causal claim assumes honest visitors (owner decision).
 */
export const MINT_PER_HOUR = 10;
export async function issueSessionFor(
  slug: string,
  ip: string
): Promise<{ id: string; sig: string | null }> {
  const issued = issueSession();
  const rate = await checkRateLimit(null, {
    namespace: 'card-session-mint',
    orgKey: `card:${slug}`,
    ipKey: ip,
    limits: {
      org: { limit: 50_000, windowSeconds: 3_600 },
      ip: { limit: MINT_PER_HOUR, windowSeconds: 3_600 },
    },
  });
  return rate.ok ? issued : { id: issued.id, sig: null };
}
