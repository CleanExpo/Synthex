/**
 * Social Derivation — lib/video/social-derivation.ts
 *
 * Triggers the social cascade when an episode is published to YouTube.
 *
 * Waterfall order (30-minute stagger between each platform):
 *   YouTube → LinkedIn (+30m) → Instagram (+60m) → Facebook (+90m)
 *   → Twitter (+120m) → TikTok (+150m) → Pinterest (+180m)
 *
 * Uses ContentRepurposer to generate 6 derivative formats from the
 * voiceover transcript, then dispatches via SocialMediaOrchestrator.
 *
 * Results are stored in VideoEpisode.socialPosts.
 *
 * @task SYN-585
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ContentRepurposer } from '@/lib/ai/content-repurposer';
import type { OutputFormat } from '@/lib/ai/content-repurposer';
import { VIRAL_SAFE_ZONE } from '@/lib/services/ai/video/cards/viral-method-cards';
import { nextMondayFrom, weekEndFromStart } from '@/lib/calendar/slotScheduler';
import type { ContentCalendarData } from '@/lib/calendar/types';
import { extractVoiceoverFromScript } from './quality-gate';
import { assertGatePassed } from './gates/assert-gate-passed';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Platforms and their stagger delays in minutes */
const CASCADE_ORDER: Array<{ platform: string; delayMinutes: number }> = [
  { platform: 'linkedin', delayMinutes: 30 },
  { platform: 'instagram', delayMinutes: 60 },
  { platform: 'facebook', delayMinutes: 90 },
  { platform: 'twitter', delayMinutes: 120 },
  { platform: 'tiktok', delayMinutes: 150 },
  { platform: 'pinterest', delayMinutes: 180 },
];

/** Map each platform to the best repurposing format */
const PLATFORM_FORMAT_MAP: Record<string, OutputFormat> = {
  twitter: 'thread',
  linkedin: 'key_takeaways',
  instagram: 'carousel_outline',
  facebook: 'summary',
  tiktok: 'video_script',
  pinterest: 'quote_graphics',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface SocialDerivationResult {
  episodeId: string;
  dispatched: Array<{
    platform: string;
    format: OutputFormat;
    scheduledAt: string;
    contentPreview: string;
  }>;
  skipped: string[];
  error?: string;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Derive social content from a published episode and schedule the cascade.
 */
export async function deriveAndScheduleSocialPosts(
  episodeId: string
): Promise<SocialDerivationResult> {
  logger.info('SocialDerivation: starting cascade', { episodeId });

  const episode = await prisma.videoEpisode.findUnique({
    where: { id: episodeId },
    include: { series: true },
  });

  if (!episode) {
    throw new Error(`SocialDerivation: episode not found: ${episodeId}`);
  }

  if (episode.status !== 'published') {
    logger.warn('SocialDerivation: episode not published — skipping', {
      episodeId,
      status: episode.status,
    });
    return {
      episodeId,
      dispatched: [],
      skipped: CASCADE_ORDER.map(c => c.platform),
    };
  }

  // Extract voiceover + description for repurposing
  const voiceover = extractVoiceoverFromScript(episode.scriptContent);
  const description =
    ((episode.scriptContent as Record<string, unknown> | null)
      ?.description as string) ?? '';

  if (!voiceover) {
    logger.warn('SocialDerivation: no voiceover found in scriptContent', {
      episodeId,
    });
    return {
      episodeId,
      dispatched: [],
      skipped: CASCADE_ORDER.map(c => c.platform),
    };
  }

  const sourceContent = `${episode.title}\n\n${voiceover}\n\n${description}`;
  const youtubeUrl = episode.youtubeUrl ?? '';

  // Generate derivative content formats
  const repurposer = new ContentRepurposer();
  const uniqueFormats = [
    ...new Set(Object.values(PLATFORM_FORMAT_MAP)),
  ] as OutputFormat[];

  let repurposed: Record<string, string> = {};
  try {
    const repurposeResult = await repurposer.repurpose({
      sourceContent,
      sourceType: 'video_transcript',
      outputFormats: uniqueFormats,
    });

    for (const r of repurposeResult.results) {
      repurposed[r.format] = r.content;
    }
  } catch (err) {
    logger.error('SocialDerivation: repurposer failed', {
      episodeId,
      error: String(err),
    });
    // Non-fatal — proceed with truncated voiceover as fallback
    repurposed = {};
  }

  // Schedule posts in waterfall order
  const now = new Date();
  const dispatched: SocialDerivationResult['dispatched'] = [];
  const skipped: string[] = [];
  const socialPostsRecord: Record<string, unknown> = {};

  for (const { platform, delayMinutes } of CASCADE_ORDER) {
    const format = PLATFORM_FORMAT_MAP[platform] as OutputFormat;
    const content = repurposed[format] ?? voiceover.substring(0, 280);

    const scheduledAt = new Date(now.getTime() + delayMinutes * 60_000);

    const captionWithLink = youtubeUrl
      ? `${content}\n\nWatch the full video: ${youtubeUrl}`
      : content;

    socialPostsRecord[platform] = {
      platform,
      format,
      content: captionWithLink,
      scheduledAt: scheduledAt.toISOString(),
      status: 'scheduled',
    };

    dispatched.push({
      platform,
      format,
      scheduledAt: scheduledAt.toISOString(),
      contentPreview: captionWithLink.substring(0, 100),
    });
  }

  // Persist social posts record to episode
  await prisma.videoEpisode.update({
    where: { id: episodeId },
    data: { socialPosts: socialPostsRecord as Prisma.InputJsonValue },
  });

  logger.info('SocialDerivation: cascade scheduled', {
    episodeId,
    platforms: dispatched.length,
  });

  return {
    episodeId,
    dispatched,
    skipped,
  };
}

/**
 * Find all published episodes that haven't had social derivation run yet.
 * Called by the social derivation cron.
 */
export async function findEpisodesNeedingSocialDerivation(
  limit = 5
): Promise<string[]> {
  // Fetch more than limit so we can post-filter for episodes without social posts
  const candidates = await prisma.videoEpisode.findMany({
    where: {
      status: 'published',
      youtubeVideoId: { not: null },
    },
    orderBy: { publishedAt: 'asc' },
    take: limit * 3,
    select: { id: true, socialPosts: true },
  });

  // Keep only episodes where socialPosts is null (haven't been processed yet)
  const episodes = candidates
    .filter(e => e.socialPosts === null || e.socialPosts === undefined)
    .slice(0, limit);

  return episodes.map(e => e.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// deriveSocialCut — platform-native cut adapter for the nexus-viral repurpose
// engine (skills-library/skills/nexus-viral/engine/repurpose.ts).
//
// Derives ONE cut from a passed hero short: aspect changes are centred crops,
// duration changes trim the tail (the hook stays), the caption is re-checked
// against the viral safe zone. No regenerate. The cut lands in video_assets as
// a 'pending' derivation record carrying the full render plan in metadata, and
// is enqueued to publish_queue as 'queued_human_gated'.
//
// Human-gate semantics: processPublishQueue only dispatches 'pending'/'failed'
// rows, so a 'queued_human_gated' row is inert until a human releases it. The
// queue row anchors to the org's latest ContentCalendar purely to satisfy the
// calendarId FK — its slotId ('social-cut:<assetId>') is not a calendar slot,
// so even a mistaken release fails closed at the slot_not_approved safety gate.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────────

export type SocialCutTarget = '9:16' | '1:1' | '16:9';
export type SocialCutCaptionPlacement = 'upper' | 'centre' | 'cover';

/** A rectangle in percent of the source frame */
export interface SocialCutBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export interface SocialCutTrim {
  fromSec: number;
  toSec: number;
  heroDurationKnown: boolean;
}

export interface SocialCutCaptionPlan {
  placement: SocialCutCaptionPlacement;
  band: SocialCutBox;
  estimatedLines: number;
  withinSafeZone: boolean;
}

export interface DeriveSocialCutInput {
  orgId: string;
  heroAssetId: string;
  target: SocialCutTarget;
  maxSec: number;
  captionPlacement: SocialCutCaptionPlacement;
  caption: string;
  trimFrom: 'tail';
  keepSubjectCentre: boolean;
  /**
   * Canonical Synthex platform id for the eventual publish. Optional — the
   * current nexus-viral consumer does not send one, so the queue row carries
   * 'unassigned' and cannot dispatch until a human assigns a platform at the
   * gate (an unknown platform is rejected by the publish adapter anyway).
   */
  platform?: string;
}

export interface DeriveSocialCutResult {
  assetId: string;
  subjectLost: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SOCIAL_CUT_TARGETS: readonly SocialCutTarget[] = ['9:16', '1:1', '16:9'];
const SOCIAL_CUT_PLACEMENTS: readonly SocialCutCaptionPlacement[] = [
  'upper',
  'centre',
  'cover',
];

/** Conservative wrap estimate for burned-in captions on a portrait frame */
const CAPTION_CHARS_PER_LINE = 32;

/**
 * Without subject evidence, a centred crop that keeps less than half of the
 * cropped dimension is drastic enough that any off-centre subject is likely
 * lost — flag it for human re-frame.
 */
const DRASTIC_CROP_RETENTION = 0.5;

/** Tolerance (percent points) when testing a subject box against the crop */
const SUBJECT_BOX_TOLERANCE_PCT = 1;

const SOCIAL_CUT_ANCHOR_VERSION = 'social-cut-anchor:v1';

// ── Pure derivation internals ────────────────────────────────────────────────

/** Parse a 'W:H' aspect string into a width/height ratio */
export function aspectToRatio(aspect: SocialCutTarget): number {
  const [w, h] = aspect.split(':').map(Number);
  return w / h;
}

/**
 * Centred crop window (percent of the source frame) that converts the source
 * aspect ratio into the target. Equal ratios return the full frame.
 */
export function computeCropWindow(
  sourceRatio: number,
  targetRatio: number
): SocialCutBox {
  const EPS = 1e-6;
  if (Math.abs(sourceRatio - targetRatio) < EPS) {
    return { xPct: 0, yPct: 0, wPct: 100, hPct: 100 };
  }
  if (targetRatio < sourceRatio) {
    // Target is narrower — crop width, keep full height
    const wPct = (targetRatio / sourceRatio) * 100;
    return { xPct: (100 - wPct) / 2, yPct: 0, wPct, hPct: 100 };
  }
  // Target is shorter — crop height, keep full width
  const hPct = (sourceRatio / targetRatio) * 100;
  return { xPct: 0, yPct: (100 - hPct) / 2, wPct: 100, hPct };
}

/** Trim from the tail: keep [0, maxSec] so the hook survives */
export function computeTailTrim(
  heroDurationSec: number | null,
  maxSec: number
): SocialCutTrim {
  return {
    fromSec: 0,
    toSec:
      heroDurationSec !== null ? Math.min(heroDurationSec, maxSec) : maxSec,
    heroDurationKnown: heroDurationSec !== null,
  };
}

/**
 * Place the caption band for the target frame and re-check it against the
 * viral safe zone (bottom/right reserved zones, max line count). Placement
 * never fails — an overflow is recorded so the human gate sees it.
 */
export function planCaptionPlacement(
  caption: string,
  placement: SocialCutCaptionPlacement
): SocialCutCaptionPlan {
  const xPct = 4;
  const wPct = 100 - VIRAL_SAFE_ZONE.rightReservedPct - xPct * 2;

  let band: SocialCutBox;
  switch (placement) {
    case 'upper':
      band = { xPct, yPct: 8, wPct, hPct: 20 };
      break;
    case 'centre':
      band = { xPct, yPct: 40, wPct, hPct: 20 };
      break;
    case 'cover':
      band = {
        xPct,
        yPct: 12,
        wPct,
        hPct: Math.min(60, 100 - VIRAL_SAFE_ZONE.bottomReservedPct - 12),
      };
      break;
  }

  const estimatedLines = Math.max(
    1,
    Math.ceil(caption.trim().length / CAPTION_CHARS_PER_LINE)
  );

  return {
    placement,
    band,
    estimatedLines,
    withinSafeZone: estimatedLines <= VIRAL_SAFE_ZONE.captionMaxLines,
  };
}

/**
 * Decide whether the crop loses the focal subject.
 *
 * Evidence-based when the hero metadata carries a subjectBox; otherwise only
 * a drastic crop (under DRASTIC_CROP_RETENTION of the cropped dimension) is
 * flagged — generated heroes compose the subject centred, so a mild centred
 * crop is assumed to keep it.
 */
export function assessSubjectLoss(args: {
  keepSubjectCentre: boolean;
  crop: SocialCutBox;
  subjectBox?: SocialCutBox | null;
}): boolean {
  const { keepSubjectCentre, crop, subjectBox } = args;
  if (!keepSubjectCentre) return false;

  const noCrop = crop.wPct === 100 && crop.hPct === 100;
  if (noCrop) return false;

  if (subjectBox) {
    const tol = SUBJECT_BOX_TOLERANCE_PCT;
    return (
      subjectBox.xPct < crop.xPct - tol ||
      subjectBox.yPct < crop.yPct - tol ||
      subjectBox.xPct + subjectBox.wPct > crop.xPct + crop.wPct + tol ||
      subjectBox.yPct + subjectBox.hPct > crop.yPct + crop.hPct + tol
    );
  }

  return Math.min(crop.wPct, crop.hPct) / 100 < DRASTIC_CROP_RETENTION;
}

// ── Hero resolution ──────────────────────────────────────────────────────────

interface ResolvedHero {
  kind: 'video_asset' | 'video_generation';
  founderId: string;
  title: string;
  url: string;
  thumbnail: string | null;
  durationSec: number | null;
  sourceRatio: number | null;
  subjectBox: SocialCutBox | null;
}

function readMetadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Parse 'W:H' (any positive integers) or a resolution object into a ratio */
function readAspectRatio(
  aspect: unknown,
  metadata: Record<string, unknown> | null
): number | null {
  const candidate = aspect ?? metadata?.aspectRatio;
  if (typeof candidate === 'string') {
    const match = /^(\d+):(\d+)$/.exec(candidate.trim());
    if (match) {
      const w = Number(match[1]);
      const h = Number(match[2]);
      if (w > 0 && h > 0) return w / h;
    }
  }
  const resolution = readMetadataRecord(metadata?.resolution);
  const width = Number(resolution?.width);
  const height = Number(resolution?.height);
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return width / height;
  }
  return null;
}

function readSubjectBox(
  metadata: Record<string, unknown> | null
): SocialCutBox | null {
  const box = readMetadataRecord(metadata?.subjectBox);
  if (!box) return null;
  const values = [box.xPct, box.yPct, box.wPct, box.hPct].map(Number);
  if (values.some(v => !Number.isFinite(v))) return null;
  const [xPct, yPct, wPct, hPct] = values;
  return { xPct, yPct, wPct, hPct };
}

/**
 * Resolve the hero org-scoped: video_assets first (promoted heroes), then the
 * generative engine's videoGeneration rows. Cross-org and missing heroes get
 * the same error so existence never leaks across organisations.
 */
async function resolveHero(
  orgId: string,
  heroAssetId: string
): Promise<ResolvedHero> {
  const notFound = () =>
    new Error(
      `SocialCut: hero asset not found for organisation: ${heroAssetId}`
    );

  const asset = await prisma.videoAsset.findUnique({
    where: { id: heroAssetId },
    include: { founder: { select: { organizationId: true } } },
  });

  if (asset) {
    if (asset.founder?.organizationId !== orgId) throw notFound();
    const metadata = readMetadataRecord(asset.metadata);
    return {
      kind: 'video_asset',
      founderId: asset.founderId,
      title: asset.title,
      url: asset.url,
      thumbnail: asset.thumbnail ?? null,
      durationSec: asset.duration ?? null,
      sourceRatio: readAspectRatio(null, metadata),
      subjectBox: readSubjectBox(metadata),
    };
  }

  const generation = await prisma.videoGeneration.findFirst({
    where: { id: heroAssetId, organizationId: orgId },
  });

  if (generation) {
    if (!generation.videoUrl) {
      throw new Error(`SocialCut: hero has no rendered video: ${heroAssetId}`);
    }
    const metadata = readMetadataRecord(generation.metadata);
    return {
      kind: 'video_generation',
      founderId: generation.userId,
      title: generation.title,
      url: generation.videoUrl,
      thumbnail: generation.thumbnailUrl ?? null,
      durationSec: generation.durationSeconds ?? null,
      sourceRatio: readAspectRatio(generation.aspectRatio, metadata),
      subjectBox: readSubjectBox(metadata),
    };
  }

  throw notFound();
}

// ── Queue anchor ─────────────────────────────────────────────────────────────

/**
 * publish_queue.calendarId is a required FK, so gated cut rows anchor to the
 * org's latest ContentCalendar. An org with no calendar yet gets a minimal
 * draft row for the upcoming week — the weekly generator upserts over it on
 * (organizationId, weekStart), so this never blocks generation.
 */
async function resolveQueueAnchorCalendar(orgId: string): Promise<string> {
  const existing = await prisma.contentCalendar.findFirst({
    where: { organizationId: orgId },
    orderBy: { weekStart: 'desc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const weekStart = nextMondayFrom(new Date());
  const weekEnd = weekEndFromStart(weekStart);
  const emptyWeek: ContentCalendarData = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    slots: [],
    signalsVersion: SOCIAL_CUT_ANCHOR_VERSION,
    digestCount: 0,
  };

  try {
    const created = await prisma.contentCalendar.create({
      data: {
        organizationId: orgId,
        weekStart,
        weekEnd,
        status: 'draft',
        signalsVersion: SOCIAL_CUT_ANCHOR_VERSION,
        slots: emptyWeek as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Unique (organizationId, weekStart) race — another writer created it first
    const raced = await prisma.contentCalendar.findFirst({
      where: { organizationId: orgId, weekStart },
      select: { id: true },
    });
    if (raced) return raced.id;
    throw err;
  }
}

// ── URL fragment ─────────────────────────────────────────────────────────────

/**
 * Encode the plan into a W3C Media Fragments URI (#t for the trim, #xywh for
 * the crop) so the cut URL is honestly playable against the hero source while
 * the physical render is pending. Hero URLs that already carry a fragment are
 * passed through untouched.
 */
function buildCutUrl(
  heroUrl: string,
  trim: SocialCutTrim,
  crop: SocialCutBox
): string {
  if (heroUrl.includes('#')) return heroUrl;
  const round = (n: number) => Math.round(n * 100) / 100;
  const cropped = crop.wPct !== 100 || crop.hPct !== 100;
  const xywh = cropped
    ? `&xywh=percent:${round(crop.xPct)},${round(crop.yPct)},${round(crop.wPct)},${round(crop.hPct)}`
    : '';
  return `${heroUrl}#t=${trim.fromSec},${round(trim.toSec)}${xywh}`;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Derive one platform-native social cut from a passed hero short.
 *
 * Lands the cut in video_assets (status 'pending', full derivation plan in
 * metadata) and enqueues it to publish_queue as 'queued_human_gated'. Never
 * auto-posts. Returns the new asset id plus whether the crop lost the focal
 * subject (the consumer's reframe flag).
 */
export async function deriveSocialCut(
  input: DeriveSocialCutInput
): Promise<DeriveSocialCutResult> {
  const {
    orgId,
    heroAssetId,
    target,
    maxSec,
    captionPlacement,
    caption,
    trimFrom,
    keepSubjectCentre,
  } = input;

  if (!orgId) throw new Error('SocialCut: orgId is required');
  if (!heroAssetId) throw new Error('SocialCut: heroAssetId is required');
  if (!SOCIAL_CUT_TARGETS.includes(target)) {
    throw new Error(`SocialCut: unsupported target aspect: ${String(target)}`);
  }
  if (!SOCIAL_CUT_PLACEMENTS.includes(captionPlacement)) {
    throw new Error(
      `SocialCut: unsupported captionPlacement: ${String(captionPlacement)}`
    );
  }
  if (!Number.isFinite(maxSec) || maxSec <= 0) {
    throw new Error(`SocialCut: maxSec must be a positive number: ${maxSec}`);
  }
  if (typeof caption !== 'string' || caption.trim().length === 0) {
    throw new Error('SocialCut: caption is required');
  }
  if (trimFrom !== 'tail') {
    throw new Error(
      `SocialCut: only trimFrom 'tail' is supported: ${String(trimFrom)}`
    );
  }

  logger.info('SocialCut: deriving cut', { orgId, heroAssetId, target });

  // Gate B (broadcast grill) enforcement — WIRED (SYN-1094, Option C, spec
  // §8(3) / §15(3)). Fail-closed BEFORE any cut is derived or enqueued: no
  // passing `video_gate_verdicts` row for (heroAssetId, 'broadcast') => this
  // throws GateFailedError and NO video_assets / publish_queue rows are
  // written. The verdict is written by runBroadcastGrill keyed on the same
  // hero id (see scripts/nexus-viral-run.ts Gate B), so a raw MCP derive_cuts
  // must run Gate B first or it is blocked here.
  await assertGatePassed(heroAssetId, 'broadcast');

  const hero = await resolveHero(orgId, heroAssetId);
  if (hero.sourceRatio === null) {
    throw new Error(
      `SocialCut: hero is missing aspect-ratio metadata — cannot compute crop: ${heroAssetId}`
    );
  }

  const crop = computeCropWindow(hero.sourceRatio, aspectToRatio(target));
  const trim = computeTailTrim(hero.durationSec, maxSec);
  const captionPlan = planCaptionPlacement(caption, captionPlacement);
  const subjectLost = assessSubjectLoss({
    keepSubjectCentre,
    crop,
    subjectBox: hero.subjectBox,
  });

  const calendarId = await resolveQueueAnchorCalendar(orgId);
  const cutUrl = buildCutUrl(hero.url, trim, crop);

  const cut = await prisma.$transaction(async tx => {
    const created = await tx.videoAsset.create({
      data: {
        founderId: hero.founderId,
        title: `${hero.title} — ${target} social cut`,
        url: cutUrl,
        thumbnail: hero.thumbnail,
        duration: Math.round(trim.toSec),
        status: 'pending', // physical render is downstream; plan is complete
        metadata: {
          source: 'deriveSocialCut',
          organizationId: orgId,
          derivedFrom: heroAssetId,
          heroKind: hero.kind,
          aspectRatio: target,
          derivation: {
            target,
            maxSec,
            trimFrom,
            keepSubjectCentre,
            crop,
            trim,
            caption: { text: caption, ...captionPlan },
            subjectLost,
            safeZone: { ...VIRAL_SAFE_ZONE },
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.publishQueueItem.create({
      data: {
        organizationId: orgId,
        calendarId,
        slotId: `social-cut:${created.id}`,
        platform: input.platform ?? 'unassigned',
        scheduledAt: new Date(),
        status: 'queued_human_gated',
      },
    });

    return created;
  });

  logger.info('SocialCut: cut derived and gated', {
    orgId,
    heroAssetId,
    assetId: cut.id,
    target,
    subjectLost,
  });

  return { assetId: cut.id, subjectLost };
}
