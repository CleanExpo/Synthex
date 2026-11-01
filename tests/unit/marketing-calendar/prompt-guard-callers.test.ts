/**
 * Every caller that applies a portfolio brand's rule by organisation id
 * decides membership through portfolioBrandForOrg: an outside org that shares
 * a brand's slug is never refused, a workspace member always is.
 */
jest.mock('@/lib/services/ai/image/spend-log', () =>
  jest.requireActual('../../support/mock-media-quota').mockSpendLog()
);

type Org = {
  id: string;
  slug: string;
  status: string;
  parentOrgId: string | null;
};
let mockOrgs: Org[] = [];
const mockSettings: Record<string, unknown> = {};
// Plain functions: the jest config resets jest.fn implementations per test.
const mockPrisma = {
  organization: {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; slug?: string };
    }) => {
      const org = mockOrgs.find(o =>
        where.id !== undefined ? o.id === where.id : o.slug === where.slug
      );
      return org ? { ...org, settings: mockSettings[org.id] ?? {} } : null;
    },
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));
jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/lib/ai/prompt-layer-builder', () => ({
  ...jest.requireActual('@/lib/ai/prompt-layer-builder'),
  buildLayeredPrompt: async () => ({
    systemPrompt: 'You write short posts for this business.',
  }),
}));
const mockReadFile = jest.fn();
jest.mock('fs/promises', () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
}));

import { AIContentGenerator } from '@/lib/ai/content-generator';
import { getAgencyFoundationContext } from '@/lib/agency/foundation-context';
import {
  ForbiddenPromptError,
  portfolioBrandForOrg,
} from '@/lib/marketing-calendar/prompt-guard';

const root: Org = {
  id: 'org-ug',
  slug: 'unite-group',
  status: 'active',
  parentOrgId: null,
};
const carsi: Org = {
  id: 'org-carsi',
  slug: 'carsi',
  status: 'active',
  parentOrgId: 'org-ug',
};
const outsideUg: Org = { ...root, id: 'org-other', parentOrgId: 'other-root' };
const outsideCarsi: Org = { ...carsi, parentOrgId: 'other-root' };
const FORBIDDEN = 'Promote CARSI courses';

beforeEach(() => {
  mockOrgs = [root, carsi];
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
  mockReadFile.mockResolvedValue('Plain foundation notes.');
});

describe('portfolioBrandForOrg', () => {
  it('gives the brand for the root and an active child', async () => {
    expect((await portfolioBrandForOrg(mockPrisma, 'org-ug'))?.orgSlug).toBe(
      'unite-group'
    );
    expect((await portfolioBrandForOrg(mockPrisma, 'org-carsi'))?.orgSlug).toBe(
      'carsi'
    );
  });

  it('gives no brand to an outside org that shares a brand slug', async () => {
    mockOrgs = [root, outsideCarsi];
    expect(await portfolioBrandForOrg(mockPrisma, 'org-carsi')).toBeUndefined();
    mockOrgs = [outsideUg];
    expect(await portfolioBrandForOrg(mockPrisma, 'org-other')).toBeUndefined();
  });
});

describe('content generation', () => {
  const call = (orgId: string, prompt: string) => {
    const complete = jest.fn(async () => ({
      choices: [{ message: { content: 'A draft.' } }],
    }));
    const gen = new AIContentGenerator() as unknown as {
      callAI(...a: unknown[]): Promise<string>;
    };
    return {
      complete,
      run: gen.callAI(
        prompt,
        'model',
        { complete },
        undefined,
        null,
        orgId,
        'content'
      ),
    };
  };

  it('refuses a workspace member prompt that names a forbidden word', async () => {
    const { complete, run } = call('org-ug', FORBIDDEN);
    await expect(run).rejects.toThrow(ForbiddenPromptError);
    expect(complete).not.toHaveBeenCalled();
  });

  it('generates for an outside org with the Unite Group slug', async () => {
    mockOrgs = [outsideUg];
    const { complete, run } = call('org-other', FORBIDDEN);
    await expect(run).resolves.toBe('A draft.');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('generates for an outside org with a child brand slug', async () => {
    mockOrgs = [root, outsideCarsi];
    const { run } = call('org-carsi', 'IICRC courses for technicians');
    await expect(run).resolves.toBe('A draft.');
  });
});

describe('agency foundation context', () => {
  it('refuses a workspace member whose settings name a forbidden word', async () => {
    mockSettings['org-ug'] = { voiceTag: FORBIDDEN };
    await expect(getAgencyFoundationContext('org-ug')).rejects.toThrow(
      ForbiddenPromptError
    );
  });

  it('withholds a forbidden excerpt from a workspace member', async () => {
    mockReadFile.mockResolvedValue(FORBIDDEN);
    const ctx = await getAgencyFoundationContext('org-ug');
    expect(ctx.ceoFoundationExcerpt).toMatch(/withheld/);
  });

  it('loads normally for an outside org that shares a brand slug', async () => {
    mockOrgs = [outsideUg];
    mockSettings['org-other'] = { voiceTag: FORBIDDEN };
    mockReadFile.mockResolvedValue(FORBIDDEN);
    const ctx = await getAgencyFoundationContext('org-other');
    expect(ctx.voiceTag).toBe(FORBIDDEN);
    expect(ctx.ceoFoundationExcerpt).toBe(FORBIDDEN);
  });
});
