/**
 * Unit tests for lib/webhooks/signature-verifier.ts
 *
 * Tests SignatureVerifier class — all logic is pure crypto (node:crypto) with
 * no DB or network dependencies.
 *
 * Strategy: generate the expected HMAC ourselves, then feed it to the verifier
 * so we test the real signing logic rather than hard-coded expected values.
 */

import { createHmac } from 'crypto';
import SignatureVerifier from '@/lib/webhooks/signature-verifier';

// Mock logger to suppress console noise
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function hmacHex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function hmacBase64(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64');
}

function validStripeTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function freshTikTokTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

// ── Test setup ───────────────────────────────────────────────────────────────

const SECRET = 'test-webhook-secret-1234';
const PAYLOAD = '{"event":"test","data":"hello"}';

describe('SignatureVerifier', () => {
  let verifier: SignatureVerifier;

  beforeEach(() => {
    // Inject secrets via env before constructing verifier
    process.env.TWITTER_WEBHOOK_SECRET = SECRET;
    process.env.META_WEBHOOK_SECRET = SECRET;
    process.env.TIKTOK_WEBHOOK_SECRET = SECRET;
    process.env.LINKEDIN_WEBHOOK_SECRET = SECRET;
    process.env.PINTEREST_WEBHOOK_SECRET = SECRET;
    process.env.GOOGLE_WEBHOOK_SECRET = SECRET;
    process.env.REDDIT_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.INTERNAL_WEBHOOK_SECRET = SECRET;

    verifier = new SignatureVerifier();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Missing secret ────────────────────────────────────────────────────────
  describe('when secret is not configured', () => {
    it('returns valid=false with an error message', () => {
      // Build verifier without env vars for a known platform
      delete process.env.TWITTER_WEBHOOK_SECRET;
      const v = new SignatureVerifier();

      const result = v.verify('twitter', PAYLOAD, 'any-sig');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not configured/i);
    });

    it('returns valid=false for unknown platform', () => {
      const result = verifier.verify(
        'unknown' as 'twitter',
        PAYLOAD,
        'any-sig'
      );
      expect(result.valid).toBe(false);
    });
  });

  // ── Twitter (HMAC-SHA256 base64 with sha256= prefix) ─────────────────────
  describe('Twitter verification', () => {
    it('accepts a valid Twitter signature', () => {
      const expectedSig = 'sha256=' + hmacBase64(SECRET, PAYLOAD);
      const result = verifier.verify('twitter', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const result = verifier.verify('twitter', PAYLOAD, 'sha256=invalidsig');
      expect(result.valid).toBe(false);
    });

    it('rejects wrong secret', () => {
      const wrongSig = 'sha256=' + hmacBase64('wrong-secret', PAYLOAD);
      const result = verifier.verify('twitter', PAYLOAD, wrongSig);
      expect(result.valid).toBe(false);
    });
  });

  // ── Meta (Facebook/Instagram/Threads) — hex with sha256= prefix ─────────
  describe('Meta verification (facebook, instagram, threads)', () => {
    it('accepts a valid Facebook signature', () => {
      const expectedSig = 'sha256=' + hmacHex(SECRET, PAYLOAD);
      const result = verifier.verify('facebook', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });

    it('accepts a valid Instagram signature', () => {
      const expectedSig = 'sha256=' + hmacHex(SECRET, PAYLOAD);
      const result = verifier.verify('instagram', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });

    it('accepts a valid Threads signature', () => {
      const expectedSig = 'sha256=' + hmacHex(SECRET, PAYLOAD);
      const result = verifier.verify('threads', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid Facebook signature', () => {
      const result = verifier.verify('facebook', PAYLOAD, 'sha256=garbage');
      expect(result.valid).toBe(false);
    });
  });

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  describe('LinkedIn verification', () => {
    it('accepts a valid LinkedIn signature', () => {
      const expectedSig = hmacHex(SECRET, PAYLOAD);
      const result = verifier.verify('linkedin', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });

    it('rejects an invalid LinkedIn signature', () => {
      const result = verifier.verify('linkedin', PAYLOAD, 'badsig');
      expect(result.valid).toBe(false);
    });
  });

  // ── Pinterest ─────────────────────────────────────────────────────────────
  describe('Pinterest verification', () => {
    it('accepts a valid Pinterest signature', () => {
      const expectedSig = hmacHex(SECRET, PAYLOAD);
      const result = verifier.verify('pinterest', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });
  });

  // ── YouTube/Google ────────────────────────────────────────────────────────
  describe('YouTube/Google verification', () => {
    it('accepts a valid Google signature', () => {
      const expectedSig = hmacBase64(SECRET, PAYLOAD);
      const result = verifier.verify('youtube', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });
  });

  // ── Reddit ────────────────────────────────────────────────────────────────
  describe('Reddit verification', () => {
    it('accepts a valid Reddit signature', () => {
      const expectedSig = hmacHex(SECRET, PAYLOAD);
      const result = verifier.verify('reddit', PAYLOAD, expectedSig);
      expect(result.valid).toBe(true);
    });
  });

  // ── TikTok ────────────────────────────────────────────────────────────────
  describe('TikTok verification', () => {
    it('accepts a valid TikTok signature with fresh timestamp', () => {
      const ts = freshTikTokTimestamp();
      const signedPayload = `${ts}.${PAYLOAD}`;
      const expectedSig = hmacHex(SECRET, signedPayload);
      const result = verifier.verify('tiktok', PAYLOAD, expectedSig, ts);
      expect(result.valid).toBe(true);
    });

    it('rejects when timestamp is missing', () => {
      const result = verifier.verify('tiktok', PAYLOAD, 'anysig', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/timestamp/i);
    });

    it('rejects an expired TikTok timestamp (> 5 minutes old)', () => {
      const oldTs = (Math.floor(Date.now() / 1000) - 400).toString(); // 400s ago
      const signedPayload = `${oldTs}.${PAYLOAD}`;
      const sig = hmacHex(SECRET, signedPayload);
      const result = verifier.verify('tiktok', PAYLOAD, sig, oldTs);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/old/i);
    });
  });

  // ── Stripe ────────────────────────────────────────────────────────────────
  describe('Stripe verification', () => {
    it('accepts a valid Stripe signature header', () => {
      const ts = validStripeTimestamp();
      const signedPayload = `${ts}.${PAYLOAD}`;
      const v1 = hmacHex(SECRET, signedPayload);
      const stripeHeader = `t=${ts},v1=${v1}`;

      const result = verifier.verify('stripe', PAYLOAD, stripeHeader);
      expect(result.valid).toBe(true);
    });

    it('rejects when the Stripe header is missing t= or v1=', () => {
      const result = verifier.verify('stripe', PAYLOAD, 'garbage');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid Stripe signature format/i);
    });

    it('rejects an expired Stripe timestamp', () => {
      const oldTs = (Math.floor(Date.now() / 1000) - 400).toString();
      const signedPayload = `${oldTs}.${PAYLOAD}`;
      const v1 = hmacHex(SECRET, signedPayload);
      const result = verifier.verify('stripe', PAYLOAD, `t=${oldTs},v1=${v1}`);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/old/i);
    });

    it('rejects a valid-format but wrong-secret Stripe signature', () => {
      const ts = validStripeTimestamp();
      const v1 = hmacHex('wrong-secret', `${ts}.${PAYLOAD}`);
      const result = verifier.verify('stripe', PAYLOAD, `t=${ts},v1=${v1}`);
      expect(result.valid).toBe(false);
    });
  });

  // ── Internal ─────────────────────────────────────────────────────────────
  describe('Internal webhook verification', () => {
    it('accepts a valid internal signature with fresh timestamp', () => {
      const ts = Date.now().toString();
      const signedPayload = `${ts}.${PAYLOAD}`;
      const sig = hmacHex(SECRET, signedPayload);
      const result = verifier.verify('internal', PAYLOAD, sig, ts);
      expect(result.valid).toBe(true);
    });

    it('rejects when timestamp is missing', () => {
      const result = verifier.verify('internal', PAYLOAD, 'anysig', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/timestamp/i);
    });

    it('rejects an expired internal timestamp', () => {
      const oldTs = (Date.now() - 400_000).toString(); // 400s ago
      const signedPayload = `${oldTs}.${PAYLOAD}`;
      const sig = hmacHex(SECRET, signedPayload);
      const result = verifier.verify('internal', PAYLOAD, sig, oldTs);
      expect(result.valid).toBe(false);
    });
  });

  // ── generateSignature ─────────────────────────────────────────────────────
  describe('generateSignature', () => {
    it('generates a hex signature', () => {
      const { signature, timestamp } = verifier.generateSignature(
        PAYLOAD,
        SECRET
      );
      expect(typeof signature).toBe('string');
      expect(signature).toHaveLength(64); // SHA-256 hex is 64 chars
      expect(typeof timestamp).toBe('number');
    });

    it('uses provided timestamp when supplied', () => {
      const ts = 1700000000000;
      const { timestamp } = verifier.generateSignature(PAYLOAD, SECRET, ts);
      expect(timestamp).toBe(ts);
    });

    it('produces a signature that can be verified by verifyInternal logic', () => {
      const ts = Date.now();
      const signedPayload = `${ts}.${PAYLOAD}`;
      const expected = hmacHex(SECRET, signedPayload);
      const { signature } = verifier.generateSignature(PAYLOAD, SECRET, ts);
      expect(signature).toBe(expected);
    });
  });
});
