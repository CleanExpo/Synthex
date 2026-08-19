/**
 * X (Twitter) native video publishing tests — mirrors the LinkedIn analog
 * (RA-7061). Pins the video path: `createPost` must upload an MP4 through the
 * X chunked media-upload flow (INIT → APPEND base64 chunks → FINALIZE → poll
 * STATUS until processing_info.state === 'succeeded') and then post ONE tweet
 * carrying the resulting media_id. X allows exactly one video per tweet and
 * never a video+image mix — both are fail-loud, and a still-processing or
 * failed transcode must never reach the tweet call.
 */

// Mock twitter-api-v2 — TwitterService constructs a TwitterApi client on init.
// The jest config uses resetMocks, so mock behaviour is (re)established inside
// each test; here the service's client is replaced with a controllable stub in
// makeService rather than relying on the constructor's return value.
jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn(),
  TwitterApiV2Settings: { debug: false },
}));

import {
  TwitterService,
  isAllowedTwitterVideoUrl,
  isTwitterVideoMediaUrl,
} from '@/lib/social/twitter-service';

interface MockV1 {
  post: jest.Mock;
  get: jest.Mock;
  uploadMedia: jest.Mock;
}
interface MockV2 {
  tweet: jest.Mock;
}
interface MockClient {
  v1: MockV1;
  v2: MockV2;
}

const VIDEO_URL =
  'https://res.cloudinary.com/demo/video/upload/v1/carsi/reel.mp4';
const IMAGE_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/carsi/hero.png';
const MEDIA_ID = 'media-vid-1';

describe('isAllowedTwitterVideoUrl', () => {
  it('allows https Cloudinary and Supabase storage URLs only', () => {
    expect(isAllowedTwitterVideoUrl(VIDEO_URL)).toBe(true);
    expect(
      isAllowedTwitterVideoUrl(
        'https://abc123.supabase.co/storage/v1/object/public/generated-videos/u/1.mp4'
      )
    ).toBe(true);
  });

  it('rejects http, other hosts, lookalike hosts, and junk', () => {
    expect(
      isAllowedTwitterVideoUrl('http://res.cloudinary.com/demo/x.mp4')
    ).toBe(false);
    expect(isAllowedTwitterVideoUrl('https://evil.example.com/x.mp4')).toBe(
      false
    );
    expect(
      isAllowedTwitterVideoUrl('https://res.cloudinary.com.evil.com/x.mp4')
    ).toBe(false);
    expect(
      isAllowedTwitterVideoUrl('https://abc123.supabase.co.evil.com/x.mp4')
    ).toBe(false);
    expect(isAllowedTwitterVideoUrl('not a url')).toBe(false);
  });
});

describe('isTwitterVideoMediaUrl', () => {
  it('detects video by extension, not host', () => {
    expect(isTwitterVideoMediaUrl(VIDEO_URL)).toBe(true);
    expect(isTwitterVideoMediaUrl(IMAGE_URL)).toBe(false);
  });
});

describe('TwitterService.createPost native video handling', () => {
  const realFetch = global.fetch;
  let service: TwitterService;
  let client: MockClient;
  /** Ordered log of upload/tweet commands, for sequence assertions. */
  let commands: string[];
  /** processing_info.state returned by successive STATUS polls. */
  let statusSequence: string[];

  function makeService(): TwitterService {
    const svc = new TwitterService();
    // resetMocks wipes any constructor-return stub, so inject a controllable
    // client directly onto the service (client.v1 = low-level upload surface,
    // client.v2 = tweet surface).
    client = {
      v1: { post: jest.fn(), get: jest.fn(), uploadMedia: jest.fn() },
      v2: { tweet: jest.fn() },
    };
    (svc as unknown as { client: MockClient }).client = client;
    (svc as unknown as { v2Client: MockV2 }).v2Client = client.v2;

    client.v1.post.mockImplementation(
      async (_url: string, body: Record<string, unknown>) => {
        const command = String(body.command);
        commands.push(command);
        if (command === 'INIT') {
          return { media_id_string: MEDIA_ID };
        }
        if (command === 'APPEND') {
          return undefined;
        }
        // FINALIZE — async processing kicks off, must be polled.
        return {
          media_id_string: MEDIA_ID,
          processing_info: { state: 'pending', check_after_secs: 0 },
        };
      }
    );

    client.v1.get.mockImplementation(async () => {
      commands.push('STATUS');
      const state = statusSequence.shift() ?? 'succeeded';
      return {
        media_id_string: MEDIA_ID,
        processing_info: { state, check_after_secs: 0 },
      };
    });

    client.v2.tweet.mockImplementation(async (data: { text: string }) => {
      commands.push('TWEET');
      return { data: { id: 'tweet-vid-1', text: data.text } };
    });

    // Keep the bounded poll loop instant in tests.
    (svc as unknown as { videoPollIntervalMs: number }).videoPollIntervalMs = 0;
    return svc;
  }

  beforeEach(() => {
    commands = [];
    statusSequence = ['pending', 'succeeded'];

    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'video/mp4' }),
        arrayBuffer: async () => new ArrayBuffer(16),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    service = makeService();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('runs INIT → APPEND → FINALIZE → STATUS(pending→succeeded) → tweet-with-video', async () => {
    const result = await service.createPost({
      text: 'Native video launch',
      mediaUrls: [VIDEO_URL],
    });

    expect(result.success).toBe(true);
    expect(result.postId).toBe('tweet-vid-1');
    expect(result.url).toContain('tweet-vid-1');

    // Exact chunked-upload ordering, tweet strictly last.
    expect(commands).toEqual([
      'INIT',
      'APPEND',
      'FINALIZE',
      'STATUS',
      'STATUS',
      'TWEET',
    ]);

    // INIT declared a tweet_video with byte count + MIME type.
    const initBody = client.v1.post.mock.calls[0][1] as Record<string, unknown>;
    expect(initBody.command).toBe('INIT');
    expect(initBody.media_category).toBe('tweet_video');
    expect(initBody.total_bytes).toBe(16);
    expect(initBody.media_type).toBe('video/mp4');

    // APPEND carried a base64 chunk + segment index.
    const appendBody = client.v1.post.mock.calls[1][1] as Record<
      string,
      unknown
    >;
    expect(appendBody.command).toBe('APPEND');
    expect(appendBody.segment_index).toBe(0);
    expect(appendBody.media_id).toBe(MEDIA_ID);
    expect(typeof appendBody.media_data).toBe('string');

    // The tweet attached exactly the single processed media_id.
    const tweetData = client.v2.tweet.mock.calls[0][0] as {
      media?: { media_ids: string[] };
    };
    expect(tweetData.media?.media_ids).toEqual([MEDIA_ID]);
  });

  it('fails loud when STATUS reports failed — never posts the tweet', async () => {
    statusSequence = ['pending', 'failed'];

    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/i);
    expect(commands).not.toContain('TWEET');
  });

  it('fails loud when the asset never succeeds within the poll bound', async () => {
    (service as unknown as { videoPollAttempts: number }).videoPollAttempts = 3;
    statusSequence = ['pending', 'pending', 'pending', 'pending'];

    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/succeed|processing/i);
    expect(commands.filter(c => c === 'STATUS').length).toBe(3);
    expect(commands).not.toContain('TWEET');
  });

  it('rejects more than one video — X allows exactly one per tweet', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL, VIDEO_URL.replace('reel', 'reel-2')],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('one video');
    expect(commands).toEqual([]);
  });

  it('rejects mixing video and image media in one tweet', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL, IMAGE_URL],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot mix');
    expect(commands).toEqual([]);
  });

  it('fails loud (no upload, no tweet) when a video URL is not allowlisted', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: ['https://evil.example.com/x.mp4'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non-allowlisted');
    expect(commands).toEqual([]);
  });
});
