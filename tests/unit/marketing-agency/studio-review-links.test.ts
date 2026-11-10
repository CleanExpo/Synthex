/**
 * Studio review links are signed on every board read from the stored copy,
 * so a link saved at load time can never expire on the client.
 */

import {
  STUDIO_REVIEW_LINK_TTL_SECONDS,
  withFreshReviewLinks,
} from '@/lib/marketing-agency/studio/review-links';

const stored = (path: string, bucket = 'media-uploads') => ({
  id: path,
  status: 'awaiting_approval',
  videoUrl: 'https://old.example/expired',
  metadata: { storageBucket: bucket, storagePath: path },
});

describe('studio review links', () => {
  it('replaces each stored copy with a link signed now, in one call per bucket', async () => {
    const sign = jest.fn(async (_b: string, paths: string[], _ttl: number) =>
      paths.map(p => `https://signed.example/${p}`)
    );
    const out = await withFreshReviewLinks(
      [stored('ccw/a.mp4'), stored('ccw/b.mp4')],
      'ccw',
      sign
    );
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith(
      'media-uploads',
      ['ccw/a.mp4', 'ccw/b.mp4'],
      STUDIO_REVIEW_LINK_TTL_SECONDS
    );
    expect(out.map(d => d.videoUrl)).toEqual([
      'https://signed.example/ccw/a.mp4',
      'https://signed.example/ccw/b.mp4',
    ]);
    expect(out.every(d => d.videoError === undefined)).toBe(true);
  });

  it('leaves a draft with no stored copy as it was', async () => {
    const sign = jest.fn();
    const draft = {
      id: 'x',
      status: 'approved',
      videoUrl: 'https://heygen.example/v.mp4',
    };
    const [out] = await withFreshReviewLinks([draft], 'ccw', sign);
    expect(out.videoUrl).toBe('https://heygen.example/v.mp4');
    expect(sign).not.toHaveBeenCalled();
  });

  it.each([
    ['another client folder', stored('carsi/a.mp4')],
    ['a bucket outside the review list', stored('ccw/a.mp4', 'brand-assets')],
    ['a path that climbs out of the folder', stored('ccw/../carsi/a.mp4')],
    ['an encoded climb', stored('ccw/%2e%2e/ccw-2/a.mp4')],
    ['a backslash climb', stored('ccw/..\\ccw-2\\a.mp4')],
    ['a leading slash', stored('/ccw/a.mp4')],
    ['a sibling client sharing the prefix', stored('ccw-2/a.mp4')],
    ['an empty segment', stored('ccw//a.mp4')],
    ['the folder itself with no file', stored('ccw')],
    [
      'a bucket with no path',
      {
        id: 'p',
        status: 'x',
        videoUrl: 'u',
        metadata: { storageBucket: 'media-uploads' },
      },
    ],
  ])('never signs %s', async (_label, draft) => {
    const sign = jest.fn();
    const [out] = await withFreshReviewLinks([draft], 'ccw', sign);
    expect(sign).not.toHaveBeenCalled();
    expect(out.videoUrl).toBeNull();
    expect(out.videoError).toMatch(/outside the review area/);
  });

  it('reports a signing failure on the card instead of serving the old link', async () => {
    const onError = jest.fn();
    const sign = jest.fn(async () => {
      throw new Error('storage down');
    });
    const [out] = await withFreshReviewLinks(
      [stored('ccw/a.mp4')],
      'ccw',
      sign,
      onError
    );
    expect(out.videoUrl).toBeNull();
    expect(out.videoError).toMatch(/could not be created/);
    expect(onError).toHaveBeenCalledWith('media-uploads', expect.any(Error));
  });

  it('treats a short signing result as a failure, never a partial board', async () => {
    const sign = jest.fn(async () => ['https://signed.example/only-one']);
    const out = await withFreshReviewLinks(
      [stored('ccw/a.mp4'), stored('ccw/b.mp4')],
      'ccw',
      sign
    );
    expect(out.map(d => d.videoUrl)).toEqual([null, null]);
  });

  it('does not change the drafts it was given', async () => {
    const draft = stored('ccw/a.mp4');
    await withFreshReviewLinks([draft], 'ccw', async (_b, p) =>
      p.map(() => 'new')
    );
    expect(draft.videoUrl).toBe('https://old.example/expired');
  });
});
