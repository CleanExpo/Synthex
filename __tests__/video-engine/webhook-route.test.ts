/** @jest-environment node */
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
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
  mockUpdate.mockResolvedValue({});
  mockStore.mockResolvedValue({ storedUrl: 'https://supabase/x.mp4' });
});

describe('POST /api/video/webhook/fal', () => {
  it('rejects a bad token with 401 and touches nothing', async () => {
    const res = await POST(
      webhookReq({ request_id: 'r1', status: 'OK' }, 'wrong')
    );
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
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
    const res = await POST(
      webhookReq({
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'x' } },
      })
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
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
});
