/**
 * Behavioural coverage for churn-scorer cron + internal routes — AT-023.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockRunChurnScoring = jest.fn();
jest.mock('@/lib/retention/churn-scorer', () => ({
  runChurnScoring: (...args: unknown[]) => mockRunChurnScoring(...args),
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/churn-scorer/route';
import { POST } from '@/app/api/internal/churn-scorer/route';
import { NextResponse } from 'next/server';

const scoringPayload = {
  processed: 2,
  scored: 2,
  insufficientData: 0,
  byTier: { low: 1, medium: 0, high: 0, critical: 1 },
  scores: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockRunChurnScoring.mockResolvedValue(scoringPayload);
});

describe('GET /api/cron/churn-scorer', () => {
  it('returns 401 and never scores for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await GET(
      createMockNextRequest({ url: 'http://localhost/api/cron/churn-scorer' })
    );

    expect(res.status).toBe(401);
    expect(mockRunChurnScoring).not.toHaveBeenCalled();
  });

  it('runs nightly scoring for all organisations', async () => {
    const res = await GET(
      createMockNextRequest({ url: 'http://localhost/api/cron/churn-scorer' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockVerifyCron).toHaveBeenCalledWith(
      expect.anything(),
      'CHURN_SCORER'
    );
    expect(mockRunChurnScoring).toHaveBeenCalledWith('all_organizations');
    expect(body.success).toBe(true);
    expect(body.processed).toBe(2);
  });
});

describe('POST /api/internal/churn-scorer', () => {
  it('returns 401 for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/internal/churn-scorer',
        body: { trigger: 'cron', scope: 'all_organizations' },
      })
    );

    expect(res.status).toBe(401);
    expect(mockRunChurnScoring).not.toHaveBeenCalled();
  });

  it('accepts legacy edge-function payload and returns scoring summary', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/internal/churn-scorer',
        body: { trigger: 'cron', scope: 'all_organizations' },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockVerifyCron).toHaveBeenCalledWith(
      expect.anything(),
      'CHURN_SCORER'
    );
    expect(mockRunChurnScoring).toHaveBeenCalledWith('all_organizations');
    expect(body.ok).toBe(true);
    expect(body.trigger).toBe('cron');
    expect(body.scope).toBe('all_organizations');
    expect(body.scored).toBe(2);
  });
});
