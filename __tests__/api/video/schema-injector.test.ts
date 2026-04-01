/**
 * Unit tests for lib/video/schema-injector.ts
 *
 * Covers:
 *  - buildVideoObjectSchema(): correct JSON-LD shape, ISO 8601 duration,
 *    E.E.A.T. publisher + author signals
 *  - renderSchemaTag(): valid <script> tag output
 *  - injectVideoSchema(): persists to DB via injected prisma client
 *
 * All functions are pure or have injectable dependencies — no network calls.
 */

import {
  buildVideoObjectSchema,
  renderSchemaTag,
  injectVideoSchema,
} from '@/lib/video/schema-injector';

// ts-jest does NOT apply babel's mock-variable TDZ bypass.
// Inline the factory and use jest.requireMock() to access the mocked logger.
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  title: 'Ep 1: How Synthex Tracks Google Rankings Autonomously',
  description:
    'We reveal the autonomous rank tracking engine powering Synthex marketing dashboards.',
  thumbnailUrl: 'https://synthex.social/thumbnails/ep-1.jpg',
  uploadDate: new Date('2026-03-11T00:00:00Z'),
  durationSeconds: 480, // 8 minutes
  contentUrl: 'https://youtu.be/abc123',
  embedUrl: 'https://www.youtube.com/embed/abc123',
  authorName: 'Phill McGurk',
  keywords: ['rank tracking', 'AI marketing', 'SEO automation'],
};

// ── Tests: buildVideoObjectSchema ─────────────────────────────────────────────

describe('buildVideoObjectSchema()', () => {
  it('produces a valid VideoObject JSON-LD structure', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('VideoObject');
  });

  it('sets name and description from input', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.name).toBe(BASE_INPUT.title);
    expect(schema.description).toBe(BASE_INPUT.description);
  });

  it('formats durationSeconds as ISO 8601 PT string', () => {
    // 480 seconds = 8 minutes, 0 seconds → ISO 8601 omits trailing "0S"
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.duration).toBe('PT8M');
  });

  it('formats edge-case durations correctly', () => {
    // 3661 seconds = 1h 1m 1s
    const schema = buildVideoObjectSchema({
      ...BASE_INPUT,
      durationSeconds: 3661,
    });
    expect(schema.duration).toBe('PT1H1M1S');
  });

  it('omits duration when durationSeconds is not provided', () => {
    const { durationSeconds: _omit, ...inputWithoutDuration } = BASE_INPUT;
    const schema = buildVideoObjectSchema(inputWithoutDuration);
    expect(schema.duration).toBeUndefined();
  });

  it('includes contentUrl and embedUrl', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.contentUrl).toBe(BASE_INPUT.contentUrl);
    expect(schema.embedUrl).toBe(BASE_INPUT.embedUrl);
  });

  it('sets keywords as comma-joined string', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.keywords).toBe('rank tracking, AI marketing, SEO automation');
  });

  it('uses default thumbnail when not provided', () => {
    const { thumbnailUrl: _omit, ...inputWithoutThumb } = BASE_INPUT;
    const schema = buildVideoObjectSchema(inputWithoutThumb);
    expect(typeof schema.thumbnailUrl).toBe('string');
    expect(schema.thumbnailUrl as string).toContain('synthex.social');
  });

  it('includes E.E.A.T. publisher Organization schema', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);

    expect(schema.publisher['@type']).toBe('Organization');
    expect(schema.publisher.name).toBe('Synthex');
    expect(schema.publisher.url).toBe('https://synthex.social');
    expect(schema.publisher.logo['@type']).toBe('ImageObject');
    expect(schema.publisher.logo.width).toBeGreaterThan(0);
  });

  it('includes E.E.A.T. author Person schema', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);

    expect(schema.author?.['@type']).toBe('Person');
    expect(schema.author?.name).toBe('Phill McGurk');
    expect(schema.author?.jobTitle).toBe('Founder & CEO');
    expect(schema.author?.worksFor?.['@type']).toBe('Organization');
    expect(schema.author?.worksFor?.name).toBe('Synthex');
    expect(schema.author?.sameAs).toBeInstanceOf(Array);
    expect(schema.author?.sameAs.length).toBeGreaterThan(0);
    // Must include LinkedIn or YouTube for E.E.A.T.
    expect(
      schema.author?.sameAs.some(
        (s: string) => s.includes('linkedin') || s.includes('youtube')
      )
    ).toBe(true);
  });

  it('sets inLanguage to en-AU', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.inLanguage).toBe('en-AU');
  });

  it('sets isFamilyFriendly to true', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.isFamilyFriendly).toBe(true);
  });

  it('sets potentialAction WatchAction', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.potentialAction['@type']).toBe('WatchAction');
    expect(typeof schema.potentialAction.target).toBe('string');
    expect(schema.potentialAction.target).toBeTruthy();
  });

  it('uploadDate is ISO string representation of input date', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    expect(schema.uploadDate).toBe(BASE_INPUT.uploadDate.toISOString());
  });
});

// ── Tests: renderSchemaTag ────────────────────────────────────────────────────

describe('renderSchemaTag()', () => {
  it('wraps schema in a <script type="application/ld+json"> tag', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    const tag = renderSchemaTag(schema);

    expect(tag).toMatch(/<script type="application\/ld\+json">/);
    expect(tag).toContain('</script>');
  });

  it('contains valid JSON that round-trips correctly', () => {
    const schema = buildVideoObjectSchema(BASE_INPUT);
    const tag = renderSchemaTag(schema);

    // Extract JSON between the tags
    const json = tag
      .replace(/<script[^>]*>/, '')
      .replace(/<\/script>/, '')
      .trim();

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['@type']).toBe('VideoObject');
  });
});

// ── Tests: injectVideoSchema ──────────────────────────────────────────────────

describe('injectVideoSchema()', () => {
  it('calls prisma.videoEpisode.update with the built schema', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({});
    const fakePrisma = { videoEpisode: { update: mockUpdate } };

    await injectVideoSchema('ep-001', BASE_INPUT, fakePrisma);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ep-001' },
        data: expect.objectContaining({
          videoObjectSchema: expect.objectContaining({
            '@type': 'VideoObject',
          }),
        }),
      })
    );
  });

  it('returns the built schema', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({});
    const fakePrisma = { videoEpisode: { update: mockUpdate } };

    const schema = await injectVideoSchema('ep-001', BASE_INPUT, fakePrisma);
    expect(schema['@type']).toBe('VideoObject');
    expect(schema.name).toBe(BASE_INPUT.title);
  });

  it('logs the injection', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({});
    const fakePrisma = { videoEpisode: { update: mockUpdate } };

    await injectVideoSchema('ep-001', BASE_INPUT, fakePrisma);

    // Access logger mock via jest.requireMock to avoid ts-jest TDZ issues
    const { logger } = jest.requireMock('@/lib/logger') as {
      logger: { info: jest.Mock };
    };
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('VideoObject schema saved'),
      expect.objectContaining({ episodeId: 'ep-001' })
    );
  });
});
