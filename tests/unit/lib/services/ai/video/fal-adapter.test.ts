/**
 * WS2 / SYN-1075 — submit-path liveness surfacing.
 * fal retires model endpoints without notice, returning a 404-class
 * "Path ... not found" response instead of a normal generation failure.
 * These tests lock: (1) submitToFal maps that into a typed ModelRetiredError
 * + fires a Sentry event, (2) a genuine non-retirement failure still throws
 * a plain Error, (3) getFalResult does the same 404-class mapping.
 *
 * No network calls — fetch is fully mocked.
 */
/** @jest-environment node */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCaptureServerException = jest.fn();
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: (...args: unknown[]) =>
    mockCaptureServerException(...args),
}));

import { submitToFal, getFalResult } from '@/lib/services/ai/video/fal-adapter';
import { ModelRetiredError } from '@/lib/services/ai/video/types';

const ENV_KEYS = ['FAL_API_KEY', 'NEXT_PUBLIC_APP_URL', 'FAL_WEBHOOK_SECRET'];

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FAL_API_KEY = 'test-fal-key';
  process.env.NEXT_PUBLIC_APP_URL = 'https://synthex.social';
  process.env.FAL_WEBHOOK_SECRET = 'test-webhook-secret';
  fetchSpy = jest.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('submitToFal — retired model detection', () => {
  it('maps a 404 response to ModelRetiredError and fires a Sentry event', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Path /v2.5/text-to-video not found',
    } as Response);

    await expect(
      submitToFal('fal-ai/wan/v2.5/text-to-video', { prompt: 'x' })
    ).rejects.toThrow(ModelRetiredError);

    expect(mockCaptureServerException).toHaveBeenCalledTimes(1);
    const [err, context] = mockCaptureServerException.mock.calls[0];
    expect(err).toBeInstanceOf(ModelRetiredError);
    expect(context).toMatchObject({
      operation: 'video/fal-submit',
      level: 'error',
      tags: expect.objectContaining({
        code: 'model_retired',
        modelId: 'fal-ai/wan/v2.5/text-to-video',
        httpStatus: 404,
      }),
    });
  });

  it('maps a non-404 "no longer available" body to ModelRetiredError', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 410,
      text: async () => 'This model is no longer available.',
    } as Response);

    await expect(
      submitToFal('bytedance/seedance-2.0/fast/text-to-video', { prompt: 'x' })
    ).rejects.toThrow(ModelRetiredError);
  });

  it('a genuine non-retirement failure (e.g. 500) throws a plain Error, no ModelRetiredError, no Sentry model_retired tag', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal provider error',
    } as Response);

    await expect(
      submitToFal('fal-ai/kling-video/v3/pro/text-to-video', { prompt: 'x' })
    ).rejects.toThrow('fal submit failed (500)');

    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it('a successful submit returns the request id and never calls Sentry', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ request_id: 'req-123' }),
    } as Response);

    const id = await submitToFal('fal-ai/kling-video/v3/pro/text-to-video', {
      prompt: 'x',
    });
    expect(id).toBe('req-123');
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });
});

describe('getFalResult — retired model detection on the result poll', () => {
  it('maps a 404 result fetch to ModelRetiredError', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Path not found',
    } as Response);

    await expect(
      getFalResult('fal-ai/wan/v2.5/text-to-video', 'req-1')
    ).rejects.toThrow(ModelRetiredError);
  });

  it('returns the video url on a completed result', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ video: { url: 'https://cdn.fal.run/v.mp4' } }),
    } as Response);

    const result = await getFalResult(
      'fal-ai/kling-video/v3/pro/text-to-video',
      'req-1'
    );
    expect(result.videoUrl).toBe('https://cdn.fal.run/v.mp4');
  });
});
