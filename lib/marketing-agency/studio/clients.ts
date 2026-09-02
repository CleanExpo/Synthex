/**
 * Per-business Studio configuration (SYN-1005 / VS-3, reworked for the vault — g9).
 *
 * Resolution is ORG-DRIVEN: the organisation record is the source of truth, so a
 * business that exists in the vault is usable in the Studio with no code change.
 * Precedence for the video identity (avatar + voice + likeness consent):
 *
 *   1. `Organization.settings.studio` — writable via PATCH /api/organizations/[orgId]
 *   2. the legacy env layer for the two original pilots (`RA_*` / `CARSI_*`)
 *   3. nothing — `video: null`
 *
 * NO PLACEHOLDER IS EVER SUBSTITUTED. The previous hardcoded registry fell back to
 * `PLACEHOLDER_AVATAR_ID` and the stock ElevenLabs 'Rachel' voice, which with live
 * provider keys meant HeyGen was called with an avatar that does not exist. An
 * unconfigured business now gets a usable board and an explicit `video: null`; the
 * video pipeline refuses it through `toClientStudioConfig`.
 */

import { z } from 'zod';
import type { ClientStudioConfig } from './client-content-loop';
import type { HeyGenConsentMetadata } from '@/lib/marketing-agency/heygen/types';

/** The slice of `Organization` the Studio reads. */
export interface StudioOrganizationRecord {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  /** `Organization.settings` — a free JSON column; only `.studio` is read here. */
  settings?: unknown;
}

export interface StudioVideoConfig {
  avatarId: string;
  voiceId: string;
  consent: HeyGenConsentMetadata;
  dimension?: { width: number; height: number };
}

export interface ResolvedStudioClient {
  organizationId: string;
  clientSlug: string;
  displayName: string;
  /** Distribution targets for drafts the Studio generates. */
  platforms: string[];
  /**
   * Where a post's funnel link points: `settings.studio.funnelUrl`, else the
   * business website, else null (no link is attached).
   */
  funnelUrl: string | null;
  /** Real avatar + voice + consent, or null. Never a placeholder. */
  video: StudioVideoConfig | null;
  configSource: 'org_settings' | 'env' | 'none';
  /** Why something is off — surfaced on the board rather than swallowed. */
  warnings: string[];
}

export const DEFAULT_STUDIO_PLATFORMS: readonly string[] = ['linkedin'];

/**
 * Legacy env prefixes for the two original pilots. New businesses use
 * `settings.studio`; these stay so the six production variables named in the
 * vault contract (g8) keep working once they are set.
 */
export const STUDIO_ENV_PREFIXES: Record<string, string> = {
  restoreassist: 'RA',
  carsi: 'CARSI',
};

const consentSchema = z.object({
  subjectName: z.string().min(1),
  sourceRef: z.string().min(1),
  confirmedAt: z.string().min(1),
});

const studioSettingsSchema = z.object({
  displayName: z.string().min(1).optional(),
  platforms: z.array(z.string().min(1)).min(1).optional(),
  funnelUrl: z.string().url().optional(),
  avatarId: z.string().min(1).optional(),
  voiceId: z.string().min(1).optional(),
  consent: consentSchema.optional(),
  dimension: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
});

/** Shape of `Organization.settings.studio`. */
export type StudioSettings = z.infer<typeof studioSettingsSchema>;

export class StudioVideoNotConfiguredError extends Error {
  constructor(clientSlug: string, warnings: string[]) {
    super(
      `Studio video is not configured for ${clientSlug}: ${
        warnings.join('; ') || 'no avatar, voice or consent on the organisation'
      }`
    );
    this.name = 'StudioVideoNotConfiguredError';
  }
}

function readStudioSettings(
  settings: unknown,
  warnings: string[]
): StudioSettings | null {
  if (
    settings === null ||
    typeof settings !== 'object' ||
    Array.isArray(settings)
  ) {
    return null;
  }
  const raw = (settings as Record<string, unknown>).studio;
  if (raw === undefined || raw === null) return null;

  const parsed = studioSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    warnings.push(`settings.studio is invalid and was ignored: ${detail}`);
    return null;
  }
  return parsed.data;
}

function videoFromSettings(
  studio: StudioSettings | null,
  warnings: string[]
): StudioVideoConfig | null {
  if (!studio) return null;
  const { avatarId, voiceId, consent, dimension } = studio;
  if (!avatarId && !voiceId && !consent) return null;

  if (avatarId && voiceId && consent) {
    return { avatarId, voiceId, consent, ...(dimension ? { dimension } : {}) };
  }

  const missing: string[] = [];
  if (!avatarId) missing.push('avatarId');
  if (!voiceId) missing.push('voiceId');
  if (!consent) missing.push('consent');
  warnings.push(
    `settings.studio video is incomplete — missing ${missing.join(', ')}`
  );
  return null;
}

function videoFromEnv(
  slug: string,
  env: NodeJS.ProcessEnv,
  warnings: string[]
): StudioVideoConfig | null {
  const prefix = STUDIO_ENV_PREFIXES[slug];
  if (!prefix) return null;

  const names = {
    avatarId: `${prefix}_HEYGEN_AVATAR_ID`,
    voiceId: `${prefix}_ELEVENLABS_VOICE_ID`,
    sourceRef: `${prefix}_CONSENT_REF`,
    subjectName: `${prefix}_PRESENTER_NAME`,
    confirmedAt: `${prefix}_CONSENT_CONFIRMED_AT`,
  };
  const read = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value ? value : undefined;
  };
  const avatarId = read(names.avatarId);
  const voiceId = read(names.voiceId);
  const sourceRef = read(names.sourceRef);
  const subjectName = read(names.subjectName);
  const confirmedAt = read(names.confirmedAt);

  if (!avatarId && !voiceId && !sourceRef && !subjectName && !confirmedAt) {
    return null;
  }
  if (avatarId && voiceId && sourceRef && subjectName && confirmedAt) {
    return {
      avatarId,
      voiceId,
      consent: { subjectName, sourceRef, confirmedAt },
    };
  }

  const missing = Object.entries(names)
    .filter(([, name]) => !read(name))
    .map(([, name]) => name);
  warnings.push(
    `env video config for ${slug} is incomplete — missing ${missing.join(', ')}`
  );
  return null;
}

/**
 * Derive the Studio client for an organisation. Pure: no Prisma, no network.
 * `env` is injectable so the legacy layer is testable without touching
 * `process.env`.
 */
export function resolveStudioClient(
  org: StudioOrganizationRecord,
  env: NodeJS.ProcessEnv = process.env
): ResolvedStudioClient {
  const warnings: string[] = [];
  const studio = readStudioSettings(org.settings, warnings);

  let video = videoFromSettings(studio, warnings);
  let configSource: ResolvedStudioClient['configSource'] = video
    ? 'org_settings'
    : 'none';
  if (!video) {
    video = videoFromEnv(org.slug, env, warnings);
    if (video) configSource = 'env';
  }

  return {
    organizationId: org.id,
    clientSlug: org.slug,
    displayName: studio?.displayName ?? org.name,
    platforms: studio?.platforms ?? [...DEFAULT_STUDIO_PLATFORMS],
    funnelUrl: studio?.funnelUrl ?? org.website ?? null,
    video,
    configSource,
    warnings,
  };
}

/**
 * The video pipeline's contract requires a real avatar, voice and consent.
 * Refuse — loudly — rather than run a business with none of them.
 */
export function toClientStudioConfig(
  client: ResolvedStudioClient
): ClientStudioConfig {
  if (!client.video) {
    throw new StudioVideoNotConfiguredError(client.clientSlug, client.warnings);
  }
  return {
    clientSlug: client.clientSlug,
    displayName: client.displayName,
    avatarId: client.video.avatarId,
    voiceId: client.video.voiceId,
    consent: client.video.consent,
    platforms: client.platforms,
    ...(client.video.dimension ? { dimension: client.video.dimension } : {}),
  };
}
