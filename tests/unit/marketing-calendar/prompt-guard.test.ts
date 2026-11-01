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
  assertCalendarPostClean,
  assertStoredCalendarPostCleanForOrg,
  assertPromptClean,
  promptHits,
} from '@/lib/marketing-calendar/prompt-guard';
import {
  PORTFOLIO_BRANDS,
  copyHits,
  sameGap,
  forbiddenHits,
} from '@/lib/marketing-calendar/portfolio-brands';

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
    id: 'org-ug',
    slug: 'unite-group',
    status: 'active',
    parentOrgId: null,
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
      id: 'org-ug',
      slug: 'unite-group',
      status: 'active',
      parentOrgId: null,
      settings: { voiceTag: 'Promote CARSI courses' },
    });
    await expect(getAgencyFoundationContext('org-ug')).rejects.toBeInstanceOf(
      ForbiddenPromptError
    );
  });

  it('refuses a non-string setting that names an owned business', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-ug',
      slug: 'unite-group',
      status: 'active',
      parentOrgId: null,
      settings: { voiceTag: { message: 'Promote CARSI courses' } },
    });
    await expect(getAgencyFoundationContext('org-ug')).rejects.toBeInstanceOf(
      ForbiddenPromptError
    );
  });

  it('hands a portfolio brand no foundation text that names its forbidden words', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-ug',
      slug: 'unite-group',
      status: 'active',
      parentOrgId: null,
      settings: { voiceTag: 'Plain and warm' },
    });
    const ctx = await getAgencyFoundationContext('org-ug');
    expect(promptHits(JSON.stringify(ctx), ug)).toEqual([]);
  });

  it('keeps the full foundation for orgs outside the portfolio', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      slug: 'some-client',
      settings: {},
    });
    const ctx = await getAgencyFoundationContext('org-x');
    expect(ctx.verificationGatesExcerpt).not.toMatch(/withheld/);
  });

  it('passes clean settings', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 'org-ug',
      slug: 'unite-group',
      status: 'active',
      parentOrgId: null,
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

  it.each([
    'Unite-Group built a new tool this week',
    'Unite Group built a new tool this week',
    'Unite-Group businesses grew',
  ])('keeps a forbidden phrase that overlaps the brand name: %s', text => {
    expect(promptHits(text, ug)).not.toEqual([]);
  });

  it("allows only the brand's listed approved phrases", () => {
    expect(
      promptHits('Our business cards make sharing easier for cafes.', ug)
    ).toEqual([]);
    expect(promptHits('Our business built this app.', ug)).toEqual([
      'our business',
    ]);
    // Nothing is inferred from offerings: NRPG's offering does not admit it.
    const nrpg = PORTFOLIO_BRANDS.find(b => b.orgSlug === 'nrpg')!;
    expect(promptHits('Partner contractor network membership', nrpg)).toEqual([
      'Partner contractor',
    ]);
  });

  it.each(PORTFOLIO_BRANDS.map(b => [b.orgSlug, b] as const))(
    '%s: a forbidden phrase running into an offering still counts',
    (_, b) => {
      const allowed = [b.name, ...(b.approvedPhrases ?? [])];
      for (const word of b.forbiddenWords) {
        // A word the brand's own name or approved phrases cover never counts.
        if (forbiddenHits(word, [word], allowed).length === 0) continue;
        for (const offering of b.offerings) {
          expect(copyHits(`${word} ${offering}`, b)).toContain(word);
        }
      }
    }
  );

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

describe('assertCalendarPostClean', () => {
  const clean = {
    title: 'Cafe tips',
    content: 'A week of tips for local cafes',
    hashtags: ['#smallbusiness'],
    mentions: [],
    metadata: { videoDelivery: { captionDraft: 'Tips for cafes' } },
  };

  it('passes a clean draft, ignoring machine fields in metadata', () => {
    expect(() => assertCalendarPostClean('unite-group', clean)).not.toThrow();
    expect(() =>
      assertCalendarPostClean('unite-group', {
        ...clean,
        metadata: { brandRules: ['Never name CARSI'], source: 'portfolio' },
      })
    ).not.toThrow();
  });

  it.each([
    ['title', { title: 'CARSI week' }],
    ['content', { content: 'Promote CARSI courses' }],
    ['hashtag', { hashtags: ['#CARSI'] }],
    ['mention', { mentions: ['CARSI'] }],
    [
      'delivered caption',
      { metadata: { videoDelivery: { captionDraft: 'Learn with CARSI' } } },
    ],
  ])('refuses a forbidden word in the %s', (_, part) => {
    expect(() =>
      assertCalendarPostClean('unite-group', { ...clean, ...part })
    ).toThrow(ForbiddenPromptError);
  });

  it.each(PORTFOLIO_BRANDS.map(b => [b.orgSlug, b] as const))(
    '%s: an anti-pattern line written into a draft is still a mention',
    (_, b) => {
      for (const line of b.antiPatterns) {
        const hits = forbiddenHits(line, b.forbiddenWords, [b.name]);
        if (hits.length === 0) continue;
        expect(() =>
          assertCalendarPostClean(b.orgSlug, { content: line })
        ).toThrow(ForbiddenPromptError);
      }
    }
  );

  it('refuses the anti-pattern exemption case the review found', () => {
    expect(() =>
      assertCalendarPostClean('business-card', {
        content: 'Claiming save-to-contacts or NFC before it is shown working',
      })
    ).toThrow(ForbiddenPromptError);
  });

  it.each([
    ['content', { content: 'Partner contractor network membership' }],
    [
      'delivered caption',
      {
        metadata: {
          videoDelivery: {
            captionDraft: 'Partner contractor network membership',
          },
        },
      },
    ],
  ])('refuses the NRPG offering overlap in the %s', (_, part) => {
    expect(() => assertCalendarPostClean('nrpg', part)).toThrow(
      ForbiddenPromptError
    );
  });

  it.each([
    [
      'across a sentence break',
      { content: 'Our business. Card payments are easier for cafes' },
    ],
    [
      'across title and content',
      { title: 'Our business', content: 'Card payments are easier for cafes' },
    ],
    [
      'across title and caption',
      {
        title: 'Our business',
        metadata: { videoDelivery: { captionDraft: 'Card tips' } },
      },
    ],
    [
      'across title and hashtag',
      { title: 'Our business', hashtags: ['#card'] },
    ],
    ['across title and mention', { title: 'Our business', mentions: ['card'] }],
  ])('never builds an approved phrase %s', (_, post) => {
    expect(() => assertCalendarPostClean('unite-group', post)).toThrow(
      ForbiddenPromptError
    );
  });

  it('never builds a forbidden phrase from two fields', () => {
    expect(() =>
      assertCalendarPostClean('unite-group', {
        title: 'Our',
        content: 'Business tips for cafes',
      })
    ).not.toThrow();
  });

  it.each([
    ['a carriage return', 'Our business\rCard payments are easier for cafes'],
    [
      'a line separator',
      'Our business\u2028Card payments are easier for cafes',
    ],
    [
      'a paragraph separator',
      'Our business\u2029Card payments are easier for cafes',
    ],
    ['a comma', 'Our business, card payments are easier for cafes'],
    ['a colon', 'Our business: card payments are easier for cafes'],
    ['a spaced dash', 'Our business - card payments are easier for cafes'],
    ['an em dash', 'Our business\u2014card payments are easier for cafes'],
    ['two hyphens', 'Our business--card payments are easier for cafes'],
  ])('never builds an approved phrase across %s', (_, content) => {
    expect(() => assertCalendarPostClean('unite-group', { content })).toThrow(
      ForbiddenPromptError
    );
  });

  it.each([
    'Our business cards make sharing easier for cafes.',
    'Our business  card, made for cafes.',
    'Our business\tcard for cafes.',
    'Our business-card for cafes.',
    'Our\u00a0business card for cafes.',
  ])(
    'passes the approved phrase joined only by spaces or a hyphen: %s',
    content => {
      expect(() =>
        assertCalendarPostClean('unite-group', { content })
      ).not.toThrow();
    }
  );

  it('reads gaps the way exempt phrases are written', () => {
    expect(sameGap(' ', '-')).toBe(true);
    expect(sameGap(' (', ' (')).toBe(true);
    expect(sameGap('\r', ' ')).toBe(false);
    expect(sameGap(', ', ' ')).toBe(false);
    expect(sameGap('\r(', ' (')).toBe(false);
  });

  it('passes a Unite Group draft about its own video business cards', () => {
    expect(() =>
      assertCalendarPostClean('unite-group', {
        title: 'Video business cards',
        content: 'Our business cards make sharing easier for cafes.',
      })
    ).not.toThrow();
  });

  it('leaves orgs outside the portfolio unchecked', () => {
    expect(() =>
      assertCalendarPostClean('some-cafe', { content: 'Promote CARSI courses' })
    ).not.toThrow();
  });

  describe('by organisation id', () => {
    const root = {
      id: 'org-ug',
      slug: 'unite-group',
      status: 'active',
      parentOrgId: null as string | null,
    };
    // The locked reads: one share-locked query for the org and the root,
    // then the stored draft row, which must be locked for update.
    const lookup = (
      orgs: Array<typeof root>,
      stored: Record<string, unknown>[] = []
    ) =>
      ({
        $queryRaw: jest.fn(
          async (sql: TemplateStringsArray, id: string, rootSlug: string) => {
            const text = sql.join('?');
            if (text.includes('calendar_posts')) {
              if (!/FOR UPDATE/.test(text))
                throw new Error('stored row read without FOR UPDATE');
              return stored.filter(r => r.id === id);
            }
            return orgs.filter(o => o.id === id || o.slug === rootSlug);
          }
        ),
      }) as unknown as Parameters<
        typeof assertStoredCalendarPostCleanForOrg
      >[0] & {
        $queryRaw: jest.Mock;
      };
    const check = (
      db: ReturnType<typeof lookup>,
      orgId: string,
      change: Record<string, unknown>
    ) => assertStoredCalendarPostCleanForOrg(db, orgId, 'post-1', change);
    const draft = { content: 'IICRC courses for technicians' };
    const carsi = {
      ...root,
      id: 'org-carsi',
      slug: 'carsi',
      parentOrgId: 'org-ug',
    };

    it('checks the workspace root itself', async () => {
      await expect(
        check(lookup([root]), 'org-ug', {
          content: 'Promote CARSI courses',
        })
      ).rejects.toThrow(ForbiddenPromptError);
    });

    it('checks an active child of the workspace', async () => {
      const db = lookup([root, carsi]);
      await expect(
        check(db, 'org-carsi', {
          content: 'IICRC courses for technicians',
        })
      ).rejects.toThrow(ForbiddenPromptError);
      const [sql, id, rootSlug] = db.$queryRaw.mock.calls[0];
      expect(sql.join('?')).toMatch(/FOR SHARE/);
      expect([id, rootSlug]).toEqual(['org-carsi', 'unite-group']);
      // The org and root first, then the stored row: one order everywhere.
      const [rowSql, rowId] = db.$queryRaw.mock.calls[1];
      expect(rowSql.join('?')).toMatch(/FROM calendar_posts[\s\S]*FOR UPDATE/);
      expect(rowId).toBe('post-1');
    });

    it('refuses a one-field write to a stored draft whose other copy is forbidden', async () => {
      const stored = [
        { id: 'post-1', title: 'CARSI courses', content: 'Tips' },
      ];
      await expect(
        check(lookup([root], stored), 'org-ug', {
          metadata: { videoDelivery: { captionDraft: 'Tips for cafes' } },
        })
      ).rejects.toThrow(ForbiddenPromptError);
    });

    it('lets a write replace the forbidden stored field it sets', async () => {
      const stored = [
        { id: 'post-1', title: 'CARSI courses', content: 'Tips' },
      ];
      await expect(
        check(lookup([root], stored), 'org-ug', { title: 'Tips for cafes' })
      ).resolves.toEqual(stored[0]);
    });

    it('checks only the change for a new draft with no stored row', async () => {
      await expect(
        check(lookup([root]), 'org-ug', { content: 'Tips for cafes' })
      ).resolves.toBeUndefined();
    });

    it.each([
      [
        'outside the workspace',
        [root, { ...carsi, parentOrgId: 'other-root' }],
      ],
      ['an inactive child', [root, { ...carsi, status: 'deleted' }]],
      ['under an inactive root', [{ ...root, status: 'deleted' }, carsi]],
      [
        'under a root that has a parent',
        [{ ...root, parentOrgId: 'x' }, carsi],
      ],
      ['with no workspace root at all', [carsi]],
    ])('leaves an org with a brand slug %s unchecked', async (_, orgs) => {
      await expect(
        check(lookup(orgs), 'org-carsi', {
          content: 'IICRC courses for technicians',
        })
      ).resolves.toBeUndefined();
    });

    it('leaves the outside-workspace slug collision the review found unchecked', async () => {
      await expect(
        check(
          lookup([root, { ...carsi, parentOrgId: 'other-root' }]),
          'org-carsi',
          draft
        )
      ).resolves.toBeUndefined();
    });
  });
});
