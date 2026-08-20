import {
  extractHashtags,
  extractPrimaryTopics,
} from '@/lib/profile-analyser/topics';

describe('extractPrimaryTopics', () => {
  it('ranks words that repeat across posts and skips stopwords', () => {
    const topics = extractPrimaryTopics([
      'The restoration team in Brisbane completed a flood job',
      'Brisbane flood restoration starts with drying the structure',
      'Our Brisbane crew handles restoration after every flood',
    ]);

    expect(topics.map(t => t.toLowerCase())).toEqual(
      expect.arrayContaining(['brisbane', 'restoration', 'flood'])
    );
    expect(topics.map(t => t.toLowerCase())).not.toContain('the');
    expect(topics.length).toBeGreaterThanOrEqual(3);
  });

  it('returns an empty list when nothing distinctive repeats', () => {
    expect(extractPrimaryTopics(['Hello there', 'Good morning'])).toEqual([]);
  });
});

describe('extractHashtags', () => {
  it('counts hashtags case-insensitively', () => {
    const tags = extractHashtags([
      'Win with #LocalSEO and #Restoration',
      'Another #localseo post',
    ]);
    expect(tags[0]).toBe('#localseo');
    expect(tags).toContain('#restoration');
  });
});
