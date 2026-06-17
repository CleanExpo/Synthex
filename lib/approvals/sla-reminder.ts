/**
 * Approval SLA reminders (backlog #12 follow-up).
 *
 * Closes the sliver left open by the threaded-comments work (#483/#485): an
 * approval can carry a `dueDate`, but nothing nudged anyone when it lapsed.
 * This worker finds still-open approvals whose due date has passed and have not
 * yet been reminded, and notifies the submitter via the existing notifications
 * mechanism (the same `notifications` table the @-mention path and the
 * NotificationBell use). It then stamps `slaReminderSentAt` so the daily cron
 * does not re-notify on every run — mirroring the `followUpSentAt` dedupe in
 * the review-follow-up cron.
 *
 * Reviewers/approvers live in the approval's JSON `steps` with no FK, so the
 * reminder targets the submitter (a guaranteed real user) who owns chasing the
 * stalled item — not a fragile parse of the step shape.
 */
import prisma from '@/lib/prisma';

export interface SendApprovalSlaRemindersInput {
  /** Injectable clock — defaults to now. The cron passes nothing. */
  now?: Date;
}

export interface ApprovalSlaReminderResult {
  reminded: number;
}

/** Approvals still awaiting a decision (a closed approval cannot be overdue). */
const OPEN_STATUSES = ['pending', 'in_review'] as const;

export async function sendApprovalSlaReminders(
  input: SendApprovalSlaRemindersInput = {}
): Promise<ApprovalSlaReminderResult> {
  const now = input.now ?? new Date();

  // Open approvals whose due date has lapsed and have not yet been reminded.
  // `dueDate: { lte: now }` already excludes nulls.
  const overdue = await prisma.approvalRequest.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] },
      dueDate: { lte: now },
      slaReminderSentAt: null,
    },
    select: { id: true, title: true, submittedBy: true },
  });

  if (overdue.length === 0) return { reminded: 0 };

  await prisma.notification.createMany({
    data: overdue.map(a => ({
      userId: a.submittedBy,
      type: 'warning',
      title: `Approval overdue: "${a.title}"`,
      message:
        'This approval request has passed its due date and is still awaiting a decision.',
      data: { source: 'approval_sla_reminder', approvalId: a.id },
    })),
  });

  // Stamp so the next run does not re-notify the same approvals.
  await prisma.approvalRequest.updateMany({
    where: { id: { in: overdue.map(a => a.id) } },
    data: { slaReminderSentAt: now },
  });

  return { reminded: overdue.length };
}
