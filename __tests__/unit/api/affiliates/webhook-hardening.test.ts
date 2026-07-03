/**
 * Unit tests — affiliate conversion webhook hardening
 *
 * Money-integrity regression coverage for the affiliate conversion webhook:
 *   1. Fail CLOSED when AFFILIATE_WEBHOOK_SECRET is unset (no unsigned writes)
 *   2. Reject bad / missing signatures when the secret IS configured
 *   3. Reject out-of-bound / non-finite revenue
 *   4. Record a valid signed conversion exactly once
 *
 * The route's service sink (AffiliateLinkService) is mocked here; the
 * idempotency of the underlying revenue increment is covered separately in
 * tests/unit/services/affiliate-record-conversion.test.ts.
 */

import crypto from 'crypto';

import { POST } from '@/app/api/affiliates/webhook/route';
import { AffiliateLinkService } from '@/lib/affiliates/affiliate-link-service';

jest.mock('@/lib/affiliates/affiliate-link-service', () => ({
  AffiliateLinkService: {
    getLinkByShortCode: jest.fn(),
    recordConversion: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedService = AffiliateLinkService as jest.Mocked<
  typeof AffiliateLinkService
>;

const SECRET = 'aff-test-secret';

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function buildRequest(body: object, signature?: string) {
  const raw = JSON.stringify(body);
  const headers = new Map<string, string>();
  if (signature !== undefined) headers.set('x-webhook-signature', signature);
  return {
    text: async () => raw,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
  } as unknown as Parameters<typeof POST>[0];
}

describe('affiliate conversion webhook — hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.getLinkByShortCode.mockResolvedValue({
      id: 'link_abc',
    } as never);
    mockedService.recordConversion.mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('FAILS CLOSED when AFFILIATE_WEBHOOK_SECRET is unset — rejects, does not record', async () => {
    delete process.env.AFFILIATE_WEBHOOK_SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: 10 };

    const res = await POST(
      buildRequest(body, sign(JSON.stringify(body), SECRET))
    );

    expect(res.status).toBe(401);
    expect(mockedService.recordConversion).not.toHaveBeenCalled();
  });

  it('rejects a bad signature when the secret IS configured', async () => {
    process.env.AFFILIATE_WEBHOOK_SECRET = SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: 10 };

    const res = await POST(buildRequest(body, 'deadbeef-not-the-signature'));

    expect(res.status).toBe(401);
    expect(mockedService.recordConversion).not.toHaveBeenCalled();
  });

  it('rejects a missing signature when the secret IS configured', async () => {
    process.env.AFFILIATE_WEBHOOK_SECRET = SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: 10 };

    const res = await POST(buildRequest(body)); // no signature header

    expect(res.status).toBe(401);
    expect(mockedService.recordConversion).not.toHaveBeenCalled();
  });

  it('records a valid signed conversion exactly once', async () => {
    process.env.AFFILIATE_WEBHOOK_SECRET = SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: 42.5 };
    const raw = JSON.stringify(body);

    const res = await POST(buildRequest(body, sign(raw, SECRET)));

    expect(res.status).toBe(200);
    expect(mockedService.recordConversion).toHaveBeenCalledTimes(1);
    expect(mockedService.recordConversion).toHaveBeenCalledWith('link_abc', {
      orderId: 'o1',
      revenue: 42.5,
    });
  });

  it('rejects out-of-bound revenue (above MAX_CONVERSION_REVENUE)', async () => {
    process.env.AFFILIATE_WEBHOOK_SECRET = SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: 5_000_000 };
    const raw = JSON.stringify(body);

    const res = await POST(buildRequest(body, sign(raw, SECRET)));

    expect(res.status).toBe(400);
    expect(mockedService.recordConversion).not.toHaveBeenCalled();
  });

  it('rejects non-finite / NaN revenue', async () => {
    process.env.AFFILIATE_WEBHOOK_SECRET = SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: 'not-a-number' };
    const raw = JSON.stringify(body);

    const res = await POST(buildRequest(body, sign(raw, SECRET)));

    expect(res.status).toBe(400);
    expect(mockedService.recordConversion).not.toHaveBeenCalled();
  });

  it('rejects negative revenue', async () => {
    process.env.AFFILIATE_WEBHOOK_SECRET = SECRET;
    const body = { linkId: 'abc', orderId: 'o1', revenue: -1 };
    const raw = JSON.stringify(body);

    const res = await POST(buildRequest(body, sign(raw, SECRET)));

    expect(res.status).toBe(400);
    expect(mockedService.recordConversion).not.toHaveBeenCalled();
  });
});
