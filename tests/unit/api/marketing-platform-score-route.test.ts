const findUniqueUser = jest.fn();
const createDraft = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => findUniqueUser(...args) },
    contentDraft: { create: (...args: unknown[]) => createDraft(...args) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => getUserIdMock(...args),
}));

const getEffectiveOrganizationIdMock = jest.fn();
jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    getEffectiveOrganizationIdMock(...args),
}));

const invokeSkillMock = jest.fn();
jest.mock('@/lib/ai/skills', () => ({
  invokeSkill: (...args: unknown[]) => invokeSkillMock(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  aiGeneration: async (
    _req: unknown,
    handler: () => Promise<Response>
  ): Promise<Response> => handler(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/marketing/platform-score/route';

const VALID_REQUEST = {
  brandScope: 'CARSI',
  platform: 'linkedin',
  content:
    'Document the last inspection step before handover. Which check does your team still skip?',
  sourceArtefactRef: 'senior-copywriter Post 06 LinkedIn adaptation',
  voiceTag: 'sage-primary',
};

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  } as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({
    organizationId: 'home-org',
    organization: { status: 'active' },
    teamMemberships: [],
  });
  getEffectiveOrganizationIdMock.mockResolvedValue('active-org');
  invokeSkillMock.mockResolvedValue({
    skill: {
      slug: 'platform-content-optimiser',
      name: 'Platform Content Optimiser',
    },
    content: 'Structured PlatformContentOptimiserScore draft · score 78/100',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-score-1',
    title: 'Pre-publish score — linkedin (CARSI)',
    status: 'review',
    content: 'Structured PlatformContentOptimiserScore draft · score 78/100',
    metadata: {
      skill: { slug: 'platform-content-optimiser' },
      autoPublish: false,
    },
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  });
});

describe('POST /api/marketing/platform-score', () => {
  test('401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(401);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for an incomplete platform score request', async () => {
    const response = await POST(makeRequest({ brandScope: 'CARSI' }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 when platform is not allowlisted', async () => {
    const response = await POST(
      makeRequest({
        ...VALID_REQUEST,
        platform: 'myspace',
      })
    );

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('201 invokes platform-content-optimiser and stores org-scoped review draft', async () => {
    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(201);
    expect(invokeSkillMock).toHaveBeenCalledWith({
      skill: 'platform-content-optimiser',
      prompt: expect.stringContaining('Organisation ID: active-org'),
    });
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Platform: linkedin'
    );
    expect(invokeSkillMock.mock.calls[0][0].prompt).toContain(
      'Source artefact ref: senior-copywriter Post 06 LinkedIn adaptation'
    );
    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'active-org',
        platform: 'linkedin',
        status: 'review',
        content:
          'Structured PlatformContentOptimiserScore draft · score 78/100',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-021',
          autoPublish: false,
          platform: 'linkedin',
          sourceArtefactRef: 'senior-copywriter Post 06 LinkedIn adaptation',
          voiceTag: 'sage-primary',
        }),
      }),
    });

    const data = await response.json();
    expect(data.data.reviewState).toBe('pending_review');
    expect(data.data.draft.id).toBe('draft-score-1');
  });

  test('500 when platform-content-optimiser cannot generate a score', async () => {
    invokeSkillMock.mockRejectedValue(new Error('Provider unavailable'));

    const response = await POST(makeRequest(VALID_REQUEST));

    expect(response.status).toBe(500);
    expect(createDraft).not.toHaveBeenCalled();
  });
});
