/**
 * YouTube / TikTok adapters must pass connectionId into createPlatformService
 * so mid-publish OAuth refresh uses the advisory lock (AT-031 residual).
 */

/** @jest-environment node */

const mockCreatePost = jest.fn();
const mockCreatePlatformService = jest.fn(() => ({
  createPost: (...a: unknown[]) => mockCreatePost(...a),
}));

jest.mock('@/lib/social', () => ({
  createPlatformService: (...a: unknown[]) => mockCreatePlatformService(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { publishToYouTube } from '@/lib/publish/platformAdapters/youtube';
import { publishToTikTok } from '@/lib/publish/platformAdapters/tiktok';

beforeEach(() => {
  jest.clearAllMocks();
  mockCreatePost.mockResolvedValue({ success: true, postId: 'post_1' });
});

describe('publishToYouTube — connectionId refresh-lock', () => {
  it('passes connectionId into createPlatformService', async () => {
    await publishToYouTube({
      accessToken: 'at',
      refreshToken: 'rt',
      connectionId: 'conn-yt-1',
      videoUrl: 'https://cdn.example/v.mp4',
      title: 'Title',
    });

    expect(mockCreatePlatformService).toHaveBeenCalledWith(
      'youtube',
      { accessToken: 'at', refreshToken: 'rt' },
      { connectionId: 'conn-yt-1' }
    );
  });

  it('omits the options bag when connectionId is absent', async () => {
    await publishToYouTube({
      accessToken: 'at',
      videoUrl: 'https://cdn.example/v.mp4',
      title: 'Title',
    });

    expect(mockCreatePlatformService).toHaveBeenCalledWith(
      'youtube',
      { accessToken: 'at', refreshToken: undefined },
      undefined
    );
  });
});

describe('publishToTikTok — connectionId refresh-lock', () => {
  it('passes connectionId into createPlatformService', async () => {
    await publishToTikTok({
      accessToken: 'at',
      refreshToken: 'rt',
      connectionId: 'conn-tt-1',
      videoUrl: 'https://cdn.example/v.mp4',
      caption: 'Caption',
    });

    expect(mockCreatePlatformService).toHaveBeenCalledWith(
      'tiktok',
      { accessToken: 'at', refreshToken: 'rt' },
      { connectionId: 'conn-tt-1' }
    );
  });
});
