/**
 * LinkedIn image publishing tests (E3 — carsi-linkedin-golive spec).
 *
 * Pins the D1 fix: `createPost` must upload `mediaUrls` through the
 * registerUpload → PUT bytes → IMAGE ugcPost flow — never silently drop
 * images — and must fail loud on a non-allowlisted media host. Also pins the
 * author-URN selection rule (numeric profileId = organisation URN) the whole
 * company-page go-live depends on.
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
  isAllowedLinkedInImageUrl,
} from '@/lib/social/linkedin-service';

describe('isAllowedLinkedInImageUrl', () => {
  it('allows https Cloudinary URLs only', () => {
    expect(
      isAllowedLinkedInImageUrl(
        'https://res.cloudinary.com/demo/image/upload/v1/carsi/hero.png'
      )
    ).toBe(true);
  });

  it('rejects http, other hosts, lookalike hosts, and junk', () => {
    expect(
      isAllowedLinkedInImageUrl('http://res.cloudinary.com/demo/x.png')
    ).toBe(false);
    expect(isAllowedLinkedInImageUrl('https://evil.example.com/x.png')).toBe(
      false
    );
    expect(
      isAllowedLinkedInImageUrl('https://res.cloudinary.com.evil.com/x.png')
    ).toBe(false);
    expect(isAllowedLinkedInImageUrl('not a url')).toBe(false);
  });
});

describe('LinkedInService.createPost media handling', () => {
  const ORG_ID = '112760720';
  const IMAGE_URL =
    'https://res.cloudinary.com/demo/image/upload/v1/carsi/hero.png';
  const UPLOAD_URL = 'https://api.linkedin.com/mediaUpload/abc';
  const ASSET_URN = 'urn:li:digitalmediaAsset:C5622AQGTYER3k3ByHQ';

  const realFetch = global.fetch;
  let service: LinkedInService;
  let calls: Array<{ url: string; init?: RequestInit }>;

  beforeEach(() => {
    service = new LinkedInService();
    service.initialize({
      accessToken: 'access-token',
      platformUserId: ORG_ID,
      // Far-future expiry so ensureValidToken never tries to refresh.
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    calls = [];

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
      if (url === IMAGE_URL) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png' }),
          arrayBuffer: async () => new ArrayBuffer(8),
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
          json: async () => ({ id: 'urn:li:share:123' }),
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

  it('uploads images and publishes an IMAGE post as the organisation', async () => {
    const result = await service.createPost({
      text: 'CARSI H5 launch post',
      mediaUrls: [IMAGE_URL],
    });

    expect(result.success).toBe(true);
    expect(result.url).toContain('urn:li:share:123');

    const body = ugcPostBody();
    // Numeric profileId → organisation author URN (company page, not person).
    expect(body.author).toBe(`urn:li:organization:${ORG_ID}`);
    const share = body.specificContent['com.linkedin.ugc.ShareContent'];
    expect(share.shareMediaCategory).toBe('IMAGE');
    expect(share.media).toEqual([{ status: 'READY', media: ASSET_URN }]);

    // The registered upload actually received the image bytes.
    const uploadCall = calls.find(c => c.url === UPLOAD_URL);
    expect(uploadCall?.init?.method).toBe('PUT');
  });

  it('fails loud (no post) when a media URL is not allowlisted', async () => {
    const result = await service.createPost({
      text: 'post',
      mediaUrls: ['https://evil.example.com/x.png'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non-allowlisted');
    // Nothing was posted and no upload was attempted.
    expect(calls.some(c => c.url.includes('/ugcPosts'))).toBe(false);
    expect(calls.some(c => c.url.includes('registerUpload'))).toBe(false);
  });

  it('fails the post (not imageless success) when the upload fails', async () => {
    const failingFetch = global.fetch as jest.Mock;
    failingFetch.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/assets?action=registerUpload')) {
        return {
          ok: false,
          status: 500,
          headers: new Headers(),
          text: async () => 'boom',
          json: async () => ({}),
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });

    const result = await service.createPost({
      text: 'post',
      mediaUrls: [IMAGE_URL],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('keeps the ARTICLE link path when there are no images', async () => {
    const result = await service.createPost({
      text: 'post',
      linkUrl:
        'https://carsi.com.au/courses/avian-influenza-awareness-restoration-iaq-facilities',
    });
    expect(result.success).toBe(true);
    const share =
      ugcPostBody().specificContent['com.linkedin.ugc.ShareContent'];
    expect(share.shareMediaCategory).toBe('ARTICLE');
    expect(share.media?.[0]?.originalUrl).toContain('carsi.com.au');
  });
});
