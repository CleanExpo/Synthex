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
  // SYN-1115 round-6: the reservation this job holds in the spend log.
  spendHoldId: 'hold-abc',
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
    // An ERROR webhook means fal produced nothing, so the hold is genuinely
    // owed back. This release must survive — the storage-failure fix below
    // must not turn every failure into a charge.
    expect(mockRelease).toHaveBeenCalledWith('org1', 'hold-abc', 0.3, 'studio');
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('marks the row failed but KEEPS the spend when artifact storage throws', async () => {
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
    // This test used to assert a RELEASE, pinning the defect. A successful
    // webhook means fal completed and BILLED the generation; what failed is our
    // own download. Releasing handed the money back, consumed the hold's
    // terminal key so nothing could correct it, and reopened daily and monthly
    // admission headroom for spend that really happened (release review,
    // pass 2). The artifact is lost — hence 'failed' above — but the spend is a
    // separate fact and must be settled.
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockSettle).toHaveBeenCalledWith(
      'org1',
      'hold-abc',
      0.3,
      expect.any(Number),
      'studio'
    );
    const settledActual = mockSettle.mock.calls[0][3] as number;
    expect(settledActual).toBeGreaterThan(0);
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

  // SYN-1115 review finding 4: the FIRST version of this fix transitioned the
  // row and only THEN returned 500, so fal's retry hit the status guard,
  // matched zero rows and returned 200 idempotent — the spend still escaped
  // every counter, merely reported once. The invariant now under test: a
  // settlement that cannot happen must never be consumed by the idempotency
  // transition.
  describe('unattributable spend (no organizationId)', () => {
    it('refuses with 500 BEFORE any status transition', async () => {
      mockFindFirst.mockResolvedValue({ ...pendingRow, organizationId: null });
      const res = await POST(
        webhookReq({
          request_id: 'r1',
          status: 'OK',
          payload: { video: { url: 'https://cdn.fal/v.mp4' } },
        })
      );

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        error: 'unattributable spend',
      });
      expect(mockSettle).not.toHaveBeenCalled();
      // THE assertion: the row was never written, so it stays 'generating'
      // and remains re-processable.
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("stays re-processable across fal's FULL retry sequence", async () => {
      mockFindFirst.mockResolvedValue({ ...pendingRow, organizationId: null });
      const body = {
        request_id: 'r1',
        status: 'OK',
        payload: { video: { url: 'https://cdn.fal/v.mp4' } },
      };

      // Three deliveries, as fal would retry a 500.
      const first = await POST(webhookReq(body));
      const second = await POST(webhookReq(body));
      const third = await POST(webhookReq(body));

      // Every delivery refuses the same way — none is swallowed as
      // "idempotent: true", which is what the old ordering produced from the
      // second delivery onward.
      for (const res of [first, second, third]) {
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toMatchObject({
          error: 'unattributable spend',
        });
      }
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockSettle).not.toHaveBeenCalled();
      expect(mockRelease).not.toHaveBeenCalled();
    });

    it('refuses an ERROR webhook the same way (release path)', async () => {
      mockFindFirst.mockResolvedValue({ ...pendingRow, organizationId: null });
      const res = await POST(
        webhookReq({ request_id: 'r1', status: 'ERROR', error: 'boom' })
      );
      expect(res.status).toBe(500);
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockRelease).not.toHaveBeenCalled();
    });

    // The cases above all carry a spendHoldId, so there IS a reservation to
    // protect and refusing is right. A LEGACY row has neither — every spend
    // operation below the guard is already gated on `row.spendHoldId`, and
    // holds are created from `req.organizationId`, so a row with no org has no
    // hold either. Refusing there protects no money while destroying the
    // artifact fal produced and billed, and fal retries until it gives up.
    it('SAVES a legacy row that has no org AND no hold', async () => {
      mockFindFirst.mockResolvedValue({
        ...pendingRow,
        organizationId: null,
        spendHoldId: null,
      });
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockStore.mockResolvedValue({ storedUrl: 'https://cdn/stored.mp4' });

      const res = await POST(
        webhookReq({
          request_id: 'r1',
          status: 'OK',
          payload: { video: { url: 'https://cdn.fal/v.mp4' } },
        })
      );

      expect(res.status).toBe(200);
      // THE assertion: the completed video is persisted rather than discarded.
      expect(mockUpdateMany).toHaveBeenCalled();
      const written = mockUpdateMany.mock.calls[0][0] as {
        data: { status: string; videoUrl?: string };
      };
      expect(written.data.status).toBe('rendered');
      expect(written.data.videoUrl).toBe('https://cdn/stored.mp4');

      // And no spend operation ran, because there is no reservation to settle.
      expect(mockSettle).not.toHaveBeenCalled();
      expect(mockRelease).not.toHaveBeenCalled();
    });

    it('marks a legacy FAILED row failed instead of stranding it', async () => {
      mockFindFirst.mockResolvedValue({
        ...pendingRow,
        organizationId: null,
        spendHoldId: null,
      });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const res = await POST(
        webhookReq({ request_id: 'r1', status: 'ERROR', error: 'boom' })
      );

      expect(res.status).toBe(200);
      expect(mockUpdateMany).toHaveBeenCalled();
      const written = mockUpdateMany.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(written.data.status).toBe('failed');
      expect(mockRelease).not.toHaveBeenCalled();
    });
  });

  // SYN-1115 round-6: the unclaim/retry tests that lived here are GONE. They
  // asserted that a failed quota mutation reverted the row so the provider
  // retry could re-reach settlement — a property that only mattered because
  // settling a COUNTER is not idempotent. Video now finalises against the
  // append-only log keyed on the hold, so a replayed webhook conflicts on the
  // unique index and no-ops. There is nothing to unclaim.
  describe('settlement is keyed on the hold, so replays are harmless', () => {
    it('finalises using the row spendHoldId, not the row id', async () => {
      await POST(
        webhookReq({
          request_id: 'r1',
          status: 'OK',
          payload: { video: { url: 'https://cdn.fal/v.mp4' } },
        })
      );
      expect(mockSettle).toHaveBeenCalledWith(
        'org1',
        'hold-abc',
        expect.any(Number),
        expect.any(Number),
        'studio'
      );
    });

    it('a hold already finalised elsewhere is reported, not thrown', async () => {
      // The log returns false when the sweep or an earlier delivery won.
      mockSettle.mockResolvedValueOnce(false);
      const res = await POST(
        webhookReq({
          request_id: 'r1',
          status: 'OK',
          payload: { video: { url: 'https://cdn.fal/v.mp4' } },
        })
      );
      expect(res.status).toBe(200);
    });

    it('skips finalisation entirely for a legacy row with no hold id', async () => {
      mockFindFirst.mockResolvedValue({ ...pendingRow, spendHoldId: null });
      const res = await POST(
        webhookReq({ request_id: 'r1', status: 'ERROR', error: 'boom' })
      );
      expect(res.status).toBe(200);
      expect(mockRelease).not.toHaveBeenCalled();
    });
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
