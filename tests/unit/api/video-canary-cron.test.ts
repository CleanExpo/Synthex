/**
 * WS2 / SYN-1075 — /api/cron/video-canary route wiring.
 *
 * The canary's real logic lives in lib/video/drift-canary.ts (see
 * tests/unit/lib/video/drift-canary.test.ts); this suite locks the route
 * itself: the cron auth gate, and that pass/skipped map to 200 while a
 * drift failure maps to 500 (so Vercel's cron failure surfacing reflects
 * real drift). runVideoCanary is fully mocked — no provider, no prisma.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { NextResponse } from 'next/server';

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockRunVideoCanary = jest.fn();
jest.mock('@/lib/video/drift-canary', () => ({
  runVideoCanary: (...args: unknown[]) => mockRunVideoCanary(...args),
}));

import { GET } from '@/app/api/cron/video-canary/route';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/video-canary',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
});

describe('GET /api/cron/video-canary', () => {
  it('returns 401 and never runs the canary for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockRunVideoCanary).not.toHaveBeenCalled();
  });

  it('returns 200 with success:true on a pass', async () => {
    mockRunVideoCanary.mockResolvedValue({
      status: 'pass',
      modelId: 'bytedance/seedance-2.0/fast/text-to-video',
      videoUrl: 'https://cdn.fal.run/x.mp4',
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe('pass');
  });

  it('returns 200 (not an alert) on skipped — a config gap, not drift', async () => {
    mockRunVideoCanary.mockResolvedValue({
      status: 'skipped',
      code: 'canary_not_configured',
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 with success:false on a fail (drift detected)', async () => {
    mockRunVideoCanary.mockResolvedValue({
      status: 'fail',
      code: 'model_retired',
      reason: 'model retired',
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.code).toBe('model_retired');
  });

  it('returns 500 without crashing when runVideoCanary itself throws', async () => {
    mockRunVideoCanary.mockRejectedValue(new Error('unexpected'));

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Video canary cron failed');
  });
});
