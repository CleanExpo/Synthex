/**
 * SYN-1096 — /api/cron/video-production no-work short-circuit.
 *
 * The production pipeline transitively requires @ffmpeg-installer/ffmpeg, whose
 * binary is deliberately excluded from the Vercel bundle (250MB function limit).
 * Importing it 500s the run with "Cannot find module '@ffmpeg-installer/ffmpeg'"
 * — which is exactly what production did on 2026-07-15 with ZERO active series.
 *
 * This suite pins the fix: a light Prisma count runs BEFORE the heavy import, so
 * with no active series the route answers 200 and never touches the ffmpeg chain
 * (runAllSeriesPipelines is never called). When a series exists, the pipeline
 * runs as before.
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

const mockCount = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: { videoSeries: { count: (...a: unknown[]) => mockCount(...a) } },
}));

const mockRunAll = jest.fn();
jest.mock('@/lib/video/production-pipeline', () => ({
  runAllSeriesPipelines: (...a: unknown[]) => mockRunAll(...a),
}));

import { GET } from '@/app/api/cron/video-production/route';

function req(search = '') {
  return createMockNextRequest({
    url: `http://localhost/api/cron/video-production${search}`,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
});

describe('GET /api/cron/video-production', () => {
  it('returns 401 and never counts or runs the pipeline for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockRunAll).not.toHaveBeenCalled();
  });

  it('returns 200 skipped and never imports the ffmpeg pipeline when no active series', async () => {
    mockCount.mockResolvedValue(0);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.skipped).toBe('no active series');
    expect(body.results).toEqual([]);
    // The critical guarantee: the heavy pipeline was never invoked.
    expect(mockRunAll).not.toHaveBeenCalled();
  });

  it('scopes the active-series count to the ?series= override', async () => {
    mockCount.mockResolvedValue(0);

    await GET(req('?series=demo-weekly'));

    expect(mockCount).toHaveBeenCalledWith({
      where: { status: 'active', slug: 'demo-weekly' },
    });
  });

  it('runs the pipeline when at least one active series exists', async () => {
    mockCount.mockResolvedValue(1);
    mockRunAll.mockResolvedValue([
      { seriesSlug: 'demo', episodeNumber: 1, status: 'published' },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRunAll).toHaveBeenCalledTimes(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].status).toBe('published');
  });
});
