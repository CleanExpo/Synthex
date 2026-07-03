const mockSubmitGen = jest.fn();
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: (...a: unknown[]) => mockSubmitGen(...a),
}));
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    videoGeneration: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
  },
}));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn().mockResolvedValue(null),
}));
const mockSnapshot = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: (...a: unknown[]) => mockSnapshot(...a),
}));
jest.mock('@/lib/services/ai/image-generation', () => ({
  // generateImage is the real export name from lib/services/ai/image-generation.ts
  generateImage: jest.fn().mockResolvedValue({ success: true, url: 'img.png' }),
}));
const mockGetAssets = jest.fn();
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {
    // getAssets returns { assets, total } — adapted to match real signature
    getAssets: (...a: unknown[]) => mockGetAssets(...a),
  },
}));
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    complete: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'A great caption #synthex' } }],
    }),
  }),
}));

import {
  STUDIO_TOOLS,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';

const ctx = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'mcp' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot.mockResolvedValue({ warning: false });
  mockSubmitGen.mockResolvedValue([{ id: 'row-1', status: 'generating' }]);
  mockFindFirst.mockResolvedValue({
    id: 'row-1',
    status: 'rendered',
    videoUrl: 'u',
    inputPrompt: 'p',
    enhancedPrompt: 'ep',
    methodCardId: 'product-reveal',
  });
  mockFindMany.mockResolvedValue([]);
  mockGetAssets.mockResolvedValue({ assets: [{ id: 'asset-1' }], total: 1 });
});

describe('studio tools', () => {
  it('exposes the phase-1 tool set (no publish tools)', () => {
    expect(STUDIO_TOOLS.map(t => t.name).sort()).toEqual(
      [
        'draft_caption',
        'generate_image',
        'generate_video',
        'get_job',
        'list_cards',
        'list_jobs',
        'search_media_library',
      ].sort()
    );
    for (const t of STUDIO_TOOLS)
      expect(t.description.length).toBeGreaterThan(10);
  });

  it('generate_video validates args via zod and forwards ctx (initiatedBy=mcp)', async () => {
    const out = await executeStudioTool(
      'generate_video',
      { prompt: 'a meter', methodCardId: 'product-reveal' },
      ctx
    );
    expect(mockSubmitGen).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        organizationId: 'org1',
        initiatedBy: 'mcp',
      })
    );
    expect((out as { jobs: unknown[] }).jobs).toHaveLength(1);
    expect((out as { budgetWarning: boolean }).budgetWarning).toBe(false);
  });

  it('surfaces budgetWarning=true so agents can self-throttle', async () => {
    mockSnapshot.mockResolvedValue({ warning: true });
    const out = await executeStudioTool(
      'generate_video',
      { prompt: 'a meter', methodCardId: 'product-reveal' },
      ctx
    );
    expect((out as { budgetWarning: boolean }).budgetWarning).toBe(true);
  });

  it('rejects invalid args with a zod error before any side effect', async () => {
    await expect(
      executeStudioTool('generate_video', { prompt: 'x' }, ctx) // too short + missing methodCardId
    ).rejects.toThrow();
    expect(mockSubmitGen).not.toHaveBeenCalled();
  });

  it('get_job scopes lookups to the caller org', async () => {
    await executeStudioTool('get_job', { id: 'row-1' }, ctx);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'row-1', organizationId: 'org1' }),
      })
    );
  });

  it('list_jobs scopes to org and generative mode', async () => {
    await executeStudioTool('list_jobs', {}, ctx);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org1',
          mode: 'generative',
        }),
      })
    );
  });

  it('draft_caption returns a caption for an owned job', async () => {
    const out = await executeStudioTool(
      'draft_caption',
      { jobId: 'row-1', platform: 'instagram' },
      ctx
    );
    expect((out as { caption: string }).caption).toContain('caption');
  });

  it('throws on unknown tool names (publish_post must not exist)', async () => {
    await expect(executeStudioTool('publish_post', {}, ctx)).rejects.toThrow(
      /unknown tool/i
    );
  });

  it('list_cards returns the registries and quota', async () => {
    const out = await executeStudioTool('list_cards', {}, ctx);
    expect(
      (out as { methodCards: unknown[] }).methodCards.length
    ).toBeGreaterThan(0);
    expect((out as { models: unknown[] }).models.length).toBeGreaterThan(0);
    expect(out).toHaveProperty('quota');
  });

  it('generate_image rejects unknown styles at the boundary', async () => {
    await expect(
      executeStudioTool(
        'generate_image',
        { prompt: 'a logo', style: 'watercolor' },
        ctx
      )
    ).rejects.toThrow();
  });

  it('search_media_library returns assets and total', async () => {
    const out = await executeStudioTool(
      'search_media_library',
      { search: 'meter' },
      ctx
    );
    expect((out as { assets: unknown[] }).assets).toHaveLength(1);
    expect(out).toHaveProperty('total');
  });
});
