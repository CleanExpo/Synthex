/**
 * SYN-1404: put finished CCW campaign videos on the CCW studio board, where
 * Toby watches and signs them off (sign-off only: Approve schedules nothing).
 *
 * Dry run by default: checks every file and prints the drafts. Touches nothing.
 *   npx tsx scripts/load-ccw-studio-drafts.ts --files <files.json>
 * Write (production storage and database; Phill approves first):
 *   npx tsx scripts/load-ccw-studio-drafts.ts --files <files.json> --execute
 *
 * <files.json> maps a video id to its delivery copy: { "ccw-w1-d1-am": "/path.mp4", ... }.
 * Idempotent: a draft is keyed by video id; one Toby has already signed off is
 * never overwritten (saveStudioDraft).
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CCW_DELIVERY } from './render-ccw-shortform';
import {
  DEFAULT_WHISPER_MODEL,
  MIN_SPEECH_MATCH,
  ccwVoiceover,
} from './check-video-delivery';
import {
  DeliveryNotReadyError,
  SHORT_FORM_DELIVERY,
  evaluateDelivery,
  measureDelivery,
  measureSpeechMatch,
} from '../lib/video/delivery-readiness';
import { ccwVideoSlots } from '../lib/marketing-agency/ccw-video-campaign-2026-11';
import {
  CCW_REVIEW_BUCKET,
  CCW_REVIEW_LINK_TTL_SECONDS,
  CCW_STUDIO_CLIENT_SLUG,
  buildCcwStudioDraft,
  ccwReviewStoragePath,
} from '../lib/marketing-agency/ccw-video-campaign-2026-11-studio';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const filesArg = arg('--files');
  if (!filesArg) throw new Error('missing --files <files.json>');
  const files = JSON.parse(fs.readFileSync(filesArg, 'utf8')) as Record<
    string,
    string
  >;

  const videos = Object.entries(files).map(([id, file]) => {
    const slot = ccwVideoSlots.find(s => s.id === id);
    if (!slot) throw new Error(`unknown video id ${id}`);
    // The client watches exactly this file: it must pass the full delivery
    // check (format every player decodes, sound the whole length, levelled,
    // spoken words match the script) before it goes anywhere near the board.
    const measures = measureDelivery(file);
    const md = path.resolve(
      'docs/campaigns/ccw-2026-11-video/scripts',
      `${id}.md`
    );
    if (!fs.existsSync(md)) throw new Error(`no finalised script for ${id}`);
    const voiceover = ccwVoiceover(fs.readFileSync(md, 'utf8'));
    measures.speechMatch = measureSpeechMatch(
      file,
      voiceover,
      process.env.WHISPER_MODEL || DEFAULT_WHISPER_MODEL
    );
    const ready = evaluateDelivery(measures, {
      ...SHORT_FORM_DELIVERY,
      maxBytes: CCW_DELIVERY.maxBytes,
      minSpeechMatch: MIN_SPEECH_MATCH,
    });
    if (!ready.ready) {
      throw new DeliveryNotReadyError(file, ready.failures);
    }
    const buf = fs.readFileSync(file);
    return {
      slot,
      file,
      voiceover,
      buf,
      bytes: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      storagePath: ccwReviewStoragePath(slot),
    };
  });

  if (!execute) {
    for (const v of videos) {
      const draft = buildCcwStudioDraft(v.slot, '<ccw org>', {
        videoUrl: '<signed url>',
        voiceover: v.voiceover,
        storagePath: v.storagePath,
        sha256: v.sha256,
        bytes: v.bytes,
      });
      console.log(
        `${v.slot.id}  ${v.bytes} bytes  sha256 ${v.sha256}\n  ${draft.topic}\n  -> ${CCW_REVIEW_BUCKET}/${v.storagePath}`
      );
    }
    console.log(`DRY RUN: ${videos.length} drafts, nothing written`);
    return;
  }

  // Loaded only on --execute, so a dry run needs no database or storage keys.
  const { default: prisma } = await import('../lib/prisma');
  const storage = await import('../lib/storage/object-storage');
  const { saveStudioDraft } =
    await import('../lib/marketing-agency/studio/draft-store');

  const org = await prisma.organization.findUnique({
    where: { slug: CCW_STUDIO_CLIENT_SLUG },
    select: { id: true },
  });
  if (!org)
    throw new Error(`organisation '${CCW_STUDIO_CLIENT_SLUG}' not found`);

  for (const v of videos) {
    // Never replace a stored copy: Toby may already have signed it off. A
    // re-run with the same file is fine; a different file under the same
    // path stops the run.
    try {
      await storage.upload(
        CCW_REVIEW_BUCKET,
        v.storagePath,
        v.buf,
        'video/mp4'
      );
    } catch (error) {
      const stored = await storage
        .download(CCW_REVIEW_BUCKET, v.storagePath)
        .catch(() => null);
      if (!stored) throw error;
      const storedSha = createHash('sha256').update(stored).digest('hex');
      if (storedSha !== v.sha256) {
        throw new Error(
          `${v.slot.id}: a different file is already stored at ${v.storagePath} (sha256 ${storedSha}); not replaced`
        );
      }
    }
    const [videoUrl] = await storage.signedUrls(
      CCW_REVIEW_BUCKET,
      [v.storagePath],
      CCW_REVIEW_LINK_TTL_SECONDS
    );
    const row = await saveStudioDraft(
      buildCcwStudioDraft(v.slot, org.id, {
        videoUrl,
        storagePath: v.storagePath,
        sha256: v.sha256,
        bytes: v.bytes,
      })
    );
    console.log(`${v.slot.id}: draft ${row.id} (${row.status})`);
  }
  await prisma.$disconnect();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
