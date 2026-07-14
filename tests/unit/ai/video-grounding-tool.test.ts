import { z } from 'zod';

// Hermetic: the generate_video execute() path only needs the video service
// (mocked to control block/success outcomes) and quota (hits prisma otherwise).
// Everything else studio-tools/index.ts pulls in (media-tools, approvals-tools,
// context-tools, etc.) is exercised untouched — matches the existing
// __tests__/video-engine/studio-tools.test.ts mocking footprint.
const mockSubmitGen = jest.fn();
class MockGroundingBlockedError extends Error {
  blocked = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'GroundingBlockedError';
  }
}
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: (...a: unknown[]) => mockSubmitGen(...a),
  GroundingBlockedError: MockGroundingBlockedError,
}));

const mockSnapshot = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: (...a: unknown[]) => mockSnapshot(...a),
}));

// Re-derive the arg schema shape by importing the module and checking the tool.
import {
  ALL_MCP_TOOLS,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';

const NO_COVERAGE_ERROR =
  'No owned references for this subject — add real photos to the reference library first.';

const ctx = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'mcp' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSnapshot.mockResolvedValue({ warning: false });
});

describe('generate_video reference args', () => {
  it('accepts referenceSet and useReferences without error', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    expect(tool).toBeDefined();
    const parsed = (tool!.schema as z.ZodTypeAny).safeParse({
      prompt: 'a carpet wand',
      methodCardId: 'stub',
      referenceSet: 'carpet-cleaning',
      useReferences: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('still rejects a missing prompt', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    const parsed = (tool!.schema as z.ZodTypeAny).safeParse({
      methodCardId: 'stub',
      referenceSet: 'carpet-cleaning',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('generate_video tool description — Real Images Only contract', () => {
  it('states grounding is default-on, names the escape hatch, and tells agents to relay block errors', () => {
    const tool = ALL_MCP_TOOLS.find(t => t.name === 'generate_video');
    expect(tool).toBeDefined();
    const desc = tool!.description.toLowerCase();
    // Grounding-by-default is stated (not framed as an opt-in the caller must ask for).
    expect(desc).toMatch(/default/);
    expect(desc).toMatch(/ground/);
    // useReferences:false is named as the audited escape hatch.
    expect(desc).toMatch(/usereferences\s*:\s*false/);
    expect(desc).toMatch(/escape hatch/);
    // Blocked calls must be relayed verbatim rather than retried blind.
    expect(desc).toMatch(/block/);
    expect(desc).toMatch(/verbatim/);
  });
});

describe('generate_video execute — blocked errors are relayed verbatim (Real Images Only)', () => {
  it('propagates the block error message unchanged when the service refuses ungrounded generation (no refs + no imageUrl)', async () => {
    mockSubmitGen.mockRejectedValue(
      new MockGroundingBlockedError(NO_COVERAGE_ERROR)
    );

    await expect(
      executeStudioTool(
        'generate_video',
        { prompt: 'a cartoon spaceship', methodCardId: 'stub' },
        ctx
      )
    ).rejects.toThrow(NO_COVERAGE_ERROR);
    expect(mockSubmitGen).toHaveBeenCalledTimes(1);
  });

  it('propagates the block error message unchanged for a tier-without-image-model refusal', async () => {
    mockSubmitGen.mockRejectedValue(
      new MockGroundingBlockedError(
        'Grounded video needs an image-capable model, but tier "standard" has none available — choose a higher tier or pass useReferences:false.'
      )
    );

    await expect(
      executeStudioTool(
        'generate_video',
        {
          prompt: 'a carpet wand',
          methodCardId: 'stub',
          referenceSet: 'carpet-cleaning',
          modelTier: 'standard',
        },
        ctx
      )
    ).rejects.toThrow(/tier "standard" has none available/);
  });

  it('does not swallow a successful grounded submission', async () => {
    mockSubmitGen.mockResolvedValue([
      { id: 'row-1', status: 'generating', grounded: true },
    ]);
    const out = (await executeStudioTool(
      'generate_video',
      { prompt: 'a carpet wand', methodCardId: 'stub' },
      ctx
    )) as { jobs: Array<{ grounded?: boolean }> };
    expect(out.jobs[0].grounded).toBe(true);
  });
});
