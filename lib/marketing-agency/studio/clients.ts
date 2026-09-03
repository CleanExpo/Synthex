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

/**
 * The likeness consent as the Studio stores it: the HeyGen record plus the
 * avatar and voice it was given for, and who recorded it.
 */
export type StudioConsent = HeyGenConsentMetadata & {
  avatarId?: string;
  voiceId?: string;
  recordedBy?: string;
  recordedAt?: string;
};

export interface StudioVideoConfig {
  avatarId: string;
  voiceId: string;
  consent: StudioConsent;
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

/**
 * A likeness consent names the avatar and the voice it was given FOR. The
 * video pipeline runs only when they match the configured ones, so a later
 * partial write of `avatarId` alone can never render a different person under
 * someone else's consent. `recordedBy` / `recordedAt` are stamped by the
 * organisation PATCH route from the authenticated caller, never client-supplied.
 */
const consentSchema = z
  .object({
    subjectName: z.string().min(1),
    sourceRef: z.string().min(1),
    confirmedAt: z.string().min(1),
    avatarId: z.string().min(1).optional(),
    voiceId: z.string().min(1).optional(),
    recordedBy: z.string().min(1).optional(),
    recordedAt: z.string().min(1).optional(),
  })
  .strict();

/** The nine platforms lib/social supports; the bound the approval loop runs to. */
export const MAX_STUDIO_PLATFORMS = 9;

/**
 * The ONE predicate for a funnel link, whichever path it arrives by: an
 * absolute http(s) URL. `settings.studio.funnelUrl` (validated on write and on
 * read) and the `Organization.website` fallback both run it, so the write
 * path, the read path and the fallback cannot disagree.
 */
export const funnelUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * Shape of `Organization.settings.studio`. Exported so the organisation PATCH
 * route validates a write with the same schema the Studio reads with.
 */
export const studioSettingsSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    platforms: z
      .array(z.string().min(1))
      .min(1)
      .max(MAX_STUDIO_PLATFORMS)
      .optional(),
    funnelUrl: funnelUrlSchema.optional(),
    avatarId: z.string().min(1).optional(),
    voiceId: z.string().min(1).optional(),
    consent: consentSchema.optional(),
    dimension: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
  })
  // Strict, so a misspelt key (`funnelURL`) is a 400 at the PATCH rather than
  // a value silently dropped at the next read.
  .strict();

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
    // The consent must name THIS avatar and THIS voice. A consent recorded
    // for one presenter never authorises a render of another.
    if (consent.avatarId !== avatarId || consent.voiceId !== voiceId) {
      warnings.push(
        `settings.studio consent does not name the configured avatar and voice (consent names ${consent.avatarId ?? 'no avatar'} / ${consent.voiceId ?? 'no voice'}; configured ${avatarId} / ${voiceId}) — video is off until the consent names them`
      );
      return null;
    }
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
    // The env layer configures one presenter per prefix, so the consent is
    // for exactly that avatar and voice by construction.
    return {
      avatarId,
      voiceId,
      consent: { subjectName, sourceRef, confirmedAt, avatarId, voiceId },
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
 * `Organization.website` is free text nothing ever required to be a URL. It
 * becomes a funnel link only when it is an absolute http(s) URL — the shape
 * `buildUtmUrl` parses — otherwise the post carries no link and the board says
 * why. A bare domain typed into a profile form must never make every approval
 * fail with "Invalid URL".
 */
function funnelFromWebsite(
  website: string | null | undefined,
  warnings: string[]
): string | null {
  if (!website) return null;
  const value = website.trim();
  if (funnelUrlSchema.safeParse(value).success) {
    return value;
  }
  warnings.push(
    `organisation website is not an absolute http(s) URL (${value}) — no funnel link is attached; set settings.studio.funnelUrl`
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
    funnelUrl: studio?.funnelUrl ?? funnelFromWebsite(org.website, warnings),
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
