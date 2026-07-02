/**
 * Unit tests for TwitterService.createPost — base-contract parity (#13).
 *
 * TwitterService historically exposed only `postTweet(post): TweetPostResult`,
 * diverging from the BasePlatformService `createPost(content): PostResult`
 * contract that every other platform service implements. This test pins the
 * new `createPost` adapter method:
 *   - maps PostContent.text → tweet text and returns a PostResult,
 *   - uploads PostContent.mediaUrls (capped at 4) via uploadMedia and forwards
 *     the resulting media IDs to postTweet,
 *   - never throws: a postTweet/uploadMedia failure becomes
 *     `{ success: false, error }`.
 */

// Mock twitter-api-v2 — TwitterService constructs a TwitterApi client on init.
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({ v2: {}, v1: {} })),
  TwitterApiV2Settings: { debug: false },
}));

import { TwitterService } from '@/lib/social/twitter-service';
import type { PostContent } from '@/lib/social/base-platform-service';

describe('TwitterService.createPost — base-contract parity', () => {
  function makeService(): TwitterService {
    const service = new TwitterService();
    jest
      .spyOn(service, 'postTweet')
      .mockResolvedValue({
        success: true,
        data: { id: 'tweet-123', text: 'hello' },
        id: 'tweet-123',
        text: 'hello',
      });
    jest.spyOn(service, 'uploadMedia').mockResolvedValue('media-1');
    return service;
  }

  it('maps a text-only PostContent to a successful PostResult', async () => {
    const service = makeService();

    const result = await service.createPost({ text: 'hello' });

    expect(result).toEqual({
      success: true,
      postId: 'tweet-123',
      url: 'https://twitter.com/i/web/status/tweet-123',
    });
    expect(service.postTweet).toHaveBeenCalledWith({
      text: 'hello',
      mediaIds: undefined,
    });
    expect(service.uploadMedia).not.toHaveBeenCalled();
  });

  it('uploads media URLs (max 4) and forwards media IDs to postTweet', async () => {
    const service = makeService();
    (service.uploadMedia as jest.Mock)
      .mockResolvedValueOnce('m1')
      .mockResolvedValueOnce('m2')
      .mockResolvedValueOnce('m3')
      .mockResolvedValueOnce('m4');

    const content: PostContent = {
      text: 'with media',
      // 5 URLs — adapter must cap upload at 4.
      mediaUrls: ['u1', 'u2', 'u3', 'u4', 'u5'],
    };

    const result = await service.createPost(content);

    expect(result.success).toBe(true);
    expect(service.uploadMedia).toHaveBeenCalledTimes(4);
    expect(service.postTweet).toHaveBeenCalledWith({
      text: 'with media',
      mediaIds: ['m1', 'm2', 'm3', 'm4'],
    });
  });

  it('returns a PostResult error instead of throwing when postTweet fails', async () => {
    const service = makeService();
    (service.postTweet as jest.Mock).mockRejectedValue(
      new Error('Failed to post tweet: rate limited')
    );

    const result = await service.createPost({ text: 'boom' });

    expect(result).toEqual({
      success: false,
      error: 'Failed to post tweet: rate limited',
    });
  });
});
