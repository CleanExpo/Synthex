/**
 * Regression lock for the Twitter State-1 path (SYN-540): Twitter is in
 * AUTO_PUBLISH_PLATFORMS, so its adapter MUST propagate the HTTP status of a
 * failed post — otherwise a real Twitter 401 can never trigger the queue's
 * hold-and-pause handling and silently burns the retry ladder instead.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCreatePost = jest.fn();
const mockIsConfigured = jest.fn();
const mockInitialize = jest.fn();
jest.mock('@/lib/social/twitter-sync-service', () => ({
  TwitterSyncService: jest.fn(),
}));

import { publishToTwitter } from '@/lib/publish/platformAdapters/twitter';
import { TwitterSyncService } from '@/lib/social/twitter-sync-service';

beforeEach(() => {
  jest.clearAllMocks();
  // Re-arm each test run — the jest config resets mock implementations.
  (TwitterSyncService as jest.Mock).mockImplementation(() => ({
    initialize: mockInitialize,
    isConfigured: mockIsConfigured,
    createPost: mockCreatePost,
  }));
  mockIsConfigured.mockReturnValue(true);
});

describe('publishToTwitter — statusCode propagation', () => {
  it('propagates the service statusCode on failure (401 reaches the queue)', async () => {
    mockCreatePost.mockResolvedValue({
      success: false,
      error: '[twitter] Request failed with code 401',
      statusCode: 401,
    });

    const res = await publishToTwitter({
      accessToken: 'tok',
      accessTokenSecret: 'sec',
      text: 'hello',
    });

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('leaves statusCode undefined when the service saw no HTTP status', async () => {
    mockCreatePost.mockResolvedValue({
      success: false,
      error: 'Service not configured',
    });

    const res = await publishToTwitter({
      accessToken: 'tok',
      accessTokenSecret: 'sec',
      text: 'hello',
    });

    expect(res.success).toBe(false);
    expect(res.statusCode).toBeUndefined();
  });

  it('returns success with no statusCode on the happy path', async () => {
    mockCreatePost.mockResolvedValue({ success: true, postId: 'tw-1' });

    const res = await publishToTwitter({
      accessToken: 'tok',
      accessTokenSecret: 'sec',
      text: 'hello',
    });

    expect(res).toEqual({ success: true, platformPostId: 'tw-1' });
  });
});
