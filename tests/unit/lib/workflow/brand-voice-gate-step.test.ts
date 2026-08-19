/**
 * Unit tests for the brand-voice validation workflow step (AT-003).
 */
import { execute } from '@/lib/workflow/step-types/brand-voice-gate';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    brandDNA: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/aeo/brand-voice-enforce', () => ({
  enforceBrandVoice: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { enforceBrandVoice } from '@/lib/aeo/brand-voice-enforce';

const mockFindUnique = prisma.brandDNA.findUnique as jest.Mock;
const mockEnforce = enforceBrandVoice as jest.Mock;

function ctx(content: unknown, organizationId = 'org-dr') {
  return {
    stepDefinition: {} as never,
    priorOutputs: [{ stepType: 'ai', output: content }],
    stepIndex: 3,
    totalSteps: 6,
    organizationId,
  } as unknown as Parameters<typeof execute>[1];
}

const stepDef = {
  name: 'Brand voice gate',
  type: 'validation',
  config: { subType: 'brand-voice', passScore: 75 },
} as unknown as Parameters<typeof execute>[0];

describe('brand-voice-gate workflow step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      brandVoice: { voiceTag: 'brand_anonymous' },
      organization: { slug: 'disaster-recovery' },
    });
    mockEnforce.mockResolvedValue({
      pass: true,
      reasons: [],
      evidence_urls: [],
      brand: 'dr',
      surface: 'outreach',
      durationMs: 1,
    });
  });

  it('calls enforceBrandVoice with resolved brand slug and draft content', async () => {
    const draft =
      'When flooding damages property, document the scene before remediation begins.';
    const result = await execute(stepDef, ctx({ content: draft }));

    expect(mockEnforce).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: 'dr',
        candidate: draft,
        surface: 'outreach',
      }),
      expect.objectContaining({ trackingEnabled: true })
    );
    expect(result.success).toBe(true);
    const out = (result as { output: Record<string, unknown> }).output;
    expect(out.pass).toBe(true);
    expect(out.brand).toBe('dr');
    expect(out.gate).toBe('brand-voice-enforce');
  });

  it('requires approval when enforce returns violations below passScore threshold', async () => {
    mockEnforce.mockResolvedValue({
      pass: false,
      reasons: ['R1: forbidden word "leverage" matched'],
      evidence_urls: [],
      brand: 'ra',
      surface: 'outreach',
      durationMs: 1,
    });

    const result = await execute(
      stepDef,
      ctx('Teams leverage reports for faster claims.')
    );
    const out = (result as { output: Record<string, unknown> }).output;

    expect(out.pass).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(out.violations).toEqual(['R1: forbidden word "leverage" matched']);
  });

  it('fails closed when org slug cannot be mapped to a brand', async () => {
    mockFindUnique.mockResolvedValue({
      brandVoice: {},
      organization: { slug: 'unknown-client' },
    });

    const result = await execute(stepDef, ctx('Some copy'));
    const out = (result as { output: Record<string, unknown> }).output;

    expect(mockEnforce).not.toHaveBeenCalled();
    expect(out.pass).toBe(false);
    expect(out.violations).toEqual(['brand_unresolved']);
    expect(result.requiresApproval).toBe(true);
  });
});
