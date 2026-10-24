/**
 * K2 — "Synthex may create Analytics for me" consent and grant record.
 *
 * SEAM: exported functions of lib/google/ga4-admin-consent.ts.
 * CATCHES: a consent token usable by another user, for another organisation,
 * after expiry or after tampering; a grant recorded when Google did not actually grant
 * analytics.edit (granular consent lets the user untick it); an authority
 * check that passes on scope alone or metadata alone.
 * MISSES: the OAuth starter wiring (ga4-admin-consent-oauth test) and the
 * provision route (ga4-provision test).
 */

import crypto from 'crypto';
import {
  GA4_ADMIN_SCOPE,
  GA4_ADMIN_CONSENT_VERSION,
  GA4_ADMIN_CONSENT_STATEMENT,
  signGa4AdminConsent,
  verifyGa4AdminConsent,
  withGa4AdminScope,
  buildGa4AdminGrant,
  readGa4AdminGrant,
} from '@/lib/google/ga4-admin-consent';

const NOW = Date.UTC(2026, 9, 22, 5, 0, 0);

beforeAll(() => {
  process.env.OAUTH_STATE_SECRET = 'test-state-secret';
});

describe('consent statement', () => {
  it('states what Synthex will create', () => {
    expect(GA4_ADMIN_CONSENT_STATEMENT).toMatch(
      /Synthex may create Analytics for me/
    );
    expect(GA4_ADMIN_CONSENT_STATEMENT).toMatch(/property/);
    expect(GA4_ADMIN_CONSENT_STATEMENT).toMatch(/web data stream/);
    expect(GA4_ADMIN_CONSENT_STATEMENT).toMatch(/generate_lead/);
    expect(GA4_ADMIN_SCOPE).toBe(
      'https://www.googleapis.com/auth/analytics.edit'
    );
  });
});

describe('consent token', () => {
  it('verifies for the same user inside the window', () => {
    const token = signGa4AdminConsent('user-1', 'org-1', NOW);
    expect(
      verifyGa4AdminConsent(token, 'user-1', 'org-1', NOW + 60_000)
    ).toEqual({
      version: GA4_ADMIN_CONSENT_VERSION,
      acceptedAt: new Date(NOW).toISOString(),
    });
  });

  it('rejects another user, an expired token and a tampered token', () => {
    const token = signGa4AdminConsent('user-1', 'org-1', NOW);
    expect(verifyGa4AdminConsent(token, 'user-2', 'org-1', NOW)).toBeNull();
    expect(
      verifyGa4AdminConsent(token, 'user-1', 'org-1', NOW + 11 * 60_000)
    ).toBeNull();
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        u: 'user-2',
        o: 'org-1',
        v: GA4_ADMIN_CONSENT_VERSION,
        t: NOW,
      })
    ).toString('base64url');
    expect(
      verifyGa4AdminConsent(`${forged}.${sig}`, 'user-2', 'org-1', NOW)
    ).toBeNull();
    expect(
      verifyGa4AdminConsent(`${payload}.x${sig}`, 'user-1', 'org-1', NOW)
    ).toBeNull();
    expect(verifyGa4AdminConsent('', 'user-1', 'org-1', NOW)).toBeNull();
  });

  it('rejects another organisation, a missing organisation and a token signed without one', () => {
    const token = signGa4AdminConsent('user-1', 'org-1', NOW);
    expect(verifyGa4AdminConsent(token, 'user-1', 'org-2', NOW)).toBeNull();
    expect(verifyGa4AdminConsent(token, 'user-1', null, NOW)).toBeNull();
    expect(verifyGa4AdminConsent(token, 'user-1', '', NOW)).toBeNull();
    // A pre-binding token shape (no organisation), correctly signed, is refused.
    const legacy = Buffer.from(
      JSON.stringify({ u: 'user-1', v: GA4_ADMIN_CONSENT_VERSION, t: NOW })
    ).toString('base64url');
    const legacySig = crypto
      .createHmac('sha256', process.env.OAUTH_STATE_SECRET as string)
      .update('ga4-admin-consent:v1:' + legacy)
      .digest('base64url');
    expect(
      verifyGa4AdminConsent(`${legacy}.${legacySig}`, 'user-1', 'org-1', NOW)
    ).toBeNull();
  });

  it('is domain-separated from OAuth state: a consent token is not a valid OAuth state signature, and an OAuth-state-style signature is not a valid consent', () => {
    const secret = process.env.OAUTH_STATE_SECRET as string;
    const stateSig = (payload: string) =>
      crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const token = signGa4AdminConsent('user-1', 'org-1', NOW);
    const [payload, sig] = token.split('.');
    // The callback verifies state as HMAC(secret, payload): the consent
    // token's signature must not match it.
    expect(sig).not.toBe(stateSig(payload));
    // And a payload signed the OAuth-state way is not accepted as consent.
    expect(
      verifyGa4AdminConsent(
        `${payload}.${stateSig(payload)}`,
        'user-1',
        'org-1',
        NOW
      )
    ).toBeNull();
  });
});

describe('withGa4AdminScope', () => {
  it('adds analytics.edit once, keeping existing scopes', () => {
    const base =
      'https://www.googleapis.com/auth/analytics.readonly profile email';
    expect(withGa4AdminScope(base)).toBe(`${base} ${GA4_ADMIN_SCOPE}`);
    expect(withGa4AdminScope(withGa4AdminScope(base))).toBe(
      `${base} ${GA4_ADMIN_SCOPE}`
    );
  });
});

describe('grant record', () => {
  const consent = {
    version: GA4_ADMIN_CONSENT_VERSION,
    acceptedAt: new Date(NOW).toISOString(),
  };

  it('records scopes, who granted and when when Google granted analytics.edit', () => {
    const grant = buildGa4AdminGrant({
      consent,
      grantedScope: `https://www.googleapis.com/auth/analytics.readonly ${GA4_ADMIN_SCOPE}`,
      userId: 'user-1',
      email: 'owner@example.com',
      now: NOW + 5_000,
    });
    expect(grant).toEqual({
      scopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        GA4_ADMIN_SCOPE,
      ],
      grantedByUserId: 'user-1',
      grantedByEmail: 'owner@example.com',
      grantedAt: new Date(NOW + 5_000).toISOString(),
      consentAcceptedAt: consent.acceptedAt,
      consentVersion: GA4_ADMIN_CONSENT_VERSION,
      consentStatement: GA4_ADMIN_CONSENT_STATEMENT,
    });
  });

  it('records nothing when the user unticked analytics.edit at Google', () => {
    expect(
      buildGa4AdminGrant({
        consent,
        grantedScope: 'https://www.googleapis.com/auth/analytics.readonly',
        userId: 'user-1',
        email: null,
        now: NOW,
      })
    ).toBeNull();
  });

  it('authority needs both the granted scope and the recorded grant', () => {
    const grant = buildGa4AdminGrant({
      consent,
      grantedScope: GA4_ADMIN_SCOPE,
      userId: 'user-1',
      email: null,
      now: NOW,
    });
    expect(
      readGa4AdminGrant({
        scope: GA4_ADMIN_SCOPE,
        metadata: { ga4AdminGrant: grant },
      })
    ).toEqual(grant);
    expect(
      readGa4AdminGrant({ scope: GA4_ADMIN_SCOPE, metadata: {} })
    ).toBeNull();
    expect(
      readGa4AdminGrant({
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        metadata: { ga4AdminGrant: grant },
      })
    ).toBeNull();
    expect(readGa4AdminGrant({ scope: null, metadata: null })).toBeNull();
  });
});
