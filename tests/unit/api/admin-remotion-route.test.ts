/**
 * AT-010 — POST/GET /api/admin/remotion pending Remotion brief.
 *
 * POST must invoke creative-director and persist an org-scoped review draft.
 * It must NOT return the old preview-only placeholder or start a render.
 */

const mockVerifyAdmin = jest.fn();
const createDraft = jest.fn();
const findFirstDraft = jest.fn();
const getEffectiveOrganizationIdMock = jest.fn();
const invokeSkillMock = jest.fn();

jest.mock('@/lib/admin/verify-admin', () => ({
  verifyAdmin: (...a: unknown[]) => mockVerifyAdmin(...a),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contentDraft: {
      create: (...a: unknown[]) => createDraft(...a),
      findFirst: (...a: unknown[]) => findFirstDraft(...a),
    },
  },
}));

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) =>
    getEffectiveOrganizationIdMock(...a),
}));

jest.mock('@/lib/ai/skills', () => ({
  invokeSkill: (...a: unknown[]) => invokeSkillMock(...a),
}));

jest.mock('@/lib/rate-limit', () => ({
  aiGeneration: async (
    _req: unknown,
    handler: () => Promise<Response>
  ): Promise<Response> => handler(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { POST, GET } from '@/app/api/admin/remotion/route';

const VALID_REQUEST = {
  compositionId: 'SocialReel',
  brandScope: 'RestoreAssist',
  objective:
    'Produce a Remotion visual brief for the IICRC S500 explainer companion page.',
  companionPageUrl: 'https://restoreassist.com.au/hub/iicrc-s500-explainer',
  title: 'RA S500 explainer reel',
};

function makeRequest(opts: { url?: string; body?: unknown } = {}) {
  return {
    url: opts.url ?? 'https://synthex.example/api/admin/remotion',
    headers: { get: () => null },
    json: async () => opts.body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue({ isAdmin: true, userId: 'admin-1' });
  getEffectiveOrganizationIdMock.mockResolvedValue('org-1');
  invokeSkillMock.mockResolvedValue({
    skill: { slug: 'creative-director', name: 'Creative Director' },
    content: 'Structured CreativeDirectorOutput draft',
    model: 'mock-balanced',
    foundationIncluded: [{ filename: 'ceo-foundation.md', truncated: false }],
    foundationMissing: [],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });
  createDraft.mockResolvedValue({
    id: 'draft-remotion-1',
    title: 'RA S500 explainer reel',
    status: 'review',
    content: 'Structured CreativeDirectorOutput draft',
    metadata: {
      agencyTaskId: 'AT-010',
      autoPublish: false,
      compositionId: 'SocialReel',
    },
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  });
  findFirstDraft.mockResolvedValue({
    id: 'draft-remotion-1',
    title: 'RA S500 explainer reel',
    status: 'review',
    content: 'Structured CreativeDirectorOutput draft',
    metadata: { agencyTaskId: 'AT-010', autoPublish: false },
    organizationId: 'org-1',
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
    updatedAt: new Date('2026-08-06T00:00:00.000Z'),
  });
});

describe('POST /api/admin/remotion — AT-010', () => {
  test('403 when not admin', async () => {
    mockVerifyAdmin.mockResolvedValue({
      isAdmin: false,
      error: 'Admin access required',
    });

    const response = await POST(makeRequest({ body: VALID_REQUEST }));

    expect(response.status).toBe(403);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 when admin API key has no userId', async () => {
    mockVerifyAdmin.mockResolvedValue({ isAdmin: true });

    const response = await POST(makeRequest({ body: VALID_REQUEST }));

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('400 for incomplete brief request', async () => {
    const response = await POST(
      makeRequest({ body: { compositionId: 'SocialReel' } })
    );

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });

  test('400 for unknown compositionId', async () => {
    const response = await POST(
      makeRequest({
        body: { ...VALID_REQUEST, compositionId: 'NotAComposition' },
      })
    );

    expect(response.status).toBe(400);
    expect(invokeSkillMock).not.toHaveBeenCalled();
  });

  test('creates pending_review remotion brief via creative-director', async () => {
    const response = await POST(makeRequest({ body: VALID_REQUEST }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.reviewState).toBe('pending_review');
    expect(json.data.draft.id).toBe('draft-remotion-1');
    expect(json.data.renderCapabilities.serverSideRender).toBe(false);
    expect(json.data.renderCapabilities.autoPublish).toBe(false);
    expect(json).not.toHaveProperty('status', 'preview-only');

    expect(invokeSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'creative-director',
        prompt: expect.stringContaining('remotion-video'),
      })
    );

    expect(createDraft).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        organizationId: 'org-1',
        platform: 'remotion',
        status: 'review',
        metadata: expect.objectContaining({
          agencyTaskId: 'AT-010',
          compositionId: 'SocialReel',
          autoPublish: false,
          serverSideRender: false,
        }),
      }),
    });
  });
});

describe('GET /api/admin/remotion — AT-010', () => {
  test('lists compositions when no draftId', async () => {
    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json.compositions)).toBe(true);
    expect(json.compositions.length).toBeGreaterThan(0);
    expect(json.renderCapabilities.serverSideRender).toBe(false);
    expect(json.renderCapabilities.autoPublish).toBe(false);
  });

  test('polls org-scoped pending brief by draftId', async () => {
    const response = await GET(
      makeRequest({
        url: 'https://synthex.example/api/admin/remotion?draftId=draft-remotion-1',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.reviewState).toBe('pending_review');
    expect(json.data.draft.id).toBe('draft-remotion-1');
    expect(findFirstDraft).toHaveBeenCalledWith({
      where: {
        id: 'draft-remotion-1',
        organizationId: 'org-1',
        platform: 'remotion',
      },
      select: expect.any(Object),
    });
  });

  test('404 when brief is missing for the organisation', async () => {
    findFirstDraft.mockResolvedValue(null);

    const response = await GET(
      makeRequest({
        url: 'https://synthex.example/api/admin/remotion?draftId=missing',
      })
    );

    expect(response.status).toBe(404);
  });
});
