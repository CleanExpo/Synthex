/**
 * __tests__/security/journey-hmac.test.ts
 *
 * Cross-tenant write protection for /api/journey/{click,pulse,pulse-confirm}.
 *
 * Before this PR these three routes accepted `?client_id=&moment_id=&score=`
 * UNAUTHENTICATED and used them directly in service-role .eq() filters,
 * letting any caller flip another tenant's client_journey_events rows.
 *
 * After this PR the routes accept `?t=<base64url(payload).base64url(sig)>`
 * only (unless `JOURNEY_PIXEL_ACCEPT_UNSIGNED=true` is set as a temporary
 * grace flag). This file tests the helper at lib/journey/pixel-token.ts —
 * the cryptographic primitive that protects all three routes.
 */

// `server-only` is a runtime sentinel in production; mock it for Jest.
jest.mock('server-only', () => ({}));

import {
  PIXEL_AUDIENCES,
  signJourneyToken,
  verifyJourneyToken,
} from '@/lib/journey/pixel-token';

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OLD_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('journey pixel token — sign + verify', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = VALID_KEY;
    delete process.env.JOURNEY_PIXEL_SIGNING_KEY_SECONDARY;
    delete process.env.JOURNEY_PIXEL_TTL_DAYS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('happy path', () => {
    it('signs and verifies a pulse token with score', () => {
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 4,
      });
      const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.cid).toBe('org_a');
        expect(result.payload.mid).toBe('moment_1');
        expect(result.payload.s).toBe(4);
        expect(result.payload.aud).toBe(PIXEL_AUDIENCES.pulse);
      }
    });

    it('signs and verifies a click token with redirect URL', () => {
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.click,
        clientId: 'org_a',
        momentId: 'moment_2',
        url: 'https://example.com/dashboard',
      });
      const result = verifyJourneyToken(token, PIXEL_AUDIENCES.click);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.u).toBe('https://example.com/dashboard');
      }
    });
  });

  describe('forgery resistance', () => {
    it('rejects a token signed with a different key (bad-signature)', () => {
      // Sign with one key, verify with another
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
      });
      process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = OLD_KEY;
      const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('bad-signature');
    });

    it('rejects a tampered payload (changed score)', () => {
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
      });
      // Decode payload, mutate score, re-encode, keep original signature
      const [encodedPayload, sig] = token.split('.');
      const payloadBytes = Buffer.from(
        encodedPayload.replace(/-/g, '+').replace(/_/g, '/') +
          '='.repeat((4 - (encodedPayload.length % 4)) % 4),
        'base64'
      );
      const payload = JSON.parse(payloadBytes.toString('utf8'));
      payload.s = 5; // tamper
      const tampered = Buffer.from(JSON.stringify(payload), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const tamperedToken = `${tampered}.${sig}`;
      const result = verifyJourneyToken(tamperedToken, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('bad-signature');
    });

    it('rejects a tampered client_id', () => {
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
      });
      const [encodedPayload, sig] = token.split('.');
      const payloadBytes = Buffer.from(
        encodedPayload.replace(/-/g, '+').replace(/_/g, '/') +
          '='.repeat((4 - (encodedPayload.length % 4)) % 4),
        'base64'
      );
      const payload = JSON.parse(payloadBytes.toString('utf8'));
      payload.cid = 'org_b'; // cross-tenant attempt
      const tampered = Buffer.from(JSON.stringify(payload), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const tamperedToken = `${tampered}.${sig}`;
      const result = verifyJourneyToken(tamperedToken, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('bad-signature');
    });
  });

  describe('cross-route replay', () => {
    it('rejects a click token presented at the pulse route (aud-mismatch)', () => {
      const clickToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.click,
        clientId: 'org_a',
        momentId: 'moment_1',
        url: 'https://example.com/x',
      });
      const result = verifyJourneyToken(clickToken, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('aud-mismatch');
    });

    it('rejects a pulse token presented at the pulse-confirm route', () => {
      const pulseToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 3,
      });
      const result = verifyJourneyToken(
        pulseToken,
        PIXEL_AUDIENCES.pulseConfirm
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('aud-mismatch');
    });
  });

  describe('expiry', () => {
    it('rejects an expired token', () => {
      // Sign with a 1-second TTL, then advance the clock past it
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
        ttlSeconds: 1,
        nowMs: 1_000_000_000_000,
      });
      const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse, {
        nowMs: 1_000_000_000_000 + 2000, // +2s
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('expired');
    });

    it('accepts a token within TTL', () => {
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
        ttlSeconds: 60,
        nowMs: 1_000_000_000_000,
      });
      const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse, {
        nowMs: 1_000_000_000_000 + 30_000, // +30s
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('malformed input', () => {
    it('returns missing-token for null', () => {
      const result = verifyJourneyToken(null, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('missing-token');
    });

    it('returns malformed-token for a string without a dot', () => {
      const result = verifyJourneyToken('not-a-token', PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('malformed-token');
    });

    it('returns malformed-token for a dot at the start', () => {
      const result = verifyJourneyToken('.justsig', PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('malformed-token');
    });
  });

  describe('rotation', () => {
    it('accepts a token signed under SECONDARY key', () => {
      // Sign under OLD_KEY (which will become SECONDARY)
      process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = OLD_KEY;
      const oldToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
      });
      // Rotate: PRIMARY = new, SECONDARY = old
      process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = VALID_KEY;
      process.env.JOURNEY_PIXEL_SIGNING_KEY_SECONDARY = OLD_KEY;
      const result = verifyJourneyToken(oldToken, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(true);
    });

    it('rejects when neither PRIMARY nor SECONDARY matches', () => {
      process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = OLD_KEY;
      const oldToken = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
      });
      process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = VALID_KEY;
      process.env.JOURNEY_PIXEL_SIGNING_KEY_SECONDARY = 'something-else';
      const result = verifyJourneyToken(oldToken, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('bad-signature');
    });
  });

  describe('config errors', () => {
    it('throws on sign when PRIMARY key is missing', () => {
      delete process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY;
      expect(() =>
        signJourneyToken({
          aud: PIXEL_AUDIENCES.pulse,
          clientId: 'org_a',
          momentId: 'moment_1',
          score: 1,
        })
      ).toThrow(/JOURNEY_PIXEL_SIGNING_KEY_PRIMARY/);
    });

    it('returns config-missing on verify when PRIMARY key is missing', () => {
      // First produce a real token while key is set
      const token = signJourneyToken({
        aud: PIXEL_AUDIENCES.pulse,
        clientId: 'org_a',
        momentId: 'moment_1',
        score: 1,
      });
      // Then strip the key
      delete process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY;
      const result = verifyJourneyToken(token, PIXEL_AUDIENCES.pulse);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('config-missing');
    });
  });
});
