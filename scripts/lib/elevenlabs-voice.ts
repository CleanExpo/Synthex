/**
 * ElevenLabs voice id resolution for the brand audio/video scripts — PURE
 * (env in, id out). Shared by scripts/brand-video-worker.ts,
 * scripts/generate-brand-audio.ts and scripts/render-and-upload-videos.ts so
 * they cannot drift apart again.
 *
 * Fails closed: there is no stock default voice. A missing id used to fall back
 * to ElevenLabs' 'Rachel' voice, silently producing wrong-voice (non-brand,
 * non-Australian) audio instead of an error.
 */

type Env = Record<string, string | undefined>;

export function resolveElevenLabsVoiceId(
  env: Env = process.env,
  warn: (message: string) => void = console.warn
): string {
  const voiceId = env.ELEVENLABS_VOICE_ID?.trim();
  if (voiceId) return voiceId;

  // Deprecated misspelling, still accepted so an existing deployment keeps working.
  const typoVoiceId = env.ELEVENLABS_VIOCE_ID?.trim();
  if (typoVoiceId) {
    warn(
      '[elevenlabs] ELEVENLABS_VIOCE_ID is deprecated (misspelt) — rename it to ELEVENLABS_VOICE_ID.'
    );
    return typoVoiceId;
  }

  throw new Error(
    'ELEVENLABS_VOICE_ID is not set. Set it to the brand ElevenLabs voice id — there is no default voice.'
  );
}
