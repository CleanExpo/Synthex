/**
 * 3-Layer Prompt Builder — unit tests (SYN-515)
 *
 * Covers EVERY fallback leg of buildLayeredPrompt:
 *   - Core:   BrandOperatingSystem present (override / composed) vs absent.
 *   - Client: ClientProfile → BrandDNA → OrgContext → none.
 *   - Engage guard: builder returns null (legacy parity) unless a new artifact
 *     (BrandOperatingSystem or ClientProfile) exists.
 */

const mockPrisma = {
  brandOperatingSystem: { findUnique: jest.fn() },
  clientProfile: { findUnique: jest.fn() },
  brandDNA: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import {
  buildLayeredPrompt,
  DEFAULT_CORE_SYSTEM_PROMPT,
} from '@/lib/ai/prompt-layer-builder';

const ORG = 'org-1';

beforeEach(() => {
  // Default every lookup to "not found" — each test opts into the rows it needs.
  mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue(null);
  mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
  mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
  mockPrisma.organization.findUnique.mockResolvedValue(null);
});

describe('buildLayeredPrompt — engage guard (legacy parity)', () => {
  it('returns null systemPrompt when nothing exists at all', async () => {
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.systemPrompt).toBeNull();
    expect(result.core).toBeNull();
    expect(result.client).toBeNull();
    expect(result.clientSource).toBeNull();
    expect(result.task).toBe('post');
  });

  it('does NOT engage on OrgContext alone (no BOS, no ClientProfile)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Acme',
      industry: 'plumbing',
      aiGeneratedData: { suburb: 'Bondi', brandVoice: 'friendly' },
    });
    const result = await buildLayeredPrompt(ORG, 'caption');
    // Client layer resolved to org-context, but builder stays legacy (null).
    expect(result.systemPrompt).toBeNull();
    expect(result.clientSource).toBe('org-context');
    expect(result.client).toContain('Acme');
  });

  it('does NOT engage on BrandDNA alone (no BOS, no ClientProfile)', async () => {
    mockPrisma.brandDNA.findUnique.mockResolvedValue({
      businessName: 'Acme',
      industry: 'plumbing',
      brandVoice: { tone: 'bold' },
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.systemPrompt).toBeNull();
    expect(result.clientSource).toBe('brand-dna');
  });
});

describe('buildLayeredPrompt — Client layer fallback legs', () => {
  it('engages via ClientProfile and uses the default Core', async () => {
    mockPrisma.clientProfile.findUnique.mockResolvedValue({
      icp: { description: 'busy café owners' },
      offers: ['loyalty app'],
      toneKeywords: ['warm', 'direct'],
      antiPatterns: ['jargon'],
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.systemPrompt).not.toBeNull();
    expect(result.core).toBeNull();
    expect(result.systemPrompt).toContain(DEFAULT_CORE_SYSTEM_PROMPT);
    expect(result.clientSource).toBe('client-profile');
    expect(result.systemPrompt).toContain('busy café owners');
    expect(result.systemPrompt).toContain('loyalty app');
    expect(result.systemPrompt).toContain('warm, direct');
    expect(result.systemPrompt).toContain('jargon');
  });

  it('falls to BrandDNA for the Client layer when engaged via Core', async () => {
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
      method: 'STEPPS',
      systemPromptOverride: null,
      rules: ['no hype'],
    });
    mockPrisma.brandDNA.findUnique.mockResolvedValue({
      businessName: 'Acme',
      industry: 'plumbing',
      brandVoice: { tone: 'bold' },
    });
    const result = await buildLayeredPrompt(ORG, 'article');
    expect(result.systemPrompt).not.toBeNull();
    expect(result.clientSource).toBe('brand-dna');
    // Core composed from method + rules
    expect(result.systemPrompt).toContain('Operating method: STEPPS.');
    expect(result.systemPrompt).toContain('Rules: no hype.');
    // Client from BrandDNA
    expect(result.systemPrompt).toContain('creating content for Acme');
    expect(result.systemPrompt).toContain('Brand voice: bold.');
  });

  it('falls to OrgContext for the Client layer when engaged via Core', async () => {
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
      method: '',
      systemPromptOverride: 'CORE OVERRIDE.',
      rules: [],
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Acme',
      industry: 'plumbing',
      aiGeneratedData: { city: 'Sydney', tone: 'expert' },
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.systemPrompt).not.toBeNull();
    expect(result.clientSource).toBe('org-context');
    expect(result.systemPrompt).toContain('CORE OVERRIDE.');
    expect(result.systemPrompt).toContain('creating content for Acme');
    expect(result.systemPrompt).toContain('in Sydney');
    expect(result.systemPrompt).toContain('expert');
  });

  it('engages via Core with NO client source (client leg = null)', async () => {
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
      method: '',
      systemPromptOverride: 'ONLY CORE.',
      rules: [],
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.systemPrompt).toBe('ONLY CORE.');
    expect(result.core).toBe('ONLY CORE.');
    expect(result.client).toBeNull();
    expect(result.clientSource).toBeNull();
  });
});

describe('buildLayeredPrompt — Core layer', () => {
  it('uses systemPromptOverride verbatim as Core when present', async () => {
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
      method: 'ignored',
      systemPromptOverride: '  You are the brand voice of Acme.  ',
      rules: ['ignored'],
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.core).toBe('You are the brand voice of Acme.');
  });

  it('composes Core from method + rules when no override', async () => {
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
      method: 'STEPPS',
      systemPromptOverride: null,
      rules: ['no hype', 'cite sources'],
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.core).toContain(DEFAULT_CORE_SYSTEM_PROMPT);
    expect(result.core).toContain('Operating method: STEPPS.');
    expect(result.core).toContain('Rules: no hype; cite sources.');
  });

  it('appends Core + Client when both a Core override and a ClientProfile exist', async () => {
    mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
      method: '',
      systemPromptOverride: 'CORE.',
      rules: [],
    });
    mockPrisma.clientProfile.findUnique.mockResolvedValue({
      icp: { description: 'café owners' },
      offers: [],
      toneKeywords: [],
      antiPatterns: [],
    });
    const result = await buildLayeredPrompt(ORG, 'post');
    expect(result.clientSource).toBe('client-profile');
    expect(result.systemPrompt).toBe('CORE. Write for this client. Target customer: café owners.');
  });
});
