/**
 * P2 u04 — routes retired from lib/platform/noop-client.
 *
 * Their tables have no Prisma model, so each must say so honestly:
 *   - cron routes: 501 FEATURE_NOT_PROVISIONED after auth (401 stays first);
 *   - refresh-journey-analytics also records the failed run via
 *     prisma.edgeFunctionLog (the one ported write);
 *   - journey pixel / confirm page: 501, identical for valid and invalid tokens;
 *   - journey click: still redirects, flagged X-Journey-Tracking.
 */

jest.mock('server-only', () => ({}));

const mockEdgeFunctionLogCreate = jest.fn();
const mockPrisma = { edgeFunctionLog: { create: mockEdgeFunctionLogCreate } };
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { NextResponse } from 'next/server';
import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { PIXEL_AUDIENCES, signJourneyToken } from '@/lib/journey/pixel-token';
import { POST as generateEffectReports } from '@/app/api/internal/generate-effect-reports/route';
import { POST as refreshJourneyAnalytics } from '@/app/api/internal/refresh-journey-analytics/route';
import { POST as scoreAccuracyMatcher } from '@/app/api/internal/score-accuracy-matcher/route';
import { GET as journeyClick } from '@/app/api/journey/click/route';
import { GET as journeyPulse } from '@/app/api/journey/pulse/route';
import { GET as journeyPulseConfirm } from '@/app/api/journey/pulse-confirm/route';

const SIGNING_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function cronReq(path: string) {
  return createMockNextRequest({
    method: 'POST',
    url: `http://localhost/api/internal/${path}`,
  }) as never;
}

function pixelReq(url: string) {
  return { nextUrl: { searchParams: new URL(url).searchParams } } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'per-route' });
  mockEdgeFunctionLogCreate.mockResolvedValue({ id: 'log-1' });
  process.env.EFFECT_REPORT_ENABLED = 'true';
  process.env.JOURNEY_PIXEL_SIGNING_KEY_PRIMARY = SIGNING_KEY;
  delete process.env.JOURNEY_PIXEL_ACCEPT_UNSIGNED;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe.each([
  ['generate-effect-reports', generateEffectReports, /effect_reports/],
  ['refresh-journey-analytics', refreshJourneyAnalytics, /journey_analytics/],
  ['score-accuracy-matcher', scoreAccuracyMatcher, /score_accuracy_events/],
])('POST /api/internal/%s', (path, handler, table) => {
  it('rejects an unauthenticated cron call before anything else', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await handler(cronReq(path));
    expect(res.status).toBe(401);
    expect(mockEdgeFunctionLogCreate).not.toHaveBeenCalled();
  });

  it('returns 501 FEATURE_NOT_PROVISIONED naming the missing table', async () => {
    const res = await handler(cronReq(path));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toMatch(table);
  });
});

describe('refresh-journey-analytics edge_function_logs (ported to Prisma)', () => {
  it('records the not-provisioned run as failed', async () => {
    await refreshJourneyAnalytics(cronReq('refresh-journey-analytics'));
    expect(mockEdgeFunctionLogCreate).toHaveBeenCalledTimes(1);
    const { data } = mockEdgeFunctionLogCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      functionName: 'refresh-journey-analytics',
      status: 'failed',
      errorJson: { error: 'FEATURE_NOT_PROVISIONED' },
    });
    expect(data.runId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('still returns 501 when the log write fails', async () => {
    mockEdgeFunctionLogCreate.mockRejectedValueOnce(new Error('db down'));
    const res = await refreshJourneyAnalytics(
      cronReq('refresh-journey-analytics')
    );
    expect(res.status).toBe(501);
  });
});

describe('journey routes (client_journey_events not provisioned)', () => {
  it('pulse pixel: 501 GIF for a valid token, identical for a forged one', async () => {
    const t = signJourneyToken({
      aud: PIXEL_AUDIENCES.pulse,
      clientId: 'org-abc',
      momentId: 'evt-1',
      score: 4,
    });
    const valid = await journeyPulse(
      pixelReq(`https://synthex.social/api/journey/pulse?t=${t}`)
    );
    const forged = await journeyPulse(
      pixelReq('https://synthex.social/api/journey/pulse?t=bad.token')
    );
    for (const res of [valid, forged]) {
      expect(res.status).toBe(501);
      expect(res.headers.get('X-Error')).toBe('FEATURE_NOT_PROVISIONED');
      expect(res.headers.get('Content-Type')).toBe('image/gif');
    }
  });

  it('pulse-confirm: 501 page that says feedback was not saved, no thank-you', async () => {
    const t = signJourneyToken({
      aud: PIXEL_AUDIENCES.pulseConfirm,
      clientId: 'org-abc',
      momentId: 'evt-1',
      score: 5,
    });
    const valid = await journeyPulseConfirm(
      pixelReq(`https://synthex.social/api/journey/pulse-confirm?t=${t}`)
    );
    const forged = await journeyPulseConfirm(
      pixelReq('https://synthex.social/api/journey/pulse-confirm?t=bad.token')
    );
    const validHtml = await valid.text();
    expect(valid.status).toBe(501);
    expect(valid.headers.get('X-Error')).toBe('FEATURE_NOT_PROVISIONED');
    expect(validHtml).toContain('was not saved');
    expect(validHtml).not.toContain('Thanks for your feedback');
    expect(forged.status).toBe(501);
    expect(await forged.text()).toBe(validHtml);
  });

  it('click: redirects to the signed destination, flagged not recorded', async () => {
    const dest = 'https://synthex.social/dashboard/x';
    const t = signJourneyToken({
      aud: PIXEL_AUDIENCES.click,
      clientId: 'org-abc',
      momentId: 'evt-1',
      url: dest,
    });
    const res = await journeyClick(
      pixelReq(`https://synthex.social/api/journey/click?t=${t}`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(dest);
    expect(res.headers.get('X-Journey-Tracking')).toBe(
      'FEATURE_NOT_PROVISIONED'
    );
  });

  it('click: a forged token goes to the fallback without the tracking flag', async () => {
    const res = await journeyClick(
      pixelReq('https://synthex.social/api/journey/click?t=bad.token')
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).not.toContain('/dashboard/x');
    expect(res.headers.get('X-Journey-Tracking')).toBeNull();
  });
});
