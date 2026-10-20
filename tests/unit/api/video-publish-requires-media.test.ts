/**
 * POST /api/video/[id]/publish refuses a row with no video.
 *
 * Script mode of POST /api/video/generate marks a row 'rendered' with a
 * script and no videoUrl. The publish route accepted any 'rendered' row, so a
 * script-only result was "published" as a video: posts were created with no
 * media and the row was marked published.
 */

/** @jest-environment node */

const mockFindUnique = jest.fn();
const mockVideoUpdate = jest.fn();
const mockPostCreate = jest.fn();
const mockCampaignFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => {
  const stub = {
    videoGeneration: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update: (...a: unknown[]) => mockVideoUpdate(...a),
    },
    campaign: {
      findFirst: (...a: unknown[]) => mockCampaignFindFirst(...a),
      create: jest.fn(),
    },
    post: { create: (...a: unknown[]) => mockPostCreate(...a) },
  };
  return { __esModule: true, default: stub, prisma: stub };
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true, context: { userId: 'u1' } }),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE' },
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: async () => 'org1',
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/video/[id]/publish/route';
import { NextRequest } from 'next/server';

const renderedRow = {
  id: 'v1',
  userId: 'u1',
  status: 'rendered',
  title: 'Water damage first hour',
  topic: 'restoration',
  scriptContent: { title: 'Water damage first hour', hashtags: [] },
  thumbnailUrl: null,
};

function publish() {
  return POST(
    new NextRequest('https://synthex.example/api/video/v1/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platforms: ['linkedin'] }),
    }),
    { params: Promise.resolve({ id: 'v1' }) }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCampaignFindFirst.mockResolvedValue({ id: 'c1' });
  mockPostCreate.mockImplementation(async ({ data }) => ({
    id: 'p1',
    scheduledAt: data.scheduledAt,
    status: data.status,
  }));
  mockVideoUpdate.mockResolvedValue({});
});

describe('POST /api/video/[id]/publish', () => {
  it('refuses a rendered script-only row with no video (422) and creates nothing', async () => {
    mockFindUnique.mockResolvedValue({ ...renderedRow, videoUrl: null });

    const res = await publish();

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/no video/i);
    expect(mockPostCreate).not.toHaveBeenCalled();
    expect(mockVideoUpdate).not.toHaveBeenCalled();
  });

  it('still publishes a rendered row that has a video', async () => {
    mockFindUnique.mockResolvedValue({
      ...renderedRow,
      videoUrl: 'https://sb.example/generated-videos/u1/v1.mp4',
    });

    const res = await publish();

    expect(res.status).toBe(200);
    expect(mockPostCreate).toHaveBeenCalledTimes(1);
    expect(mockVideoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      })
    );
  });
});
