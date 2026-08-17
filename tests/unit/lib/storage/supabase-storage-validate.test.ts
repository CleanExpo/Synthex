/**
 * validateFile — media category policy.
 *
 * Founder brief 18/08/2026: audio files must be uploadable. Before this change
 * `ALLOWED_TYPES` was images + `video/mp4` only, so every mp3/wav/m4a was
 * rejected by `POST /api/media/upload`.
 *
 * The fix is a per-caller category policy rather than a wider global allowlist,
 * because `validateFile` is shared by three routes and one of them
 * (`/api/public/testimonials/[token]`) is an unauthenticated public endpoint.
 * Widening the global list would have widened that surface silently.
 */

import { validateFile } from '@/lib/storage/supabase-storage';

const MB = 1024 * 1024;

describe('validateFile — default policy stays images + video', () => {
  it('accepts a jpeg under the image cap', () => {
    expect(validateFile({ size: 2 * MB, type: 'image/jpeg' })).toBeNull();
  });

  it('accepts an mp4 under the video cap', () => {
    expect(validateFile({ size: 50 * MB, type: 'video/mp4' })).toBeNull();
  });

  it('rejects audio when the caller did not opt in', () => {
    const error = validateFile({ size: 5 * MB, type: 'audio/mpeg' });
    expect(error).toMatch(/Unsupported file type/);
  });

  it('rejects an executable disguised by extension', () => {
    expect(
      validateFile({ size: 1 * MB, type: 'application/x-msdownload' })
    ).toMatch(/Unsupported file type/);
  });
});

describe('validateFile — audio opt-in', () => {
  const AUDIO_POLICY = ['image', 'video', 'audio'] as const;

  // The formats a founder actually produces: phone voice memo (m4a), podcast
  // export (mp3/wav), browser recording (webm).
  it.each([
    ['audio/mpeg', 'mp3'],
    ['audio/mp4', 'm4a'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav (x- prefix)'],
    ['audio/webm', 'browser recording'],
    ['audio/aac', 'aac'],
    ['audio/ogg', 'ogg'],
    ['audio/flac', 'flac'],
  ])('accepts %s (%s) when audio is allowed', mime => {
    expect(
      validateFile({ size: 20 * MB, type: mime }, AUDIO_POLICY)
    ).toBeNull();
  });

  it('still enforces a size cap on audio', () => {
    const error = validateFile(
      { size: 500 * MB, type: 'audio/mpeg' },
      AUDIO_POLICY
    );
    expect(error).toMatch(/too large/i);
  });

  it('reports the audio cap, not the image cap, for oversized audio', () => {
    const error = validateFile(
      { size: 500 * MB, type: 'audio/mpeg' },
      AUDIO_POLICY
    );
    expect(error).not.toMatch(/10 MB/);
  });
});

describe('validateFile — video containers a phone actually records', () => {
  it('accepts video/quicktime, which is what an iPhone produces', () => {
    expect(validateFile({ size: 60 * MB, type: 'video/quicktime' })).toBeNull();
  });

  it('accepts video/webm', () => {
    expect(validateFile({ size: 60 * MB, type: 'video/webm' })).toBeNull();
  });

  it('applies the video cap to quicktime, not the image cap', () => {
    // 60 MB is over the 10 MB image cap. If quicktime were mis-categorised as
    // an image this would fail, which is the point of the assertion.
    expect(validateFile({ size: 60 * MB, type: 'video/quicktime' })).toBeNull();
  });
});

describe('validateFile — narrowing a policy', () => {
  it('rejects video when the caller allows images only', () => {
    const error = validateFile({ size: 5 * MB, type: 'video/mp4' }, ['image']);
    expect(error).toMatch(/Unsupported file type/);
  });

  it('names the allowed types in the rejection so the caller can act on it', () => {
    const error = validateFile({ size: 5 * MB, type: 'video/mp4' }, ['image']);
    expect(error).toContain('image/jpeg');
    expect(error).not.toContain('video/mp4, ');
  });
});
