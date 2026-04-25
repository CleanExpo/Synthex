/**
 * Unit tests — POST /api/webhooks/twilio/inbound-call (SYN-802)
 *
 * Covers:
 *   - 401 on missing/invalid signature
 *   - 400 on missing required Twilio params
 *   - 404 on unknown phone number (not in phone_pool)
 *   - 200 happy path (Lead written, empty TwiML returned)
 */

import { createMockNextRequest } from '../../../helpers/mock-request';
import * as twilioSig from '@/lib/auth/twilio-signature';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    phonePool: {
      findFirst: jest.fn(),
    },
    lead: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCheckRateLimit = jest.fn();
const mockExtractClientIp = jest.fn();

jest.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  extractClientIp: (...args: unknown[]) => mockExtractClientIp(...args),
}));

// We test the signature helper separately — stub it here for clarity
jest.mock('@/lib/auth/twilio-signature', () => ({
  verifyTwilioSignature: jest.fn(),
  parseTwilioFormBody: jest.fn(),
}));

type VerifyFn = typeof twilioSig.verifyTwilioSignature;
const mockedVerify = twilioSig.verifyTwilioSignature as jest.MockedFunction<VerifyFn>;
const mockedParse = twilioSig.parseTwilioFormBody as jest.MockedFunction<
  typeof twilioSig.parseTwilioFormBody
>;

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;
    private _headers: Record<string, string>;
    headers: { get: (n: string) => string | null };

    constructor(
      body: string | null,
      init: { status?: number; headers?: Record<string, string> } = {}
    ) {
      this._body = body ?? '';
      this.status = init.status ?? 200;
      this._headers = Object.fromEntries(
        Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      this.headers = {
        get: (n: string) => this._headers[n.toLowerCase()] ?? null,
      };
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    text() {
      return Promise.resolve(this._body);
    }

    static json(body: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(body), init);
    }
  }

  return {
    NextRequest: jest.fn(),
    NextResponse: MockNextResponse,
  };
});

// ── Test helpers ──────────────────────────────────────────────────────────────

const VALID_PARAMS = {
  CallSid: 'CA1234567890',
  From: '+14158675309',
  Called: '+18005551212',
  CallDuration: '42',
  CallStatus: 'completed',
  Direction: 'inbound',
};

function makeRequest(
  params: Record<string, string> = VALID_PARAMS,
  sig = 'valid-sig'
) {
  const body = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return createMockNextRequest({
    method: 'POST',
    body,
    headers: {
      'x-twilio-signature': sig,
      'content-type': 'application/x-www-form-urlencoded',
    },
    url: 'https://synthex.app/api/webhooks/twilio/inbound-call',
  });
}

// ── Import under test (after mocks are set up) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/webhooks/twilio/inbound-call/route');

import prisma from '@/lib/prisma';
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
  mockedParse.mockReturnValue(VALID_PARAMS);
  mockCheckRateLimit.mockResolvedValue({ ok: true });
  mockExtractClientIp.mockReturnValue('127.0.0.1');
});

describe('POST /api/webhooks/twilio/inbound-call', () => {
  describe('401 — invalid signature', () => {
    it('returns 401 when signature verification fails', async () => {
      mockedVerify.mockReturnValue(false);
      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when signature header is missing', async () => {
      mockedVerify.mockReturnValue(false);
      const req = createMockNextRequest({
        method: 'POST',
        body: 'CallSid=CA123',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe('400 — bad payload', () => {
    it('returns 400 when CallSid is missing', async () => {
      mockedVerify.mockReturnValue(true);
      mockedParse.mockReturnValue({ From: '+14158675309', Called: '+18005551212' });
      const res = await POST(makeRequest());
      expect(res.status).toBe(400);
    });

    it('returns 400 when From is missing', async () => {
      mockedVerify.mockReturnValue(true);
      mockedParse.mockReturnValue({ CallSid: 'CA123', Called: '+18005551212' });
      const res = await POST(makeRequest());
      expect(res.status).toBe(400);
    });

    it('returns 400 when Called is missing', async () => {
      mockedVerify.mockReturnValue(true);
      mockedParse.mockReturnValue({ CallSid: 'CA123', From: '+14158675309' });
      const res = await POST(makeRequest());
      expect(res.status).toBe(400);
    });
  });

  describe('404 — unknown phone number', () => {
    it('returns 404 when number is not in phone_pool', async () => {
      mockedVerify.mockReturnValue(true);
      mockedParse.mockReturnValue(VALID_PARAMS);
      (mockPrisma.phonePool.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await POST(makeRequest());
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Unknown number');
    });
  });

  describe('200 — happy path', () => {
    it('creates a Lead and returns empty TwiML', async () => {
      mockedVerify.mockReturnValue(true);
      mockedParse.mockReturnValue(VALID_PARAMS);
      (mockPrisma.phonePool.findFirst as jest.Mock).mockResolvedValue({
        organizationId: 'org_abc123',
      });
      (mockPrisma.lead.create as jest.Mock).mockResolvedValue({ id: 'lead_1' });

      const res = await POST(makeRequest());
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('<Response/>');

      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org_abc123',
            contactMethod: 'phone_call',
            capturedFrom: 'twilio_inbound_webhook',
          }),
        })
      );
    });
  });
});
