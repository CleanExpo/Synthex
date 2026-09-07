/**
 * One customer language for posts. Database values stay as-is.
 */

export type CustomerPostStatus =
  | 'Draft'
  | 'Ready'
  | 'Scheduled'
  | 'Posted'
  | 'Failed';

const STATUS_MAP: Record<string, CustomerPostStatus> = {
  draft: 'Draft',
  pending: 'Ready',
  pending_approval: 'Ready',
  ready: 'Ready',
  approved: 'Ready',
  scheduled: 'Scheduled',
  queued: 'Scheduled',
  published: 'Posted',
  posted: 'Posted',
  live: 'Posted',
  failed: 'Failed',
  failed_permanently: 'Failed',
  error: 'Failed',
};

export function customerPostStatus(
  raw: string | undefined
): CustomerPostStatus {
  if (!raw) return 'Draft';
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'Draft';
}
