/**
 * Unit tests — Content Intelligence Topic Extractor (SYN-631)
 *
 * Covers:
 *  - classifyPosts: routes through getAIProvider (OpenAI-only; OPENROUTER_API_KEY unset)
 *  - classifyPosts: parses valid Haiku-style JSON response
 *  - classifyPosts: falls back gracefully on provider error
 *  - classifyPosts: falls back gracefully on malformed JSON response
 *  - classifyPosts: processes large batches in chunks of 20
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// classifyPosts now generates via the shared provider factory rather than a
// hardcoded OpenRouter `fetch`. Tests mock getAIProvider().complete.
const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({
    name: 'OpenAI',
    models: { fast: 'gpt-4o-mini' },
    complete: mockComplete,
  }),
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

function completionWith(content: string) {
  return { choices: [{ message: { content } }] };
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
    // The OpenAI-only deployment condition: no OpenRouter key present.
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('parses a valid classification response via the provider factory', async () => {
    mockComplete.mockResolvedValueOnce(
      completionWith(JSON.stringify(SAMPLE_CLASSIFICATION))
    );

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(result).toHaveLength(1);
    expect(result[0].topics).toContain('tip');
    expect(result[0].dayOfWeek).toBe('MON');
    expect(result[0].hourUtc).toBe(9);
  });

  it('falls back gracefully when the provider throws', async () => {
    mockComplete.mockRejectedValueOnce(new Error('Network error'));

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].postId).toBe('post-1');
    expect(result[0].topics).toContain('general'); // fallback
  });

  it('falls back gracefully on malformed JSON response', async () => {
    mockComplete.mockResolvedValueOnce(completionWith('not json at all'));

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].topics).toContain('general');
  });

  it('strips markdown fences from response before parsing', async () => {
    const withFences = '```json\n' + JSON.stringify(SAMPLE_CLASSIFICATION) + '\n```';
    mockComplete.mockResolvedValueOnce(completionWith(withFences));

    const posts = [makePost('post-1')];
    const result = await classifyPosts(posts);

    expect(result[0].topics).toContain('tip');
  });

  it('processes batches of more than 20 posts (2 provider calls)', async () => {
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

    mockComplete
      .mockResolvedValueOnce(completionWith(JSON.stringify(batch1Response)))
      .mockResolvedValueOnce(completionWith(JSON.stringify(batch2Response)));

    const result = await classifyPosts(posts);

    expect(result).toHaveLength(25);
    expect(mockComplete).toHaveBeenCalledTimes(2);
    expect(result[0].topics).toContain('tip');
    expect(result[20].topics).toContain('promotion');
  });

  it('returns empty array for empty input', async () => {
    const result = await classifyPosts([]);
    expect(result).toHaveLength(0);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
