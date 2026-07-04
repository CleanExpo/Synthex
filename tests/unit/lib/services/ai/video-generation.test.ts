/**
 * Unit tests — SYN-43 / SYN-48 unowned video-provider guards.
 *
 * Runway/Synthesia/D-ID are NOT in the Synthex stack (Artlist AI Toolkit +
 * ElevenLabs is the sanctioned substrate). With no provider key set, the service
 * must degrade gracefully: return a typed `not_configured` result, perform NO
 * network I/O (never call fetch), and never throw — never fabricating a video.
 */

/** @jest-environment node */
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  generateVideo,
  generateScriptVideo,
  animateImage,
  checkVideoStatus,
  type VideoProvider,
} from '@/lib/services/ai/video-generation';

// Provider key env vars this suite guarantees are unset per-test.
const KEYS = ['RUNWAY_API_KEY', 'SYNTHESIA_API_KEY', 'DID_API_KEY'] as const;

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  // Any fetch attempt is a defect — record it so tests can assert zero calls.
  fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('fetch must not be called when unconfigured'));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('generateVideo — unconfigured providers degrade to not_configured', () => {
  it('text-to-video (Runway) returns not_configured, no fetch, no throw', async () => {
    const result = await generateVideo({
      type: 'text-to-video',
      prompt: 'a moisture meter drying a wall',
    });
    expect(result.status).toBe('not_configured');
    expect(result.success).toBe(false);
    expect(result.provider).toBe('runway');
    expect(result.reason).toMatch(/Artlist|substrate|not in stack/i);
    expect(result.videoId).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('avatar (Synthesia) returns not_configured without fetch', async () => {
    const result = await generateVideo({ type: 'avatar', script: 'hello' });
    expect(result.status).toBe('not_configured');
    expect(result.provider).toBe('synthesia');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('avatar with image (D-ID) returns not_configured without fetch', async () => {
    const result = await generateVideo({
      type: 'avatar',
      script: 'hello',
      imageUrl: 'https://example.com/face.jpg',
    });
    expect(result.status).toBe('not_configured');
    expect(result.provider).toBe('d-id');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('generateScriptVideo / animateImage helpers', () => {
  it('generateScriptVideo degrades without fetch', async () => {
    const result = await generateScriptVideo('a script', {
      provider: 'synthesia',
    });
    expect(result.status).toBe('not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('animateImage degrades without fetch', async () => {
    const result = await animateImage('https://example.com/img.png');
    expect(result.status).toBe('not_configured');
    expect(result.provider).toBe('runway');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('checkVideoStatus — unconfigured providers never call fetch', () => {
  it.each<VideoProvider>(['runway', 'synthesia', 'd-id'])(
    '%s returns not_configured (preserving videoId) without fetch',
    async provider => {
      const result = await checkVideoStatus('vid-123', provider);
      expect(result.status).toBe('not_configured');
      expect(result.provider).toBe(provider);
      expect(result.videoId).toBe('vid-123');
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );
});
