/**
 * Phase 7: Autopilot drafts a week. A human still approves.
 * Off (enabled: false) is enforced by the cron query. On never auto-sends.
 */

export function holdAutopilotForReview(
  decision: 'schedule' | 'draft' | 'reject'
): 'draft' | 'reject' {
  if (decision === 'reject') return 'reject';
  return 'draft';
}
