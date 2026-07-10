/**
 * Tests for the nexus-viral video publish adapters — SYN-1075 WS4a.
 *
 * Proves (against a MOCKED platform API — no network):
 *  - publishToYouTube emits the correct create-request payload
 *    (snippet.title / description / tags) — acceptance criterion §15(4).
 *  - publishToYouTube refuses to publish without a rendered video URL.
 *  - publishToTikTok drives the TikTok PULL_FROM_URL dispatch path with the
 *    video URL + caption — acceptance criterion §15(5).
 *  - publishToTikTok refuses to publish without a rendered video URL.
 *
 * The token-refresh path is never triggered (no expiresAt set), so every test
 * exercises the create call directly.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { publishToYouTube } from '@/lib/publish/platformAdapters/youtube';
import { publishToTikTok } from '@/lib/publish/platformAdapters/tiktok';

// ── Fetch mock helpers ──────────────────────────────────────────────────────

interface FakeResponseInit {
  ok?: boolean;
  status?: number;
  json?: unknown;
  location?: string;
}

function fakeResponse(init: FakeResponseInit): Response {
  const headerMap = new Map<string, string>();
  if (init.location) headerMap.set('location', init.location);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: {
      get: (k: string) => headerMap.get(k.toLowerCase()) ?? null,
      forEach: () => undefined,
    },
    json: async () => init.json ?? {},
    text: async () => JSON.stringify(init.json ?? {}),
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response;
}

describe('publishToYouTube', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends snippet.title, description and tags in the upload-init payload', async () => {
    // Call 1: resumable upload init → return a location header.
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ ok: true, location: 'https://upload.example/resume/123' })
    );
    // Call 2: fetch the video bytes from the storage URL.
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: true }));
    // Call 3: PUT the bytes → returns the created video id.
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ ok: true, json: { id: 'yt-video-abc' } })
    );

    const result = await publishToYouTube({
      accessToken: 'tok-123',
      videoUrl: 'https://cdn.example/cut-916.mp4',
      title: 'How we fixed a flooded office in 4 hours',
      description: 'The exact restoration steps, start to finish.',
      tags: ['water damage', 'restoration', 'brisbane'],
    });

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('yt-video-abc');

    // Assert the CREATE-request (call 1) payload shape.
    const [initUrl, initOptions] = fetchMock.mock.calls[0];
    expect(String(initUrl)).toContain('/upload/youtube/v3/videos');
    expect(initOptions.method).toBe('POST');

    const body = JSON.parse(initOptions.body as string);
    expect(body.snippet.title).toBe('How we fixed a flooded office in 4 hours');
    expect(body.snippet.description).toBe(
      'The exact restoration steps, start to finish.'
    );
    expect(body.snippet.tags).toEqual([
      'water damage',
      'restoration',
      'brisbane',
    ]);
    expect(body.status.privacyStatus).toBe('public');
  });

  it('refuses to publish without a video URL (no fetch call made)', async () => {
    const result = await publishToYouTube({
      accessToken: 'tok-123',
      videoUrl: '',
      title: 'No media',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requires a rendered video URL/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces an upstream failure as an error result', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        ok: false,
        status: 403,
        json: { error: { message: 'quota' } },
      })
    );

    const result = await publishToYouTube({
      accessToken: 'tok-123',
      videoUrl: 'https://cdn.example/cut.mp4',
      title: 'x',
    });

    expect(result.success).toBe(false);
  });
});

describe('publishToTikTok', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('drives the PULL_FROM_URL init with the video URL and caption', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ ok: true, json: { data: { publish_id: 'tt-pub-1' } } })
    );

    const result = await publishToTikTok({
      accessToken: 'tok-xyz',
      videoUrl: 'https://cdn.example/cut-916.mp4',
      caption: 'Watch how fast we dried this out',
    });

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('tt-pub-1');

    const [initUrl, initOptions] = fetchMock.mock.calls[0];
    expect(String(initUrl)).toContain('/post/publish/video/init/');
    expect(initOptions.method).toBe('POST');

    const body = JSON.parse(initOptions.body as string);
    expect(body.source_info.source).toBe('PULL_FROM_URL');
    expect(body.source_info.video_url).toBe('https://cdn.example/cut-916.mp4');
    expect(body.post_info.title).toBe('Watch how fast we dried this out');
    expect(body.post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE');
  });

  it('refuses to publish without a video URL (no fetch call made)', async () => {
    const result = await publishToTikTok({
      accessToken: 'tok-xyz',
      videoUrl: '',
      caption: 'no media',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/requires a rendered video URL/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
