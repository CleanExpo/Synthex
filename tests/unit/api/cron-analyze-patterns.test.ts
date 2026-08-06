import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

import { GET, POST } from '@/app/api/cron/analyze-patterns/route';
import { NextResponse } from 'next/server';

function request(method: 'GET' | 'POST') {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/analyze-patterns',
    method,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
});

describe('/api/cron/analyze-patterns', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)(
    '%s fails closed while platform scraping is unavailable',
    async (method, handler) => {
      const response = await handler(request(method));

      expect(mockVerifyCron).toHaveBeenCalledWith(
        expect.anything(),
        'ANALYZE_PATTERNS'
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error:
          'Pattern analysis is unavailable until platform integrations are configured.',
      });
    }
  );

  it('rejects unauthorised requests before returning the availability state', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const response = await POST(request('POST'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorised' });
  });
});
