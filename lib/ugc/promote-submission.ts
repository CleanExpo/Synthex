/**
 * Promote an approved UGC submission into a ContentCalendar slot (backlog #6).
 *
 * Closes the loop opened by the `/api/ugc` intake route: once a submission is
 * moderated to `approved`, this worker shapes it into a calendar slot via the
 * existing SYN-1040 primitive (`persistPublishSlot`) so the publish scheduler can
 * later enqueue it. Persisting a slot does NOT publish anything — the scheduler
 * still owns the safety-gate.
 *
 * Reuses the workflow publish primitives rather than adding a parallel pipeline:
 *   read approved submission (org-scoped) → persistPublishSlot(caption) → slot id.
 *
 * Idempotency is the caller's concern — this promotes one named submission, so a
 * cron/route decides which approved rows to promote and avoids double-promotion.
 */
import prisma from '@/lib/prisma';
import { persistPublishSlot } from '@/lib/workflow/persist-publish-slot';
import type { WorkflowContentToSlotInput } from '@/lib/workflow/publish-mapping';

/** Thrown when no org-scoped submission exists for the requested id. */
export class SubmissionNotFoundError extends Error {
  constructor(
    public readonly organizationId: string,
    public readonly submissionId: string
  ) {
    super(
      `promoteApprovedSubmission: no submission "${submissionId}" for organisation "${organizationId}"`
    );
    this.name = 'SubmissionNotFoundError';
  }
}

/** Thrown when a submission is not in the `approved` state. */
export class SubmissionNotApprovedError extends Error {
  constructor(
    public readonly submissionId: string,
    public readonly status: string
  ) {
    super(
      `promoteApprovedSubmission: submission "${submissionId}" is "${status}", not "approved"`
    );
    this.name = 'SubmissionNotApprovedError';
  }
}

/** Thrown when no target platform can be determined for the slot. */
export class MissingPlatformError extends Error {
  constructor(public readonly submissionId: string) {
    super(
      `promoteApprovedSubmission: submission "${submissionId}" has no platform — pass one or link a creator with a platform`
    );
    this.name = 'MissingPlatformError';
  }
}

export interface PromoteApprovedSubmissionInput {
  organizationId: string;
  /** The approved UGC submission to promote. */
  submissionId: string;
  /** The ContentCalendar to append the slot to. */
  calendarId: string;
  /** Target platform; defaults to the linked creator's platform. */
  platform?: string;
  /** When the resulting post should be scheduled. */
  scheduledAt: Date;
  /** Content category; defaults to 'educational' in the mapper. */
  contentType?: WorkflowContentToSlotInput['contentType'];
}

/**
 * Read the org-scoped approved submission and persist its caption as a calendar
 * slot. The org-scope on the read is the cross-org guard — a submission belonging
 * to another organisation is invisible and surfaces as SubmissionNotFoundError.
 * A foreign/missing calendar surfaces as CalendarNotFoundError (from
 * persistPublishSlot); an unsupported platform throws via the slice-1 mapper.
 */
export async function promoteApprovedSubmission(
  input: PromoteApprovedSubmissionInput
): Promise<{ calendarId: string; slotId: string; submissionId: string }> {
  const submission = await prisma.ugcSubmission.findFirst({
    where: { id: input.submissionId, organizationId: input.organizationId },
    include: { creator: { select: { platform: true } } },
  });
  if (!submission) {
    throw new SubmissionNotFoundError(input.organizationId, input.submissionId);
  }
  if (submission.status !== 'approved') {
    throw new SubmissionNotApprovedError(input.submissionId, submission.status);
  }

  const platform = input.platform ?? submission.creator?.platform ?? undefined;
  if (!platform) {
    throw new MissingPlatformError(input.submissionId);
  }

  const { calendarId, slotId } = await persistPublishSlot({
    organizationId: input.organizationId,
    calendarId: input.calendarId,
    content: submission.caption ?? '',
    platform,
    scheduledAt: input.scheduledAt,
    contentType: input.contentType,
  });

  return { calendarId, slotId, submissionId: submission.id };
}
