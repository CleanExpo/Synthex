jest.mock('@/lib/security/validate-url', () => ({
  assertExternalUrlSafe: jest.fn(async () => undefined),
}));

import {
  fetchImageAsBase64,
  isAllowedImageHost,
} from '@/lib/services/media/fetch-image-base64';

describe('isAllowedImageHost', () => {
  it.each([
    'https://v3b.fal.media/x.png',
    'https://fal.media/a.jpg',
    'https://fal.run/f/x',
  ])('allows %s', u => expect(isAllowedImageHost(u)).toBe(true));
  it.each([
    'https://evil.com/x.png',
    'https://notfal.media.evil.com/x',
    'http://fal.media/x',
    'https://xfal.media/x',
  ])('rejects %s', u => expect(isAllowedImageHost(u)).toBe(false));
});

describe('fetchImageAsBase64', () => {
  afterEach(() => jest.restoreAllMocks());
  const okResponse = (bytes: number, type = 'image/png') => ({
    ok: true,
    headers: new Headers({
      'content-type': type,
      'content-length': String(bytes),
    }),
    arrayBuffer: async () => new ArrayBuffer(bytes),
  });
  it('returns base64 for an allowed image', async () => {
    global.fetch = jest.fn(async () => okResponse(8)) as any;
    const r = await fetchImageAsBase64('https://v3b.fal.media/x.png');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.base64).toBe(Buffer.alloc(8).toString('base64'));
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toMatchObject({
      redirect: 'error',
    });
  });
  it('refuses disallowed hosts without fetching', async () => {
    global.fetch = jest.fn() as any;
    const r = await fetchImageAsBase64('https://evil.com/x.png');
    expect(r).toEqual({ ok: false, reason: expect.stringContaining('host') });
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('rejects non-image content-type', async () => {
    global.fetch = jest.fn(async () => okResponse(8, 'text/html')) as any;
    const r = await fetchImageAsBase64('https://fal.media/x');
    expect(r.ok).toBe(false);
  });
  it('rejects oversize by content-length and by streamed size', async () => {
    global.fetch = jest.fn(async () => okResponse(20 * 1024 * 1024)) as any;
    expect((await fetchImageAsBase64('https://fal.media/x')).ok).toBe(false);
    global.fetch = jest.fn(async () => ({
      ...okResponse(100),
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => new ArrayBuffer(20 * 1024 * 1024),
    })) as any;
    expect((await fetchImageAsBase64('https://fal.media/x')).ok).toBe(false);
  });
  it('maps fetch throw (timeout/redirect) to ok:false, never throws', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('redirect blocked');
    }) as any;
    await expect(
      fetchImageAsBase64('https://fal.media/x')
    ).resolves.toMatchObject({ ok: false });
  });
});
