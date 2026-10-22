/**
 * "Synthex may create Analytics for me" — the onboarding authority for GA4
 * property creation (kit K2, founder decision 22/10/2026).
 *
 * `analytics.edit` is requested from Google only after the onboarding step
 * shows GA4_ADMIN_CONSENT_STATEMENT and the user accepts it. The step mints a
 * short-lived HMAC consent token bound to the user AND the organisation the
 * statement was accepted for; the OAuth starter adds the scope only for a
 * valid token whose organisation is the one the OAuth flow will store the
 * connection against (acceptance for one client is never authority for
 * another). After Google's consent screen, the callback
 * records the grant (scopes, who, when, statement) in the GA4
 * PlatformConnection metadata — only when Google actually granted the scope.
 * No schema change: the grant lives in PlatformConnection.metadata.
 */

import crypto from 'crypto';

export const GA4_ADMIN_SCOPE = 'https://www.googleapis.com/auth/analytics.edit';
export const GA4_ADMIN_CONSENT_VERSION = 'ga4-admin-v1';
export const GA4_ADMIN_CONSENT_STATEMENT =
  'Synthex may create Analytics for me. With this permission Synthex will, in the Google Analytics account I choose: create one GA4 property for my business (Australian time zone, AUD), create one web data stream for my website (this gives the G- measurement ID for the tracking tag), and mark lead and sign-up events (generate_lead, sign_up) as key events. Synthex will not delete properties or change who has access to my account. I can remove this permission at any time from my Google Account.';

const CONSENT_TTL_MS = 10 * 60 * 1000;

export interface Ga4AdminConsent {
  version: string;
  acceptedAt: string;
}

export type Ga4AdminGrant = {
  scopes: string[];
  grantedByUserId: string;
  grantedByEmail: string | null;
  grantedAt: string;
  consentAcceptedAt: string;
  consentVersion: string;
  consentStatement: string;
};

function secret(): string {
  const s = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!s) {
    throw new Error(
      'OAUTH_STATE_SECRET or JWT_SECRET must be configured for OAuth'
    );
  }
  return s;
}

function hmac(payload: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url');
}

/** Mint the consent token after the user accepted the statement. */
export function signGa4AdminConsent(
  userId: string,
  organizationId: string,
  now: number = Date.now()
): string {
  const payload = Buffer.from(
    JSON.stringify({
      u: userId,
      o: organizationId,
      v: GA4_ADMIN_CONSENT_VERSION,
      t: now,
    })
  ).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

/**
 * Returns the consent when the token is genuine, current, for this user and
 * for this organisation.
 */
export function verifyGa4AdminConsent(
  token: string | null | undefined,
  userId: string,
  organizationId: string | null | undefined,
  now: number = Date.now()
): Ga4AdminConsent | null {
  if (!token || !organizationId) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = Buffer.from(hmac(payload));
  const given = Buffer.from(sig);
  if (
    expected.length !== given.length ||
    !crypto.timingSafeEqual(expected, given)
  ) {
    return null;
  }
  let data: { u?: unknown; o?: unknown; v?: unknown; t?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (data.u !== userId || data.v !== GA4_ADMIN_CONSENT_VERSION) return null;
  if (typeof data.o !== 'string' || data.o !== organizationId) return null;
  if (
    typeof data.t !== 'number' ||
    now - data.t > CONSENT_TTL_MS ||
    data.t - now > 60_000
  ) {
    return null;
  }
  return {
    version: GA4_ADMIN_CONSENT_VERSION,
    acceptedAt: new Date(data.t).toISOString(),
  };
}

function splitScopes(scope: string | null | undefined): string[] {
  return (scope ?? '').split(/[\s,]+/).filter(Boolean);
}

export function hasGa4AdminScope(scope: string | null | undefined): boolean {
  return splitScopes(scope).includes(GA4_ADMIN_SCOPE);
}

/** Append analytics.edit to a space-separated scope list (once). */
export function withGa4AdminScope(scope: string): string {
  return hasGa4AdminScope(scope) ? scope : `${scope} ${GA4_ADMIN_SCOPE}`.trim();
}

/** Remove analytics.edit from a scope list (used when no consent was given). */
export function withoutGa4AdminScope(scope: string): string {
  return splitScopes(scope)
    .filter(s => s !== GA4_ADMIN_SCOPE)
    .join(' ');
}

/**
 * Build the grant record from the consent carried in OAuth state and the scope
 * string Google returned. Null when Google did not grant analytics.edit.
 */
export function buildGa4AdminGrant(input: {
  consent: Ga4AdminConsent;
  grantedScope: string | null | undefined;
  userId: string;
  email: string | null | undefined;
  now?: number;
}): Ga4AdminGrant | null {
  if (!hasGa4AdminScope(input.grantedScope)) return null;
  return {
    scopes: splitScopes(input.grantedScope),
    grantedByUserId: input.userId,
    grantedByEmail: input.email ?? null,
    grantedAt: new Date(input.now ?? Date.now()).toISOString(),
    consentAcceptedAt: input.consent.acceptedAt,
    consentVersion: input.consent.version,
    consentStatement: GA4_ADMIN_CONSENT_STATEMENT,
  };
}

/** The recorded grant, only while the connection still holds analytics.edit. */
export function readGa4AdminGrant(connection: {
  scope: string | null | undefined;
  metadata: unknown;
}): Ga4AdminGrant | null {
  if (!hasGa4AdminScope(connection.scope)) return null;
  const meta = connection.metadata as {
    ga4AdminGrant?: Partial<Ga4AdminGrant>;
  } | null;
  const grant = meta?.ga4AdminGrant;
  if (!grant?.grantedByUserId || !grant.grantedAt || !grant.consentVersion)
    return null;
  return grant as Ga4AdminGrant;
}
