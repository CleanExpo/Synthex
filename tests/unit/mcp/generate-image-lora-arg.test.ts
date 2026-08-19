/**
 * SYN carpet-style-lora, Task 3 — the generate_image tool contract gains an
 * optional loraId arg. Mirrors the heavy-transitive-import mock set from
 * tests/unit/mcp/scope-filtering.test.ts so the studio-tools registry module
 * loads without touching Prisma/queue/video services; generateImage itself is
 * mocked so this stays a pure schema + threading test (behaviour is covered
 * by tests/unit/ai/image-generation-grounding.test.ts).
 */

// --- mock the heavy transitive imports of the studio-tools registry ---
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn(),
}));
jest.mock('@/lib/video/social-derivation', () => ({
  deriveSocialCut: jest.fn(),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: jest.fn(),
}));
const mockGenerateImage = jest.fn();
jest.mock('@/lib/services/ai/image-generation', () => ({
  generateImage: (...a: unknown[]) => mockGenerateImage(...a),
}));
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {},
}));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));
jest.mock('@/lib/queue/bull-queue', () => ({
  QUEUE_NAMES: { AUTONOMOUS_TASKS: 'autonomous-tasks' },
  getQueue: jest.fn(),
  addJob: jest.fn(),
}));
jest.mock('@/lib/linear/client', () => ({ getLinearClient: jest.fn() }));
jest.mock('@/lib/evidence/retriever', () => ({
  getAvailableRetrievers: jest.fn(() => []),
}));

import {
  executeStudioTool,
  STUDIO_TOOLS,
} from '@/lib/services/ai/studio-tools';

const ctx = {
  userId: 'u1',
  organizationId: 'o1',
  initiatedBy: 'studio' as const,
};

describe('generate_image tool — loraId arg (SYN carpet-style-lora, Task 3)', () => {
  beforeEach(() => {
    mockGenerateImage.mockReset();
    mockGenerateImage.mockResolvedValue({
      success: true,
      provider: 'stability',
    });
  });

  it('the GenerateImageArgs schema accepts an optional loraId', () => {
    const tool = STUDIO_TOOLS.find(t => t.name === 'generate_image')!;
    const parsed = tool.schema.safeParse({
      prompt: 'a professional carpet cleaning setup',
      loraId: 'carpet-style-v1',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty-string loraId (min(1))', () => {
    const tool = STUDIO_TOOLS.find(t => t.name === 'generate_image')!;
    const parsed = tool.schema.safeParse({
      prompt: 'a professional carpet cleaning setup',
      loraId: '',
    });
    expect(parsed.success).toBe(false);
  });

  it('still accepts args with no loraId (optional, backward-compatible)', () => {
    const tool = STUDIO_TOOLS.find(t => t.name === 'generate_image')!;
    const parsed = tool.schema.safeParse({
      prompt: 'a professional carpet cleaning setup',
    });
    expect(parsed.success).toBe(true);
  });

  it('threads loraId through to generateImage', async () => {
    await executeStudioTool(
      'generate_image',
      {
        prompt: 'a professional carpet cleaning setup',
        loraId: 'carpet-style-v1',
      },
      ctx
    );

    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    const [options] = mockGenerateImage.mock.calls[0];
    expect(options.loraId).toBe('carpet-style-v1');
  });

  it('passes loraId: undefined through when the caller omits it', async () => {
    await executeStudioTool(
      'generate_image',
      { prompt: 'a professional carpet cleaning setup' },
      ctx
    );

    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    const [options] = mockGenerateImage.mock.calls[0];
    expect(options.loraId).toBeUndefined();
  });
});
