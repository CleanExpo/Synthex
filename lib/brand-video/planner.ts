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

/** What went wrong, from a closed set: the only error detail the public log shows. */
export type BrandVideoErrorCode =
  | 'QUEUE_READ_FAILED'
  | 'QUEUE_CLAIM_FAILED'
  | 'STATUS_WRITE_FAILED';

/**
 * A queue failure. `message` carries the database's own text and may hold
 * anything, so it is stored only in the job's private error column; the public
 * log shows `code` and, when it has the database error-code shape, `dbCode`.
 */
export class BrandVideoQueueError extends Error {
  constructor(
    readonly code: BrandVideoErrorCode,
    message: string,
    readonly dbCode?: string
  ) {
    super(message);
    this.name = 'BrandVideoQueueError';
  }
}

const dbCodeOf = (error: { code?: unknown }): string | undefined =>
  typeof error.code === 'string' ? error.code : undefined;

/**
 * Minimal shape of the query client this module needs. The worker injects its
 * own client; tests supply a fake.
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
    throw new BrandVideoQueueError(
      'QUEUE_READ_FAILED',
      `Failed to read the Brand Video queue: ${selectError.message}`,
      dbCodeOf(selectError)
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
    throw new BrandVideoQueueError(
      'QUEUE_CLAIM_FAILED',
      `Failed to claim Brand Video job ${job.id}: ${claimError.message}`,
      dbCodeOf(claimError)
    );
  }

  return (claimed as BrandVideoJob) ?? null;
}

/** The fields the worker may set when a job finishes or fails. */
export interface BrandVideoJobStatusPatch {
  status: 'done' | 'failed';
  output_url?: string | null;
  error?: string | null;
}

/**
 * Record a job's final status. Exactly one row must change: a query error and
 * a zero-row update (the row was deleted or its id is wrong) both throw, so a
 * status write that did not happen can never be logged as done (SYN-1145).
 */
export async function setJobStatus(
  platform: JobQueueClient,
  jobId: string,
  patch: BrandVideoJobStatusPatch
): Promise<void> {
  const { data, error } = await platform
    .from('brand_video_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select('id');

  if (error) {
    throw new BrandVideoQueueError(
      'STATUS_WRITE_FAILED',
      `Failed to set Brand Video job ${jobId} to ${patch.status}: ${error.message}`,
      dbCodeOf(error)
    );
  }
  const rows = Array.isArray(data) ? data.length : 0;
  if (rows !== 1) {
    throw new BrandVideoQueueError(
      'STATUS_WRITE_FAILED',
      `Failed to set Brand Video job ${jobId} to ${patch.status}: ${rows} rows changed, expected 1`
    );
  }
}
