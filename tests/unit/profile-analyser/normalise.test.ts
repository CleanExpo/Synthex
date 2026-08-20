import {
  classifyPostType,
  normaliseFacebookItems,
  normaliseLinkedInItems,
  normalisePost,
  pickNumber,
  pickString,
} from '@/lib/profile-analyser/normalise';

describe('pick helpers', () => {
  it('picks the first finite number and parses comma-formatted strings', () => {
    expect(pickNumber(undefined, '1,250', 3)).toBe(1250);
    expect(pickNumber(null, NaN)).toBe(0);
  });

  it('picks the first non-empty string', () => {
    expect(pickString('', '  Ada Lovelace  ', 'ignored')).toBe('Ada Lovelace');
  });
});

describe('classifyPostType', () => {
  it('maps media hints onto text/image/video/link', () => {
    expect(classifyPostType({ type: 'LinkedInVideo' })).toBe('video');
    expect(classifyPostType({ images: ['https://img'] })).toBe('image');
    expect(classifyPostType({ articleUrl: 'https://x.com' })).toBe('link');
    expect(classifyPostType({ text: 'hello' })).toBe('text');
  });
});

describe('normalisePost', () => {
  it('reads LinkedIn reaction fields', () => {
    const post = normalisePost({
      text: 'A useful post',
      totalReactionCount: 12,
      commentsCount: 3,
      repostsCount: 1,
      postedAt: '2026-08-01',
      type: 'image',
    });
    expect(post).toMatchObject({
      text: 'A useful post',
      likes: 12,
      comments: 3,
      shares: 1,
      type: 'image',
    });
  });
});

describe('normaliseLinkedInItems', () => {
  it('reads nested posts from a harvestapi-style profile', () => {
    const profile = normaliseLinkedInItems([
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        headline: 'Mathematician',
        followerCount: 900,
        connectionsCount: 400,
        posts: [
          { commentary: 'Analytical engines', likesCount: 8, commentsCount: 1 },
          { text: 'Notes on Bernoulli', totalReactionCount: 4 },
        ],
      },
    ]);
    expect(profile.displayName).toBe('Ada Lovelace');
    expect(profile.headline).toBe('Mathematician');
    expect(profile.followers).toBe(900);
    expect(profile.connections).toBe(400);
    expect(profile.posts).toHaveLength(2);
  });
});

describe('normaliseFacebookItems', () => {
  it('treats a posts-scraper dataset as a page plus posts', () => {
    const profile = normaliseFacebookItems([
      {
        pageName: 'Coca-Cola',
        pageFollowers: 11000,
        text: 'Taste the feeling',
        likes: 40,
        comments: 2,
        time: '2026-08-01',
      },
      {
        pageName: 'Coca-Cola',
        text: 'Share a coke',
        likesCount: 12,
      },
    ]);
    expect(profile.displayName).toBe('Coca-Cola');
    expect(profile.followers).toBe(11000);
    expect(profile.posts).toHaveLength(2);
  });
});
