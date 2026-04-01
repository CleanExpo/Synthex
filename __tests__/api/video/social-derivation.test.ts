/**
 * Unit tests for lib/video/social-derivation.ts
 *
 * Covers:
 *  - deriveAndScheduleSocialPosts(): cascade scheduling, content generation,
 *    fallback on repurposer failure, non-published episode skip
 *  - findEpisodesNeedingSocialDerivation(): null-filter for unprocessed episodes
 *
 * Mock strategy:
 * - @/lib/prisma: videoEpisode.findUnique + update, videoTopicQueue stubs
 * - @/lib/ai/content-repurposer: ContentRepurposer.repurpose() returns fixture data
 * - lib/video/quality-gate: extractVoiceoverFromScript returns fixture string
 * - @/lib/logger: silent mocks
 */

// ── Shared mock objects ────────────────────────────────────────────────────────

const mockRepurpose = jest.fn();
const mockVideoEpisode = {
  findUnique: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockExtractVoiceover = jest.fn<string, [unknown]>();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  prisma: { videoEpisode: mockVideoEpisode },
}));

jest.mock('@/lib/ai/content-repurposer', () => ({
  ContentRepurposer: jest.fn().mockImplementation(() => ({
    repurpose: mockRepurpose,
  })),
}));

jest.mock('@/lib/video/quality-gate', () => ({
  extractVoiceoverFromScript: mockExtractVoiceover,
}));

jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PUBLISHED_EPISODE = {
  id: 'ep-001',
  status: 'published',
  title: 'How Synthex Tracks Google Rankings Autonomously',
  youtubeUrl: 'https://youtu.be/abc123',
  scriptContent: {
    voiceover:
      'In this episode we show how Synthex uses the Google Search Console API.',
    description: 'Autonomous rank tracking explained.',
  },
  series: { slug: 'behind-the-scenes' },
};

const REPURPOSE_RESULT = {
  source: { content: 'voiceover text', type: 'video_transcript' },
  results: [
    { format: 'thread', content: '1/ How Synthex tracks rankings...' },
    {
      format: 'key_takeaways',
      content: '- Real-time data\n- Zero manual work',
    },
    {
      format: 'carousel_outline',
      content: 'Slide 1: Intro\nSlide 2: Features',
    },
    { format: 'summary', content: 'Synthex automates Google rank tracking.' },
    { format: 'video_script', content: 'Scene 1: Dashboard overview...' },
    {
      format: 'quote_graphics',
      content: '"Autonomous ranking means freedom."',
    },
  ],
};

// ── Tests: deriveAndScheduleSocialPosts ───────────────────────────────────────

describe('deriveAndScheduleSocialPosts()', () => {
  let deriveAndScheduleSocialPosts: (
    id: string
  ) => Promise<import('@/lib/video/social-derivation').SocialDerivationResult>;

  beforeAll(() => {
    const mod =
      require('@/lib/video/social-derivation') as typeof import('@/lib/video/social-derivation');
    deriveAndScheduleSocialPosts = mod.deriveAndScheduleSocialPosts;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractVoiceover.mockReturnValue(
      'In this episode we show how Synthex uses the Google Search Console API.'
    );
    mockRepurpose.mockResolvedValue(REPURPOSE_RESULT);
    mockVideoEpisode.findUnique.mockResolvedValue(PUBLISHED_EPISODE);
    mockVideoEpisode.update.mockResolvedValue({});
  });

  it('throws if episode is not found', async () => {
    mockVideoEpisode.findUnique.mockResolvedValue(null);
    await expect(deriveAndScheduleSocialPosts('missing-id')).rejects.toThrow(
      'episode not found'
    );
  });

  it('returns empty dispatched list if episode is not published', async () => {
    mockVideoEpisode.findUnique.mockResolvedValue({
      ...PUBLISHED_EPISODE,
      status: 'held',
    });

    const result = await deriveAndScheduleSocialPosts('ep-001');
    expect(result.dispatched).toHaveLength(0);
    expect(result.skipped).toHaveLength(6); // all 6 platforms skipped
  });

  it('returns empty dispatched list if no voiceover extracted', async () => {
    mockExtractVoiceover.mockReturnValue('');

    const result = await deriveAndScheduleSocialPosts('ep-001');
    expect(result.dispatched).toHaveLength(0);
    expect(result.skipped).toHaveLength(6);
  });

  it('schedules all 6 platforms in waterfall order', async () => {
    const result = await deriveAndScheduleSocialPosts('ep-001');

    expect(result.dispatched).toHaveLength(6);

    const platforms = result.dispatched.map(d => d.platform);
    expect(platforms).toEqual([
      'linkedin',
      'instagram',
      'facebook',
      'twitter',
      'tiktok',
      'pinterest',
    ]);
  });

  it('staggers scheduled times by 30-minute increments', async () => {
    const before = Date.now();
    const result = await deriveAndScheduleSocialPosts('ep-001');

    const times = result.dispatched.map(d => new Date(d.scheduledAt).getTime());

    // Each platform is ~30m after the previous (within 1-minute tolerance)
    for (let i = 1; i < times.length; i++) {
      const diff = times[i] - times[i - 1];
      expect(diff).toBeGreaterThanOrEqual(29 * 60_000);
      expect(diff).toBeLessThanOrEqual(31 * 60_000);
    }

    // First platform (linkedin) is ~30m from now
    expect(times[0]).toBeGreaterThan(before + 29 * 60_000);
    expect(times[0]).toBeLessThan(before + 31 * 60_000);
  });

  it('appends youtube URL suffix to all dispatched content', async () => {
    const result = await deriveAndScheduleSocialPosts('ep-001');

    // contentPreview is first 100 chars. The suffix "\n\nWatch the full video: <url>"
    // is ~47 chars, so it always appears in the preview regardless of content length.
    for (const d of result.dispatched) {
      expect(d.contentPreview).toContain('Watch the full video:');
    }
  });

  it('generates all 6 platform-format pairs on success', async () => {
    const result = await deriveAndScheduleSocialPosts('ep-001');

    // All 6 platforms dispatched with correct formats
    const dispatchedByPlatform = Object.fromEntries(
      result.dispatched.map(d => [d.platform, d.format])
    );
    expect(Object.keys(dispatchedByPlatform)).toHaveLength(6);
    expect(dispatchedByPlatform.linkedin).toBe('key_takeaways');
    expect(dispatchedByPlatform.twitter).toBe('thread');

    // No platforms skipped on success
    expect(result.skipped).toHaveLength(0);
  });

  it('uses voiceover fallback when repurposer fails', async () => {
    mockRepurpose.mockRejectedValue(new Error('AI provider unavailable'));

    const result = await deriveAndScheduleSocialPosts('ep-001');

    // Should still schedule all 6 platforms using voiceover truncated to 280 chars
    expect(result.dispatched).toHaveLength(6);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('repurposer failed'),
      expect.objectContaining({ episodeId: 'ep-001' })
    );
  });

  it('persists socialPosts record to the database', async () => {
    await deriveAndScheduleSocialPosts('ep-001');

    expect(mockVideoEpisode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ep-001' },
        data: expect.objectContaining({
          socialPosts: expect.any(Object),
        }),
      })
    );
  });

  it('assigns correct format to each platform', async () => {
    const result = await deriveAndScheduleSocialPosts('ep-001');

    const byPlatform = Object.fromEntries(
      result.dispatched.map(d => [d.platform, d.format])
    );
    expect(byPlatform.twitter).toBe('thread');
    expect(byPlatform.linkedin).toBe('key_takeaways');
    expect(byPlatform.instagram).toBe('carousel_outline');
    expect(byPlatform.facebook).toBe('summary');
    expect(byPlatform.tiktok).toBe('video_script');
    expect(byPlatform.pinterest).toBe('quote_graphics');
  });
});

// ── Tests: findEpisodesNeedingSocialDerivation ────────────────────────────────

describe('findEpisodesNeedingSocialDerivation()', () => {
  let findEpisodesNeedingSocialDerivation: (
    limit?: number
  ) => Promise<string[]>;

  beforeAll(() => {
    const mod =
      require('@/lib/video/social-derivation') as typeof import('@/lib/video/social-derivation');
    findEpisodesNeedingSocialDerivation =
      mod.findEpisodesNeedingSocialDerivation;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array when no published episodes exist', async () => {
    mockVideoEpisode.findMany.mockResolvedValue([]);

    const ids = await findEpisodesNeedingSocialDerivation();
    expect(ids).toEqual([]);
  });

  it('filters out episodes that already have socialPosts', async () => {
    mockVideoEpisode.findMany.mockResolvedValue([
      { id: 'ep-001', socialPosts: null }, // needs derivation
      { id: 'ep-002', socialPosts: { linkedin: {} } }, // already processed
      { id: 'ep-003', socialPosts: undefined }, // needs derivation
      { id: 'ep-004', socialPosts: null }, // needs derivation
    ]);

    const ids = await findEpisodesNeedingSocialDerivation(5);
    expect(ids).toEqual(['ep-001', 'ep-003', 'ep-004']);
  });

  it('respects the limit parameter', async () => {
    // Returns 15 candidates (3x limit of 5) but only keeps first 5 without socialPosts
    const candidates = Array.from({ length: 15 }, (_, i) => ({
      id: `ep-${String(i).padStart(3, '0')}`,
      socialPosts: null,
    }));
    mockVideoEpisode.findMany.mockResolvedValue(candidates);

    const ids = await findEpisodesNeedingSocialDerivation(5);
    expect(ids).toHaveLength(5);
  });

  it('queries for published episodes with a youtubeVideoId', async () => {
    mockVideoEpisode.findMany.mockResolvedValue([]);

    await findEpisodesNeedingSocialDerivation(5);

    expect(mockVideoEpisode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'published',
          youtubeVideoId: expect.objectContaining({ not: null }),
        }),
      })
    );
  });
});
