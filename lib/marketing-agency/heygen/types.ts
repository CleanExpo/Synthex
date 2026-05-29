export interface HeyGenConsentMetadata {
  subjectName: string;
  sourceRef: string;
  confirmedAt: string;
}

export interface HeyGenAvatarVideoRequest {
  avatarId: string;
  /** Spoken text — used when HeyGen does the TTS (no `audioUrl` supplied). */
  script: string;
  consent: HeyGenConsentMetadata | null;
  /** Preferred: a pre-generated audio track (e.g. ElevenLabs) for the avatar to lip-sync to. */
  audioUrl?: string;
  /** HeyGen voice id, used only for the text→speech path when `audioUrl` is absent. */
  voiceId?: string;
  /** Output dimensions; defaults to 1280×720. */
  dimension?: { width: number; height: number };
  /** Optional human-readable title for the HeyGen job. */
  title?: string;
}

export type HeyGenJobStatus =
  | 'mocked'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface HeyGenAvatarVideoJob {
  id: string;
  provider: 'heygen';
  status: HeyGenJobStatus;
  videoUrl?: string;
  error?: string;
}

export interface HeyGenClientConfig {
  /** Defaults to `process.env.HEYGEN_API_KEY`. */
  apiKey?: string;
  /** Defaults to https://api.heygen.com */
  baseUrl?: string;
  /** Injectable fetch for testing; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Safety contract: with NO api key the client throws HeyGenConfigurationError
   * (consistent with the other marketing-agency providers — never make/imitate a
   * live call silently). Set this true ONLY for explicit dev/preview runs that
   * want a mock job instead of a hard block.
   */
  allowMockFallback?: boolean;
}
