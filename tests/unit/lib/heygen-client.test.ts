/**
 * Unit tests for the HeyGen live client (SYN-1006 / VS-1).
 * Uses an injected fetchImpl — no global mocks, no network.
 */

import {
  createHeyGenClient,
  HeyGenConsentError,
  HeyGenConfigurationError,
  HeyGenApiError,
} from '@/lib/marketing-agency/heygen/client';
import type { HeyGenAvatarVideoRequest } from '@/lib/marketing-agency/heygen/types';

const consent = {
  subjectName: 'Phill McGurk',
  sourceRef: 'consent-doc-1',
  confirmedAt: '2026-05-29T00:00:00Z',
};

function res(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const baseReq: HeyGenAvatarVideoRequest = {
  avatarId: 'avatar_123',
  script: 'Hello from RestoreAssist',
  consent,
};

describe('createHeyGenClient.createAvatarVideo', () => {
  it('throws HeyGenConsentError when consent is missing (even with a key)', async () => {
    const fetchImpl = jest.fn();
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });
    await expect(
      client.createAvatarVideo({ ...baseReq, consent: null })
    ).rejects.toBeInstanceOf(HeyGenConsentError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('hard-blocks (throws HeyGenConfigurationError) when no key and no opt-in (safety contract)', async () => {
    const fetchImpl = jest.fn();
    const client = createHeyGenClient({ apiKey: undefined, fetchImpl });
    await expect(client.createAvatarVideo(baseReq)).rejects.toBeInstanceOf(
      HeyGenConfigurationError
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to a mock job ONLY with explicit allowMockFallback (no network call)', async () => {
    const fetchImpl = jest.fn();
    const client = createHeyGenClient({
      apiKey: undefined,
      allowMockFallback: true,
      fetchImpl,
    });
    const job = await client.createAvatarVideo(baseReq);
    expect(job.status).toBe('mocked');
    expect(job.id).toContain('mock-heygen-');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts an audio-driven job when audioUrl is supplied (ElevenLabs lip-sync path)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(res({ data: { video_id: 'vid_abc' } }));
    const client = createHeyGenClient({
      apiKey: 'secret-key',
      baseUrl: 'https://api.heygen.com',
      fetchImpl,
    });

    const job = await client.createAvatarVideo({
      ...baseReq,
      audioUrl: 'https://cdn.example.com/voice.mp3',
    });

    expect(job).toEqual({ id: 'vid_abc', provider: 'heygen', status: 'queued' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.heygen.com/v2/video/generate');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Api-Key']).toBe('secret-key');
    const sent = JSON.parse(init.body);
    expect(sent.video_inputs[0].voice).toEqual({
      type: 'audio',
      audio_url: 'https://cdn.example.com/voice.mp3',
    });
    expect(sent.video_inputs[0].character.avatar_id).toBe('avatar_123');
  });

  it('posts a text-TTS job when no audioUrl is supplied', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(res({ data: { video_id: 'vid_text' } }));
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });

    await client.createAvatarVideo({ ...baseReq, voiceId: 'voice_9' });

    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.video_inputs[0].voice).toEqual({
      type: 'text',
      input_text: 'Hello from RestoreAssist',
      voice_id: 'voice_9',
    });
  });

  it('throws HeyGenApiError on a non-ok response', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(res({ error: 'quota' }, { ok: false, status: 429 }));
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });
    await expect(client.createAvatarVideo(baseReq)).rejects.toBeInstanceOf(
      HeyGenApiError
    );
  });

  it('throws when the response is missing data.video_id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(res({ data: {} }));
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });
    await expect(client.createAvatarVideo(baseReq)).rejects.toBeInstanceOf(
      HeyGenApiError
    );
  });
});

describe('createHeyGenClient.getVideoStatus', () => {
  it('maps a completed status with the video url', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      res({ data: { status: 'completed', video_url: 'https://cdn/v.mp4' } })
    );
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });
    const job = await client.getVideoStatus('vid_abc');
    expect(job.status).toBe('completed');
    expect(job.videoUrl).toBe('https://cdn/v.mp4');
  });

  it('maps pending/processing/waiting to processing', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(res({ data: { status: 'pending' } }));
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });
    expect((await client.getVideoStatus('v')).status).toBe('processing');
  });
});

describe('createHeyGenClient.waitForCompletion', () => {
  it('polls until the job completes', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(res({ data: { status: 'processing' } }))
      .mockResolvedValueOnce(
        res({ data: { status: 'completed', video_url: 'https://cdn/final.mp4' } })
      );
    const client = createHeyGenClient({ apiKey: 'k', fetchImpl });

    const job = await client.waitForCompletion('vid_abc', {
      intervalMs: 10,
      timeoutMs: 1000,
      sleep: async () => undefined, // no real delay in tests
    });

    expect(job.status).toBe('completed');
    expect(job.videoUrl).toBe('https://cdn/final.mp4');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
