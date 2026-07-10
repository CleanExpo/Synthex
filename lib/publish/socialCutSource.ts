/**
 * socialCutSource — lib/publish/socialCutSource.ts
 *
 * Reconciles the social-cut → dispatch data path (SYN-1094 item 3).
 *
 * `deriveSocialCut` (lib/video/social-derivation.ts) does NOT create a real
 * `CalendarSlot`. It lands the cut on a `videoAsset` (the media) and anchors a
 * `publish_queue` row whose `slotId` is the sentinel `social-cut:<assetId>`
 * (NOT a calendar slot id). The queue dispatcher (`processPublishQueue`) and the
 * safety gates (`runSafetyChecks`), however, read the caption + rendered video +
 * YouTube snippet from a `CalendarSlot` in the ContentCalendar JSON. So a
 * human-released social-cut row had no slot to source its media from and could
 * never physically dispatch.
 *
 * This module is the bridge: given a `social-cut:` slotId it resolves the same
 * publish inputs a CalendarSlot would carry (caption, video URL, optional
 * YouTube snippet) straight from where `deriveSocialCut` stored them — the
 * `videoAsset` and its `metadata.derivation`.
 *
 * Org-scoped + fail-closed: it returns a source ONLY for a genuine
 * `deriveSocialCut` asset whose stored `metadata.organizationId` matches the
 * caller's org and that has a non-empty video URL. Anything else → null (the
 * caller then holds the row). It never touches the queue row's status, so it
 * cannot move a row towards `pending` — the §15.9 human-gate invariant is
 * untouched (the human release route remains the sole gated→pending transition).
 *
 * @task SYN-1094
 */

import prisma from '@/lib/prisma';

/** Sentinel prefix `deriveSocialCut` writes into `publish_queue.slotId`. */
export const SOCIAL_CUT_SLOT_PREFIX = 'social-cut:';

/** True when a queue row is a nexus-viral social cut rather than a calendar slot. */
export function isSocialCutSlot(slotId: string): boolean {
  return slotId.startsWith(SOCIAL_CUT_SLOT_PREFIX);
}

/**
 * The publish inputs a social cut carries — the same shape the dispatcher would
 * otherwise read off a CalendarSlot (caption + rendered video + optional YouTube
 * search package).
 */
export interface SocialCutPublishSource {
  caption: string;
  video: { url: string; thumbnail?: string };
  youtube?: { title?: string; description?: string; tags?: string[] };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readYoutube(
  value: unknown
): SocialCutPublishSource['youtube'] | undefined {
  const yt = readRecord(value);
  if (!yt) return undefined;
  const title = typeof yt.title === 'string' ? yt.title : undefined;
  const description =
    typeof yt.description === 'string' ? yt.description : undefined;
  const tags = Array.isArray(yt.tags)
    ? yt.tags.filter((t): t is string => typeof t === 'string')
    : undefined;
  if (title === undefined && description === undefined && tags === undefined) {
    return undefined;
  }
  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(tags !== undefined ? { tags } : {}),
  };
}

/**
 * Resolve the publish source for a `social-cut:` queue row from the stored
 * `videoAsset`. Returns null (fail-closed) when the slotId is not a social cut,
 * the asset is missing, it is not a `deriveSocialCut` asset, it belongs to a
 * different organisation, or it has no rendered video URL.
 */
export async function resolveSocialCutSource(
  slotId: string,
  organizationId: string
): Promise<SocialCutPublishSource | null> {
  if (!isSocialCutSlot(slotId)) return null;

  const assetId = slotId.slice(SOCIAL_CUT_SLOT_PREFIX.length);
  if (!assetId) return null;

  const asset = await prisma.videoAsset.findUnique({
    where: { id: assetId },
    select: { url: true, thumbnail: true, metadata: true },
  });
  if (!asset) return null;

  const metadata = readRecord(asset.metadata);
  // Only a genuine deriveSocialCut asset for THIS org is a valid publish source.
  if (metadata?.source !== 'deriveSocialCut') return null;
  if (metadata?.organizationId !== organizationId) return null;

  const url = typeof asset.url === 'string' ? asset.url : '';
  if (!url) return null;

  const derivation = readRecord(metadata.derivation);
  const captionRecord = readRecord(derivation?.caption);
  const caption =
    typeof captionRecord?.text === 'string' ? captionRecord.text : '';

  const youtube = readYoutube(metadata.youtube);

  return {
    caption,
    video: {
      url,
      ...(typeof asset.thumbnail === 'string' && asset.thumbnail
        ? { thumbnail: asset.thumbnail }
        : {}),
    },
    ...(youtube ? { youtube } : {}),
  };
}
