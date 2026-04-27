/**
 * Unit tests — webhook challenge verification — SYN-700
 *
 * Regression coverage for:
 *   - LinkedIn challenge must be HMAC-SHA256 signed, not reflected verbatim
 *   - Pinterest challenge must be gated by verify_token, not blindly reflected
 *   - Both endpoints must return 500 when their secret is missing (fail-closed)
 */

import crypto from 'crypto';

import { GET } from '@/app/api/webhooks/[platform]/route';

type RouteContext = Parameters<typeof GET>[1];

function buildRequest(url: string) {
  const u = new URL(url);
  return {
    url: u.toString(),
    nextUrl: u,
  } as unknown as Parameters<typeof GET>[0];
}

function buildContext(platform: string): RouteContext {
  return { params: Promise.resolve({ platform }) } as unknown as RouteContext;
}

describe('SYN-700 — webhook challenge verification', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('LinkedIn', () => {
    it('HMAC-signs the challengeCode — not reflected verbatim', async () => {
      process.env.LINKEDIN_WEBHOOK_SECRET = 'test-secret-abc';
      const challengeCode = 'linkedin-challenge-xyz';

      const res = await GET(
        buildRequest(
          `https://synthex.social/api/webhooks/linkedin?challengeCode=${challengeCode}`
        ),
        buildContext('linkedin')
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        challengeCode: string;
        challengeResponse: string;
      };
      expect(body.challengeCode).toBe(challengeCode);

      const expected = crypto
        .createHmac('sha256', 'test-secret-abc')
        .update(challengeCode)
        .digest('hex');
      expect(body.challengeResponse).toBe(expected);
    });

    it('returns 500 when LINKEDIN_WEBHOOK_SECRET missing — fails closed', async () => {
      delete process.env.LINKEDIN_WEBHOOK_SECRET;

      const res = await GET(
        buildRequest(
          'https://synthex.social/api/webhooks/linkedin?challengeCode=x'
        ),
        buildContext('linkedin')
      );

      expect(res.status).toBe(500);
    });
  });

  describe('Pinterest', () => {
    it('rejects missing verify_token with 403', async () => {
      process.env.PINTEREST_WEBHOOK_SECRET = 'pin-token-123';

      const res = await GET(
        buildRequest(
          'https://synthex.social/api/webhooks/pinterest?challenge=hello'
        ),
        buildContext('pinterest')
      );

      expect(res.status).toBe(403);
    });

    it('rejects wrong verify_token with 403', async () => {
      process.env.PINTEREST_WEBHOOK_SECRET = 'pin-token-123';

      const res = await GET(
        buildRequest(
          'https://synthex.social/api/webhooks/pinterest?challenge=hello&verify_token=wrong'
        ),
        buildContext('pinterest')
      );

      expect(res.status).toBe(403);
    });

    it('echoes challenge when verify_token matches', async () => {
      process.env.PINTEREST_WEBHOOK_SECRET = 'pin-token-123';

      const res = await GET(
        buildRequest(
          'https://synthex.social/api/webhooks/pinterest?challenge=hello&verify_token=pin-token-123'
        ),
        buildContext('pinterest')
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('hello');
    });

    it('returns 500 when PINTEREST_WEBHOOK_SECRET missing', async () => {
      delete process.env.PINTEREST_WEBHOOK_SECRET;

      const res = await GET(
        buildRequest(
          'https://synthex.social/api/webhooks/pinterest?challenge=x&verify_token=y'
        ),
        buildContext('pinterest')
      );

      expect(res.status).toBe(500);
    });
  });
});
