/**
 * LinkedIn native video publishing tests (RA-7061).
 *
 * Pins the video path: `createPost` must upload an MP4 through the
 * registerUpload → PUT bytes → poll-until-AVAILABLE → VIDEO ugcPost flow.
 * Videos process asynchronously — publishing before the asset is AVAILABLE
 * yields a broken post, so the polling gate is the behaviour under test.
 * Also pins the fail-loud cases: processing failure, poll timeout, a
 * non-allowlisted host, and a multi-video payload (LinkedIn allows one video
 * per post — silently dropping the rest is the defect this path prevents).
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  LinkedInService,
  isAllowedLinkedInVideoUrl,
} from '@/lib/social/linkedin-service';

describe('isAllowedLinkedInVideoUrl', () => {
  it('allows https Cloudinary and Supabase storage URLs only', () => {
    expect(
      isAllowedLinkedInVideoUrl(
        'https://res.cloudinary.com/demo/video/upload/v1/carsi/reel.mp4'
      )
    ).toBe(true);
    expect(
      isAllowedLinkedInVideoUrl(
        'https://abc123.supabase.co/storage/v1/object/public/generated-videos/u/1.mp4'
      )
    ).toBe(true);
  });

  it('rejects http, other hosts, lookalike hosts, and junk', () => {
    expect(
      isAllowedLinkedInVideoUrl('http://res.cloudinary.com/demo/x.mp4')
    ).toBe(false);
    expect(isAllowedLinkedInVideoUrl('https://evil.example.com/x.mp4')).toBe(
      false
    );
    expect(
      isAllowedLinkedInVideoUrl('https://res.cloudinary.com.evil.com/x.mp4')
    ).toBe(false);
    expect(
      isAllowedLinkedInVideoUrl('https://abc123.supabase.co.evil.com/x.mp4')
    ).toBe(false);
    expect(isAllowedLinkedInVideoUrl('not a url')).toBe(false);
  });
});

describe('LinkedInService.createPost native video handling', () => {
  const ORG_ID = '112760720';
  const VIDEO_URL =
    'https://res.cloudinary.com/demo/video/upload/v1/carsi/reel.mp4';
  const IMAGE_URL =
    'https://res.cloudinary.com/demo/image/upload/v1/carsi/hero.png';
  const UPLOAD_URL = 'https://api.linkedin.com/mediaUpload/video/abc';
  const ASSET_URN = 'urn:li:digitalmediaAsset:C5605AQFqVideo123';
  const ASSET_ID = 'C5605AQFqVideo123';

  const realFetch = global.fetch;
  let service: LinkedInService;
  let calls: Array<{ url: string; init?: RequestInit }>;
  /** Statuses returned by successive GET /assets/{id} polls. */
  let statusSequence: string[];

  function makeService(): LinkedInService {
    const svc = new LinkedInService();
    svc.initialize({
      accessToken: 'access-token',
      platformUserId: ORG_ID,
      // Far-future expiry so ensureValidToken never tries to refresh.
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    // Keep the bounded poll loop instant in tests.
    (svc as unknown as { videoPollIntervalMs: number }).videoPollIntervalMs = 0;
    return svc;
  }

  beforeEach(() => {
    service = makeService();
    calls = [];
    statusSequence = ['PROCESSING', 'AVAILABLE'];

    global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url.includes('/assets?action=registerUpload')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            value: {
              asset: ASSET_URN,
              uploadMechanism: {
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                  uploadUrl: UPLOAD_URL,
                },
              },
            },
          }),
        } as unknown as Response;
      }
      if (url.includes(`/assets/${ASSET_ID}`)) {
        const next = statusSequence.shift() ?? 'AVAILABLE';
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            recipes: [
              {
                recipe: 'urn:li:digitalmediaRecipe:feedshare-video',
                status: next,
              },
            ],
          }),
        } as unknown as Response;
      }
      if (url === VIDEO_URL) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'video/mp4' }),
          arrayBuffer: async () => new ArrayBuffer(16),
        } as unknown as Response;
      }
      if (url === UPLOAD_URL) {
        return {
          ok: true,
          status: 201,
          headers: new Headers(),
        } as unknown as Response;
      }
      if (url.includes('/ugcPosts')) {
        return {
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({ id: 'urn:li:share:999' }),
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function ugcPostBody(): Record<string, any> {
    const call = calls.find(c => c.url.includes('/ugcPosts'));
    expect(call).toBeDefined();
    return JSON.parse(String(call!.init?.body));
  }

  it('registers, uploads, polls to AVAILABLE, then publishes a VIDEO post', async () => {
    const result = await service.createPost({
      text: 'Native video launch',
      mediaUrls: [VIDEO_URL],
    });

    expect(result.success).toBe(true);
    expect(result.url).toContain('urn:li:share:999');

    // registerUpload asked for the video recipe, not the image recipe.
    const register = calls.find(c =>
      c.url.includes('/assets?action=registerUpload')
    );
    const registerBody = JSON.parse(String(register!.init?.body));
    expect(registerBody.registerUploadRequest.recipes).toEqual([
      'urn:li:digitalmediaRecipe:feedshare-video',
    ]);

    // Bytes were PUT to the returned upload URL.
    const uploadCall = calls.find(c => c.url === UPLOAD_URL);
    expect(uploadCall?.init?.method).toBe('PUT');

    // Polled until AVAILABLE — PROCESSING first, then AVAILABLE (2 polls).
    const statusCalls = calls.filter(c =>
      c.url.includes(`/assets/${ASSET_ID}`)
    );
    expect(statusCalls.length).toBe(2);

    // The post was created only AFTER the asset went AVAILABLE.
    const lastStatusIndex = calls.findLastIndex(c =>
      c.url.includes(`/assets/${ASSET_ID}`)
    );
    const postIndex = calls.findIndex(c => c.url.includes('/ugcPosts'));
    expect(postIndex).toBeGreaterThan(lastStatusIndex);

    const body = ugcPostBody();
    expect(body.author).toBe(`urn:li:organization:${ORG_ID}`);
    const share = body.specificContent['com.linkedin.ugc.ShareContent'];
    expect(share.shareMediaCategory).toBe('VIDEO');
    expect(share.media).toEqual([{ status: 'READY', media: ASSET_URN }]);
  });

  it('fails loud on PROCESSING_FAILED — never publishes a broken asset', async () => {
    statusSequence = ['PROCESSING', 'PROCESSING_FAILED'];

    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('PROCESSING_FAILED');
    expect(calls.some(c => c.url.includes('/ugcPosts'))).toBe(false);
  });

  it('fails loud when the asset never becomes AVAILABLE (poll timeout)', async () => {
    (service as unknown as { videoPollAttempts: number }).videoPollAttempts = 3;
    statusSequence = ['PROCESSING', 'PROCESSING', 'PROCESSING'];

    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/PROCESSING/);
    expect(
      calls.filter(c => c.url.includes(`/assets/${ASSET_ID}`)).length
    ).toBe(3);
    expect(calls.some(c => c.url.includes('/ugcPosts'))).toBe(false);
  });

  it('rejects more than one video — LinkedIn allows exactly one per post', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL, VIDEO_URL.replace('reel', 'reel-2')],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('one video');
    expect(calls.some(c => c.url.includes('registerUpload'))).toBe(false);
    expect(calls.some(c => c.url.includes('/ugcPosts'))).toBe(false);
  });

  it('rejects mixing video and image media in one post', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: [VIDEO_URL, IMAGE_URL],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot mix');
    expect(calls.some(c => c.url.includes('/ugcPosts'))).toBe(false);
  });

  it('fails loud (no post, no upload) when a video URL is not allowlisted', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: ['https://evil.example.com/x.mp4'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non-allowlisted');
    expect(calls.some(c => c.url.includes('registerUpload'))).toBe(false);
    expect(calls.some(c => c.url.includes('/ugcPosts'))).toBe(false);
  });
});
