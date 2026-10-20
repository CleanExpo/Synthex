/**
 * Grounded viral brief (seam audit 06 §B4).
 *
 * defaultLoadBrief used to return `facts: []` and read no brand data, so the
 * copy prompt saw only the topic. It now reads the org's brand + client profile
 * through the existing read-only studio tools (context_get_brand /
 * context_get_client_profile, org-scoped by ToolContext) and the copy prompt
 * carries the brand voice, banned vocabulary, offers and proof points. Brand
 * data that is not recorded is named as missing — never invented.
 */

jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));
jest.mock('@/lib/video/gates', () => ({
  runBriefGrill: jest.fn(),
  runBroadcastGrill: jest.fn(),
}));
jest.mock('@/lib/video/gates/assert-gate-passed', () => ({
  assertGatePassed: jest.fn(),
}));
jest.mock('@/lib/services/ai/studio-tools', () => ({
  executeStudioTool: jest.fn(),
}));

import { defaultDeps } from '../../scripts/nexus-viral-run';
import { getAIProvider } from '@/lib/ai/providers';
import { executeStudioTool } from '@/lib/services/ai/studio-tools';
import type { ToolContext } from '@/lib/services/ai/studio-tools/types';

const ctx: ToolContext = {
  userId: 'u1',
  organizationId: 'org-carsi',
  initiatedBy: 'studio',
};

function primeProvider() {
  const complete = jest.fn().mockResolvedValue({
    choices: [
      { message: { content: 'HOOK: Mould spreads in 48 hours\nPROMPT: x' } },
    ],
  });
  (getAIProvider as jest.Mock).mockReturnValue({
    complete,
    models: { balanced: 'm' },
  });
  return complete;
}

function primeContext(brand: unknown, profile: unknown) {
  (executeStudioTool as jest.Mock).mockImplementation(
    async (name: string, _args: unknown, c: ToolContext) => {
      // Org scoping comes from the ToolContext the runner passes in.
      expect(c.organizationId).toBe('org-carsi');
      if (name === 'context_get_brand') return brand;
      if (name === 'context_get_client_profile') return profile;
      throw new Error(`unexpected tool ${name}`);
    }
  );
}

describe('defaultDeps().loadBrief grounds the brief in org brand data', () => {
  it('carries voice, banned vocabulary, offers and proof points into the brief and the copy prompt', async () => {
    const complete = primeProvider();
    primeContext(
      {
        brandDna: {
          businessName: 'CARSI',
          brandVoice: { tone: 'plain-spoken technical authority' },
          offerings: ['IICRC WRT course'],
        },
        brandOs: null,
      },
      {
        profile: {
          offers: ['Online mould remediation course'],
          proofPoints: ['IICRC-approved school since 2009'],
          toneKeywords: ['practical'],
          antiPatterns: ['fear-mongering'],
          vocabularyBank: { preferred: [], banned: ['guaranteed'] },
        },
      }
    );

    const deps = defaultDeps();
    const brief = await deps.loadBrief('org-carsi', 'mould after floods', ctx);

    expect(executeStudioTool).toHaveBeenCalledWith(
      'context_get_brand',
      {},
      ctx
    );
    expect(executeStudioTool).toHaveBeenCalledWith(
      'context_get_client_profile',
      {},
      ctx
    );
    expect(brief.brandVoice).toContain('plain-spoken technical authority');
    expect(brief.bannedVocabulary).toEqual(
      expect.arrayContaining(['guaranteed', 'fear-mongering'])
    );
    expect(brief.offers).toEqual(
      expect.arrayContaining([
        'Online mould remediation course',
        'IICRC WRT course',
      ])
    );
    expect(brief.facts).toEqual(['IICRC-approved school since 2009']);
    expect(brief.missing).toEqual([]);

    await deps.generateCopy(brief);
    const prompt = complete.mock.calls[0][0].messages
      .map((m: { content: string }) => m.content)
      .join('\n');
    expect(prompt).toContain('plain-spoken technical authority');
    expect(prompt).toContain('guaranteed');
    expect(prompt).toContain('Online mould remediation course');
    expect(prompt).toContain('IICRC-approved school since 2009');
  });

  it('states missing brand data as missing and tells the copywriter not to invent it', async () => {
    const complete = primeProvider();
    primeContext({ brandDna: null, brandOs: null }, { profile: null });

    const deps = defaultDeps();
    const brief = await deps.loadBrief('org-carsi', 'mould after floods', ctx);

    expect(brief.brandVoice).toBeNull();
    expect(brief.facts).toEqual([]);
    expect(brief.missing).toEqual(
      expect.arrayContaining([
        'brand voice',
        'banned vocabulary',
        'offers',
        'proof points',
      ])
    );

    await deps.generateCopy(brief);
    const prompt = complete.mock.calls[0][0].messages
      .map((m: { content: string }) => m.content)
      .join('\n');
    expect(prompt).toMatch(/Brand voice: NOT RECORDED/);
    expect(prompt).toMatch(/Banned vocabulary[^:\n]*: NOT RECORDED/);
    expect(prompt).toMatch(/Offers: NOT RECORDED/);
    expect(prompt).toMatch(/Proof points[^:\n]*: NOT RECORDED/);
    expect(prompt).toMatch(/do not invent/i);
  });
});
