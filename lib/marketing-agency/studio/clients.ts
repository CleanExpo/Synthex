/**
 * Per-client studio configs (SYN-1005 / VS-3).
 *
 * Pilot = RestoreAssist. Avatar/voice/consent are PLACEHOLDERS, overridable by env,
 * so the loop is demonstrable end-to-end now and the real IDs are a one-line swap
 * once the HeyGen avatar + ElevenLabs voice + signed consent record exist.
 */

import type { ClientStudioConfig } from './client-content-loop';

export const RESTOREASSIST_STUDIO_CONFIG: ClientStudioConfig = {
  clientSlug: 'restoreassist',
  displayName: 'RestoreAssist',
  // PLACEHOLDER — set RA_HEYGEN_AVATAR_ID once a RestoreAssist avatar exists in HeyGen.
  avatarId: process.env.RA_HEYGEN_AVATAR_ID ?? 'PLACEHOLDER_AVATAR_ID',
  // PLACEHOLDER — default ElevenLabs 'rachel'; set RA_ELEVENLABS_VOICE_ID for a cloned voice.
  voiceId: process.env.RA_ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM',
  consent: {
    subjectName:
      process.env.RA_PRESENTER_NAME ?? 'RestoreAssist Presenter (placeholder)',
    sourceRef: process.env.RA_CONSENT_REF ?? 'PLACEHOLDER_CONSENT_REF',
    confirmedAt: '2026-05-29T00:00:00.000Z',
  },
  platforms: ['linkedin', 'youtube'],
};

export const CARSI_STUDIO_CONFIG: ClientStudioConfig = {
  clientSlug: 'carsi',
  displayName: 'CARSI',
  // PLACEHOLDER — set CARSI_HEYGEN_AVATAR_ID when a CARSI-approved presenter avatar exists.
  avatarId: process.env.CARSI_HEYGEN_AVATAR_ID ?? 'PLACEHOLDER_AVATAR_ID',
  // PLACEHOLDER — default ElevenLabs 'rachel'; set CARSI_ELEVENLABS_VOICE_ID for approved voice.
  voiceId: process.env.CARSI_ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM',
  consent: {
    subjectName:
      process.env.CARSI_PRESENTER_NAME ?? 'CARSI Presenter (placeholder)',
    sourceRef: process.env.CARSI_CONSENT_REF ?? 'PLACEHOLDER_CONSENT_REF',
    confirmedAt: '2026-06-11T00:00:00.000Z',
  },
  platforms: ['blog', 'linkedin', 'youtube_shorts'],
};

/** Registry — new clients (CCW, Disaster Recovery, …) get added here as they come online. */
export const STUDIO_CLIENTS: Record<string, ClientStudioConfig> = {
  restoreassist: RESTOREASSIST_STUDIO_CONFIG,
  carsi: CARSI_STUDIO_CONFIG,
};

export function getStudioClient(slug: string): ClientStudioConfig | undefined {
  return STUDIO_CLIENTS[slug];
}
