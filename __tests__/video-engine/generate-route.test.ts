/** @jest-environment node */
const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE' },
}));

const mockGetOrgId = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) => mockGetOrgId(...a),
}));

const mockSubmitGen = jest.fn();
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: (...a: unknown[]) => mockSubmitGen(...a),
}));

// Script-mode deps (not exercised here but imported by the route)
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));

import { POST } from '@/app/api/video/generate/route';
import { NextRequest } from 'next/server';
import { QuotaExceededError } from '@/lib/services/ai/video/types';

const post = (body: object) =>
  POST(
    new NextRequest('https://synthex.example/api/video/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VIDEO_STUDIO_ENABLED = 'true';
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
  mockGetOrgId.mockResolvedValue('org1');
  mockSubmitGen.mockResolvedValue([
    {
      id: 'row-1',
      providerJobId: 'r1',
      batchGroupId: 'b1',
      model: 'm',
      estimatedCostUsd: 0.3,
      status: 'generating',
    },
  ]);
});

describe('POST /api/video/generate (mode: generative)', () => {
  it('routes generative mode to the generation service with org + user context', async () => {
    const res = await post({
      mode: 'generative',
      prompt: 'a moisture meter',
      methodCardId: 'product-reveal',
    });
    expect(res.status).toBe(200);
    expect(mockSubmitGen).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        organizationId: 'org1',
        initiatedBy: 'studio',
        prompt: 'a moisture meter',
      })
    );
    const body = await res.json();
    expect(body.data.jobs).toHaveLength(1);
  });

  it('400s on invalid generative payloads (missing methodCardId)', async () => {
    const res = await post({ mode: 'generative', prompt: 'x' });
    expect(res.status).toBe(400);
    expect(mockSubmitGen).not.toHaveBeenCalled();
  });

  it('maps QuotaExceededError to 402 with the cap named', async () => {
    mockSubmitGen.mockRejectedValue(new QuotaExceededError('daily', 5, 4.9));
    const res = await post({
      mode: 'generative',
      prompt: 'a moisture meter',
      methodCardId: 'product-reveal',
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/daily/);
  });

  it('403s when the studio feature flag is off', async () => {
    process.env.VIDEO_STUDIO_ENABLED = 'false';
    const res = await post({
      mode: 'generative',
      prompt: 'a moisture meter',
      methodCardId: 'product-reveal',
    });
    expect(res.status).toBe(403);
    expect(mockSubmitGen).not.toHaveBeenCalled();
  });
});
