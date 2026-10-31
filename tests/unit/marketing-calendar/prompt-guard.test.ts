/**
 * The Unite-Group content rule is checked on the finished prompt, at the
 * point it goes to the model, instead of on stored fields one by one:
 *   - the content generator refuses a prompt that names an owned business;
 *   - the foundation context refuses an org setting that does;
 *   - the approved "avoid" list a prompt carries never trips the check.
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

import { AIContentGenerator } from '@/lib/ai/content-generator';
import type { AIProvider } from '@/lib/ai/providers';
import { getAgencyFoundationContext } from '@/lib/agency/foundation-context';
import {
  ForbiddenPromptError,
  assertPromptClean,
  promptHits,
} from '@/lib/marketing-calendar/prompt-guard';
import { PORTFOLIO_BRANDS } from '@/lib/marketing-calendar/portfolio-brands';

const ug = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'unite-group')!;

function makeClient() {
  const complete = jest.fn(async () => ({
    choices: [{ message: { content: 'ok' } }],
  }));
  return { client: { complete } as unknown as AIProvider, complete };
}

function callAI(gen: AIContentGenerator, ...args: unknown[]): Promise<string> {
  return (
    gen as unknown as { callAI: (...a: unknown[]) => Promise<string> }
  ).callAI(...args);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue(null);
  mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
  mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
  mockPrisma.organization.findUnique.mockResolvedValue({
    slug: 'unite-group',
    name: 'Unite Group',
    industry: 'Business services',
    aiGeneratedData: null,
    settings: {},
  });
});

describe('content generator', () => {
  it('refuses a Unite-Group prompt that names an owned business, calling no model', async () => {
    const { client, complete } = makeClient();
    await expect(
      callAI(
        new AIContentGenerator(),
        'Write about CARSI courses',
        'm',
        client,
        undefined,
        null,
        'org-ug',
        'post'
      )
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
    expect(complete).not.toHaveBeenCalled();
  });

  it('refuses when the forbidden words come from the org itself (system prompt)', async () => {
    const orgContext = {
      businessName: 'Unite Group',
      industry: 'Business services',
      location: null,
      brandVoice: 'Promote the RestoreAssist app',
    };
    const { client, complete } = makeClient();
    await expect(
      callAI(
        new AIContentGenerator(),
        'Write a post about cafes',
        'm',
        client,
        undefined,
        orgContext,
        'org-ug',
        'post'
      )
    ).rejects.toBeInstanceOf(ForbiddenPromptError);
    expect(complete).not.toHaveBeenCalled();
  });

  it('sends a clean Unite-Group prompt', async () => {
    const { client, complete } = makeClient();
    await callAI(
      new AIContentGenerator(),
      'Write a post about a local cafe',
      'm',
      client,
      undefined,
      null,
      'org-ug',
      'post'
    );
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('leaves orgs outside the portfolio alone', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      slug: 'some-client',
      name: 'Some Client',
      industry: null,
      aiGeneratedData: null,
      settings: {},
    });
    const { client, complete } = makeClient();
    await callAI(
      new AIContentGenerator(),
      'Write about CARSI courses',
      'm',
      client,
      undefined,
      null,
      'org-x',
      'post'
    );
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe('foundation context', () => {
  it('refuses a Unite-Group setting that names an owned business', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      slug: 'unite-group',
      settings: { voiceTag: 'Promote CARSI courses' },
    });
    await expect(getAgencyFoundationContext('org-ug')).rejects.toBeInstanceOf(
      ForbiddenPromptError
    );
  });

  it('passes clean settings', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      slug: 'unite-group',
      settings: { voiceTag: 'Plain and warm' },
    });
    await expect(getAgencyFoundationContext('org-ug')).resolves.toMatchObject({
      voiceTag: 'Plain and warm',
    });
  });
});

describe('promptHits', () => {
  it.each(PORTFOLIO_BRANDS.map(b => [b.orgSlug, b] as const))(
    "%s: the approved client profile renders a prompt clear of the brand's own forbidden words",
    (_, b) => {
      const text = [
        `Target customer: ${b.audience.description}.`,
        `Offers: ${b.offerings.join(', ')}.`,
        `Tone: ${b.voice.tone.join(', ')}.`,
        `Avoid: ${b.antiPatterns.join(', ')}.`,
      ].join(' ');
      expect(promptHits(text, b)).toEqual([]);
    }
  );

  it("exempts only the brand's own name, not the same words elsewhere", () => {
    const bc = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'business-card')!;
    expect(promptHits(`${bc.name}: one link that opens a film.`, bc)).toEqual(
      []
    );
    expect(promptHits('One group business launched this.', bc)).toEqual([
      'group business',
    ]);
  });

  it('catches a forbidden word anywhere in the prompt', () => {
    expect(promptHits('Avoid: nothing. Feature CARSI weekly.', ug)).toEqual([
      'CARSI',
    ]);
  });

  it('throws only for portfolio brands', () => {
    expect(() => assertPromptClean('unite-group', ['CARSI'])).toThrow(
      ForbiddenPromptError
    );
    expect(() => assertPromptClean('some-client', ['CARSI'])).not.toThrow();
    expect(() => assertPromptClean(undefined, ['CARSI'])).not.toThrow();
  });
});
