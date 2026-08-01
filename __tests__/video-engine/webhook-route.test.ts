/** @jest-environment node */
const mockFindFirst = jest.fn();
const mockUpdateMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
    },
  },
}));

const mockSettle = jest.fn();
const mockRelease = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  settleQuota: (...a: unknown[]) => mockSettle(...a),
  releaseQuota: (...a: unknown[]) => mockRelease(...a),
}));

const mockStore = jest.fn();
jest.mock('@/lib/services/ai/video/artifact-store', () => ({
  storeArtifact: (...a: unknown[]) => mockStore(...a),
}));

import { POST } from '@/app/api/video/webhook/fal/route';
import { NextRequest } from 'next/server';

function webhookReq(body: object, token = 'shh-secret'): NextRequest {
  return new NextRequest(
    `https://synthex.example/api/video/webhook/fal?token=${token}`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

const pendingRow = {
  id: 'row-1',
  organizationId: 'org1',
  status: 'generating',
  initiatedBy: 'studio',
  estimatedCostUsd: 0.3,
  durationSeconds: 6,
  model: 'fal-ai/wan/v2.5/text-to-video',
  userId: 'u1',
  enhancedPrompt: 'a prompt',
  batchGroupId: 'b1',
  metadata: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FAL_WEBHOOK_SECRET = 'shh-secret';
  mockFindFirst.mockResolvedValue(pendingRow);
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockStore.mockResolvedValue({ storedUrl: 'https://supabase/x.mp4' });
});

describe('POST /api/video/webhook/fal', () => {
  it('rejects a bad token with 401 and touches nothing', async () => {
    const res = await POST(
      webhookReq({ request_id: 'r1', status: 'OK' }, 'wrong')
    );
    expect(res.status).toBe(401);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('completes a success: stores artifact, updates row, settles quota', async () => {
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockStore).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: 'https://cdn.fal/v.mp4' })
    );
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'generating' }),
        data: expect.objectContaining({
          status: 'rendered',
          videoUrl: 'https://supabase/x.mp4',
        }),
      })
    );
    expect(mockSettle).toHaveBeenCalled();
  });

  it('is idempotent: a repeat webhook for a completed row is a 200 no-op', async () => {
    mockFindFirst.mockResolvedValue({ ...pendingRow, status: 'rendered' });
    // With atomic transitions, findFirst still returns the row but updateMany will
    // find count=0 if the status is not 'generating'. However the early-exit path
    // via the status !== 'generating' check was removed — now the guard lives in
    // updateMany. Simulate count=0 to prove idempotency still works.
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'x' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('marks failures failed and releases the hold', async () => {
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'ERROR',
        error: 'content policy violation',
      })
    );
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'generating' }),
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringMatching(/policy/i),
        }),
      })
    );
    expect(mockRelease).toHaveBeenCalledWith('org1', 0.3, 'studio');
  });

  it('marks the row failed and releases when artifact storage throws', async () => {
    mockStore.mockRejectedValue(new Error('download failed'));
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'generating' }),
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
    expect(mockRelease).toHaveBeenCalledWith('org1', 0.3, 'studio');
  });

  it('returns 200 for unknown request ids (fal retries otherwise) but logs', async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await POST(webhookReq({ request_id: 'ghost', status: 'OK' }));
    expect(res.status).toBe(200);
  });

  it('does not settle quota when the row was already transitioned by a concurrent webhook', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  // SYN-1115: this case previously asserted that a null-org row "skips quota
  // settle (but still completes)" with a 200. That encoded the bug — real
  // provider spend escaped every quota counter and the only trace was a log
  // line nobody read. Money movement must not no-op quietly, so an
  // unattributable settlement is now a hard failure.
  it('FAILS LOUDLY (500) when the row has no organizationId — spend must never be unattributable', async () => {
    mockFindFirst.mockResolvedValue({ ...pendingRow, organizationId: null });
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      })
    );
    // 500 is deliberate here and is the one exception to this route's
    // always-200 rule: a fal retry is exactly what we want while the row is
    // unattributable, and a red webhook is visible where a log line was not.
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: 'unattributable spend',
    });
    // Still never settles against a nonexistent org.
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('returns 200 on an unparseable body', async () => {
    const req = new NextRequest(
      'https://synthex.example/api/video/webhook/fal?token=shh-secret',
      {
        method: 'POST',
        body: 'not-json{',
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
