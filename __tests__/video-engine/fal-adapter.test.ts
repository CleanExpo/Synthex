import {
  submitToFal,
  verifyWebhookToken,
  parseFalWebhook,
} from '@/lib/services/ai/video/fal-adapter';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FAL_API_KEY = 'test-key';
  process.env.FAL_WEBHOOK_SECRET = 'shh-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.example';
});

describe('fal adapter', () => {
  it('submits to the fal queue with auth header and webhook url', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ request_id: 'req-123' }),
    });
    const id = await submitToFal('fal-ai/wan/v2.5/text-to-video', {
      prompt: 'a test',
      aspect_ratio: '9:16',
      duration: 6,
    });
    expect(id).toBe('req-123');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain(
      'https://queue.fal.run/fal-ai/wan/v2.5/text-to-video'
    );
    expect(url).toContain('fal_webhook=');
    expect(decodeURIComponent(url)).toContain('token=shh-secret');
    expect(init.headers.Authorization).toBe('Key test-key');
    expect(JSON.parse(init.body).prompt).toBe('a test');
  });

  it('throws with the response body on a non-OK submit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'bad input',
    });
    await expect(submitToFal('fal-ai/x', { prompt: 'p' })).rejects.toThrow(
      /422.*bad input/s
    );
  });

  it('verifies the webhook token constant-time', () => {
    expect(verifyWebhookToken('shh-secret')).toBe(true);
    expect(verifyWebhookToken('wrong')).toBe(false);
    expect(verifyWebhookToken(null)).toBe(false);
  });

  it('parses a success payload to videoUrl', () => {
    const out = parseFalWebhook({
      request_id: 'req-123',
      status: 'OK',
      payload: { video: { url: 'https://cdn.fal/video.mp4' } },
    });
    expect(out).toEqual({
      providerJobId: 'req-123',
      ok: true,
      videoUrl: 'https://cdn.fal/video.mp4',
    });
  });

  it('parses an error payload to a failure with message', () => {
    const out = parseFalWebhook({
      request_id: 'req-9',
      status: 'ERROR',
      error: 'content policy violation',
      payload: null,
    });
    expect(out.ok).toBe(false);
    expect(out.errorMessage).toMatch(/content policy/);
    expect(out.isPolicyRejection).toBe(true);
  });

  it('treats OK without a video url as a failure with a clean message', () => {
    const out = parseFalWebhook({
      request_id: 'r2',
      status: 'OK',
      payload: {},
    });
    expect(out.ok).toBe(false);
    expect(out.errorMessage).toBe('unknown fal error');
  });

  describe('getFalStatus', () => {
    it('queries the queue status endpoint with auth', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'COMPLETED' }),
      });
      const { getFalStatus } =
        await import('@/lib/services/ai/video/fal-adapter');
      const s = await getFalStatus('fal-ai/wan/v2.5/text-to-video', 'req-1');
      expect(s).toBe('COMPLETED');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://queue.fal.run/fal-ai/wan/v2.5/text-to-video/requests/req-1/status'
      );
      expect(init.headers.Authorization).toBe('Key test-key');
    });
  });
});
