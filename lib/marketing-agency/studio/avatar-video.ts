/**
 * Client Content Studio — voice→avatar composition (SYN-1005 / VS-2).
 *
 * Composes the two providers into one step: ElevenLabs synthesises the script to
 * audio, the audio is uploaded to a reachable URL, and HeyGen renders the avatar
 * lip-syncing to that audio. Dependencies are injected so this is unit-testable
 * with no network or storage, and so the storage backend (Supabase, etc.) stays
 * a caller concern.
 */

import type { HeyGenClient } from '../heygen/client';
import type {
  HeyGenAvatarVideoJob,
  HeyGenConsentMetadata,
} from '../heygen/types';

/** Subset of the existing ElevenLabs service contract we depend on. */
export interface SpeechResult {
  success: boolean;
  audioBase64?: string;
  contentType?: string;
  error?: string;
}

export interface GenerateAvatarVideoDeps {
  /** ElevenLabs TTS — lib/services/ai/voice-generation.ts `generateSpeech`. */
  generateSpeech: (opts: {
    text: string;
    voiceId?: string;
    outputFormat?: string;
  }) => Promise<SpeechResult>;
  /** Persist audio (base64) and return a publicly reachable URL for HeyGen. */
  uploadAudio: (audioBase64: string, contentType: string) => Promise<string>;
  /** HeyGen client (createAvatarVideo). */
  heygen: Pick<HeyGenClient, 'createAvatarVideo'>;
}

export interface GenerateAvatarVideoInput {
  avatarId: string;
  script: string;
  consent: HeyGenConsentMetadata | null;
  voiceId?: string;
  dimension?: { width: number; height: number };
  title?: string;
}

export class VoiceGenerationFailedError extends Error {
  constructor(detail: string) {
    super(`Voice generation failed: ${detail}`);
    this.name = 'VoiceGenerationFailedError';
  }
}

/**
 * Produce an avatar video for a client: synthesise voice, then render the avatar
 * lip-syncing to it. Throws VoiceGenerationFailedError before any HeyGen call if
 * speech synthesis fails (no wasted avatar render). Consent is forwarded to HeyGen,
 * which enforces it.
 */
export async function generateAvatarVideo(
  input: GenerateAvatarVideoInput,
  deps: GenerateAvatarVideoDeps
): Promise<HeyGenAvatarVideoJob> {
  const speech = await deps.generateSpeech({
    text: input.script,
    voiceId: input.voiceId,
    outputFormat: 'mp3_44100_128',
  });

  if (!speech.success || !speech.audioBase64) {
    throw new VoiceGenerationFailedError(speech.error ?? 'no audio returned');
  }

  const audioUrl = await deps.uploadAudio(
    speech.audioBase64,
    speech.contentType ?? 'audio/mpeg'
  );

  return deps.heygen.createAvatarVideo({
    avatarId: input.avatarId,
    script: input.script,
    consent: input.consent,
    audioUrl,
    dimension: input.dimension,
    title: input.title,
  });
}
