import type {
  HeyGenAvatarVideoJob,
  HeyGenAvatarVideoRequest,
  HeyGenClientConfig,
  HeyGenJobStatus,
} from './types';
import { createMockHeyGenAvatarVideo } from './mock';

const DEFAULT_BASE_URL = 'https://api.heygen.com';

export class HeyGenConfigurationError extends Error {
  constructor(
    message = 'HeyGen API credentials are required for live avatar video generation.'
  ) {
    super(message);
    this.name = 'HeyGenConfigurationError';
  }
}

export class HeyGenConsentError extends Error {
  constructor(
    message = 'Consent metadata is required before real-person likeness generation.'
  ) {
    super(message);
    this.name = 'HeyGenConsentError';
  }
}

export class HeyGenApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(`HeyGen API error ${status}: ${message}`);
    this.name = 'HeyGenApiError';
    this.status = status;
  }
}

/** Map HeyGen's status_v1 / status strings to our normalised union. */
function mapStatus(raw: string | undefined): HeyGenJobStatus {
  switch (raw) {
    case 'completed':
    case 'success':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    case 'pending':
    case 'waiting':
    case 'processing':
    default:
      return 'processing';
  }
}

export interface HeyGenClient {
  createAvatarVideo(request: HeyGenAvatarVideoRequest): Promise<HeyGenAvatarVideoJob>;
  getVideoStatus(videoId: string): Promise<HeyGenAvatarVideoJob>;
  waitForCompletion(
    videoId: string,
    opts?: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> }
  ): Promise<HeyGenAvatarVideoJob>;
}

export function createHeyGenClient(config: HeyGenClientConfig = {}): HeyGenClient {
  const apiKey = config.apiKey ?? process.env.HEYGEN_API_KEY;
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const doFetch = config.fetchImpl ?? fetch;

  async function createAvatarVideo(
    request: HeyGenAvatarVideoRequest
  ): Promise<HeyGenAvatarVideoJob> {
    // Likeness of a real person requires recorded consent — enforced regardless of key.
    if (!request.consent) {
      throw new HeyGenConsentError();
    }

    // No key configured: hard-block by default (cross-provider safety contract —
    // never imitate a live call silently). Mock only on explicit opt-in.
    if (!apiKey) {
      if (config.allowMockFallback) {
        return createMockHeyGenAvatarVideo(request);
      }
      throw new HeyGenConfigurationError();
    }

    // Prefer a pre-generated audio track (ElevenLabs) for lip-sync; else HeyGen TTS.
    const voice = request.audioUrl
      ? { type: 'audio', audio_url: request.audioUrl }
      : { type: 'text', input_text: request.script, voice_id: request.voiceId };

    const body = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: request.avatarId,
            avatar_style: 'normal',
          },
          voice,
        },
      ],
      dimension: request.dimension ?? { width: 1280, height: 720 },
      ...(request.title ? { title: request.title } : {}),
      /** Real-person avatars require likeness terms confirmation. */
      areLikenessTermsAccepted: true,
    };

    const res = await doFetch(`${baseUrl}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new HeyGenApiError(res.status, await safeText(res));
    }

    const json = (await res.json()) as {
      data?: { video_id?: string };
      error?: unknown;
    };
    const videoId = json?.data?.video_id;
    if (!videoId) {
      throw new HeyGenApiError(res.status, 'response missing data.video_id');
    }

    return { id: videoId, provider: 'heygen', status: 'queued' };
  }

  async function getVideoStatus(videoId: string): Promise<HeyGenAvatarVideoJob> {
    const url = `${baseUrl}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`;
    const res = await doFetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': apiKey ?? '', Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new HeyGenApiError(res.status, await safeText(res));
    }

    const json = (await res.json()) as {
      data?: { status?: string; video_url?: string; error?: { message?: string } };
    };
    const status = mapStatus(json?.data?.status);
    return {
      id: videoId,
      provider: 'heygen',
      status,
      videoUrl: json?.data?.video_url,
      error: json?.data?.error?.message,
    };
  }

  async function waitForCompletion(
    videoId: string,
    opts: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {}
  ): Promise<HeyGenAvatarVideoJob> {
    const timeoutMs = opts.timeoutMs ?? 180_000;
    const intervalMs = opts.intervalMs ?? 5_000;
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
    const deadline = timeoutMs / Math.max(intervalMs, 1);

    for (let i = 0; i <= deadline; i++) {
      const job = await getVideoStatus(videoId);
      if (job.status === 'completed' || job.status === 'failed') return job;
      await sleep(intervalMs);
    }
    throw new HeyGenApiError(408, `video ${videoId} did not complete within ${timeoutMs}ms`);
  }

  return { createAvatarVideo, getVideoStatus, waitForCompletion };
}

async function safeText(res: { text: () => Promise<string> }): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<unreadable body>';
  }
}
