/**
 * Brand Video planning and job-claim logic — SYN-1113.
 *
 * Extracted from `scripts/brand-video-worker.ts` so it can be tested. That
 * script is an ESM entrypoint that derives `__filename` from `import.meta.url`
 * and calls `main()` at module scope, so it cannot be imported at all: any
 * import ran the worker and exited the process. Nothing in it had coverage as a
 * result, which is how `count` came to be selected from the database twice and
 * never read.
 *
 * These functions are the decision-making parts. The provider calls (ElevenLabs,
 * image generation, ffmpeg) stay in the script.
 */

/** A queued Brand Video render job, as stored in `brand_video_jobs`. */
export interface BrandVideoJob {
  id: string;
  brand: string;
  style: string;
  topic: string;
  count: number;
  status: string;
  organization_id: string | null;
  created_by: string | null;
}

/** The columns `claimJob` reads. Kept in one place so both queries agree. */
export const BRAND_VIDEO_JOB_COLUMNS =
  'id, brand, style, topic, count, status, organization_id, created_by';

/**
 * Split a topic into visual beats — one short sentence each, one image each.
 *
 * Returns an empty array for an empty or punctuation-only topic, which is what
 * lets the worker fail the job as 'Empty topic' before spending on voiceover.
 *
 * A beat must contain a letter or a digit to count. Filtering on `Boolean`
 * alone was not enough: `'...!?'` has no whitespace to split on, so it survived
 * as a single beat and `'. . .'` became three, and the worker then paid for
 * voiceover and images for a topic with no words in it.
 */
export function toBeats(topic: string): string[] {
  return topic
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(beat => /[\p{L}\p{N}]/u.test(beat));
}

/**
 * Minimal shape of the Supabase client this module needs, so a test can supply a
 * fake without depending on `@/lib/platform/noop-client` internals.
 */
export interface JobQueueClient {
  from(table: string): any;
}

/**
 * Claim the oldest queued job.
 *
 * The read and the write are separate statements, so two workers can select the
 * same candidate. The `status = 'queued'` filter on the update is the only thing
 * preventing a double render: exactly one update matches a row, and the loser
 * gets no row back and returns null.
 */
export async function claimJob(
  platform: JobQueueClient
): Promise<BrandVideoJob | null> {
  const { data: candidates, error: selectError } = await platform
    .from('brand_video_jobs')
    .select(BRAND_VIDEO_JOB_COLUMNS)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  // Both queries previously discarded `error`, so a database failure was
  // indistinguishable from an empty queue: the worker logged "nothing to do"
  // and slept while the queue backed up. Only the lost-update race may return
  // null; everything else has to surface.
  if (selectError) {
    throw new Error(
      `Failed to read the Brand Video queue: ${selectError.message}`
    );
  }

  const job = candidates?.[0] as BrandVideoJob | undefined;
  if (!job) return null;

  // maybeSingle, not single: losing the race is an expected zero-row result,
  // and `single()` reports that as a PGRST116 error, which would be
  // indistinguishable here from a genuine failure.
  const { data: claimed, error: claimError } = await platform
    .from('brand_video_jobs')
    .update({ status: 'rendering', updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'queued') // lost-update guard
    .select(BRAND_VIDEO_JOB_COLUMNS)
    .maybeSingle();

  if (claimError) {
    throw new Error(
      `Failed to claim Brand Video job ${job.id}: ${claimError.message}`
    );
  }

  return (claimed as BrandVideoJob) ?? null;
}
