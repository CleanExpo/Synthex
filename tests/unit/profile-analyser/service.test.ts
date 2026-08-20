const mockRunActor = jest.fn();

jest.mock('@/lib/auto-research/apify/client', () => ({
  runActor: (...args: unknown[]) => mockRunActor(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

import { analyseProfile } from '@/lib/profile-analyser/service';

describe('analyseProfile', () => {
  const ORIGINAL_TOKEN = process.env.APIFY_API_TOKEN;

  beforeEach(() => {
    mockRunActor.mockReset();
    process.env.APIFY_API_TOKEN = 'test-apify-token';
  });

  afterAll(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = ORIGINAL_TOKEN;
  });

  it('throws when the Apify token is missing', async () => {
    delete process.env.APIFY_API_TOKEN;
    await expect(
      analyseProfile({
        platform: 'linkedin',
        profileUrl: 'https://www.linkedin.com/in/ada',
      })
    ).rejects.toThrow(/APIFY_API_TOKEN/);
    expect(mockRunActor).not.toHaveBeenCalled();
  });

  it('falls back to the second LinkedIn actor when the first returns empty', async () => {
    mockRunActor
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          fullName: 'Ada Lovelace',
          headline: 'Mathematician',
          followersCount: 1200,
          connectionsCount: 500,
          posts: [
            {
              text: 'Analytical engines change computing forever',
              totalReactionCount: 20,
              commentsCount: 4,
              type: 'text',
            },
            {
              text: 'Computing notes on the analytical engine',
              totalReactionCount: 8,
              commentsCount: 1,
              type: 'text',
            },
          ],
        },
      ]);

    const result = await analyseProfile({
      platform: 'linkedin',
      profileUrl: 'https://www.linkedin.com/in/ada',
    });

    expect(mockRunActor).toHaveBeenCalledTimes(2);
    expect(mockRunActor.mock.calls[0][0]).toBe(
      'harvestapi/linkedin-profile-scraper'
    );
    expect(mockRunActor.mock.calls[1][0]).toBe(
      'dev_fusion/linkedin-profile-scraper'
    );
    expect(result.displayName).toBe('Ada Lovelace');
    expect(result.postsAnalysed).toBe(2);
    expect(result.content.primaryTopics.map(t => t.toLowerCase())).toEqual(
      expect.arrayContaining(['analytical', 'computing'])
    );
    expect(result.score.overall).toBeGreaterThan(0);
  });

  it('scrapes Facebook posts and derives page identity from the dataset', async () => {
    mockRunActor.mockResolvedValueOnce([
      {
        pageName: 'RestoreAssist',
        pageFollowers: 2400,
        text: 'Storm restoration in Brisbane this week',
        likes: 30,
        comments: 4,
        type: 'photo',
      },
      {
        pageName: 'RestoreAssist',
        text: 'Brisbane restoration crew on another storm job',
        likes: 12,
        comments: 1,
        type: 'video',
      },
    ]);

    const result = await analyseProfile({
      platform: 'facebook',
      profileUrl: 'https://www.facebook.com/restoreassist',
    });

    expect(mockRunActor.mock.calls[0][0]).toBe('apify/facebook-posts-scraper');
    expect(result.displayName).toBe('RestoreAssist');
    expect(result.followersCount).toBe(2400);
    expect(result.engagement.topPostType).toMatch(/image|video/);
    expect(result.content.primaryTopics.map(t => t.toLowerCase())).toEqual(
      expect.arrayContaining(['brisbane', 'restoration', 'storm'])
    );
  });
});
