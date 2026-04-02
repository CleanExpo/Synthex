/**
 * Unit tests — Content Intelligence Topic Extractor (SYN-631)
 *
 * Covers:
 *  - classifyPosts: returns fallback when OPENROUTER_API_KEY missing
 *  - classifyPosts: parses valid Claude Haiku JSON response
 *  - classifyPosts: falls back gracefully on fetch error
 *  - classifyPosts: falls back gracefully on malformed JSON response
 *  - classifyPosts: processes large batches in chunks of 20
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { classifyPosts } from '@/lib/content-intelligence/topic-extractor';
import type { PostForClassification } from '@/lib/content-intelligence/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePost(id: string, overrides: Partial<PostForClassification> = {}): PostForClassification {
  return {
    id,
    content: `Test post ${id} — great plumbing tip for winter`,
    hashtags: ['plumbing', 'tip'],
    engagementRate: 0.05,
    format: 'image',
    publishedAt: '2026-06-15T09:00:00Z',
    ...overrides,
  };
}

const SAMPLE_CLASSIFICATION = [
  {
    postId: 'post-1',
    topics: ['tip', 'educational'],
    format: 'image',
    dayOfWeek: 'MON',
    hourUtc: 9,
    engagementRate: 0.05,
    hashtags: ['plumbing', 'tip'],
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('classifyPosts', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV };
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('returns fallback classifications when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].postId).toBe('post-1');
    // Fallback uses the post's own format
    expect(result[0].format).toBe('image');
    // Fallback topics
    expect(result[0].topics).toContain('general');
  });

  it('parses valid Claude Haiku JSON response', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(SAMPLE_CLASSIFICATION) } }],
      }),
    } as any);

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].topics).toContain('tip');
    expect(result[0].dayOfWeek).toBe('MON');
    expect(result[0].hourUtc).toBe(9);
  });

  it('falls back gracefully when fetch throws', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].postId).toBe('post-1');
    expect(result[0].topics).toContain('general'); // fallback
  });

  it('falls back gracefully when API returns non-OK status', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as any);

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].topics).toContain('general');
  });

  it('falls back gracefully on malformed JSON response', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'not json at all' } }],
      }),
    } as any);

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].topics).toContain('general');
  });

  it('strips markdown fences from response before parsing', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const withFences = '```json\n' + JSON.stringify(SAMPLE_CLASSIFICATION) + '\n```';
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: withFences } }],
      }),
    } as any);

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result[0].topics).toContain('tip');
  });

  it('processes batches of more than 20 posts (2 fetch calls)', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';

    // Create 25 posts — should produce 2 batches (20 + 5)
    const posts = Array.from({ length: 25 }, (_, i) => makePost(`post-${i + 1}`));

    const batch1Response = Array.from({ length: 20 }, (_, i) => ({
      postId: `post-${i + 1}`,
      topics: ['tip'],
      format: 'image',
      dayOfWeek: 'MON',
      hourUtc: 9,
      engagementRate: 0.05,
      hashtags: [],
    }));
    const batch2Response = Array.from({ length: 5 }, (_, i) => ({
      postId: `post-${i + 21}`,
      topics: ['promotion'],
      format: 'image',
      dayOfWeek: 'TUE',
      hourUtc: 14,
      engagementRate: 0.04,
      hashtags: [],
    }));

    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify(batch1Response) } }] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify(batch2Response) } }] }),
      } as any);

    global.fetch = mockFetch;

    const result = await classifyPosts(posts);

    expect(result).toHaveLength(25);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result[0].topics).toContain('tip');
    expect(result[20].topics).toContain('promotion');
  });

  it('returns empty array for empty input', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const result = await classifyPosts([]);
    expect(result).toHaveLength(0);
  });
});
