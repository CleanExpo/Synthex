/**
 * Promote an approved UGC submission into a calendar slot (backlog #6).
 *
 *   POST /api/ugc/promote  → { submissionId, calendarId, scheduledAt, platform?, contentType? }
 *
 * This is the trigger that closes the UGC loop: the intake/moderation route
 * (/api/ugc) flips a submission to `approved`, and this route hands that
 * approved row to the `promoteApprovedSubmission` worker, which shapes it into a
 * ContentCalendar slot via the SYN-1040 publish primitive. Persisting a slot
 * does NOT publish — the scheduler still owns the safety-gate.
 *
 * Promotion is an explicit, per-submission action (the caller chooses the target
 * calendar + schedule), so it is a route rather than a blind cron: a cron has no
 * way to pick the calendar or posting time for an approved submission.
 *
 * Org-scoped via withAuth's clientId. The worker's typed errors map to HTTP:
 *   SubmissionNotFound / CalendarNotFound → 404 (also the cross-org guard)
 *   SubmissionNotApproved                → 409 (wrong state)
 *   MissingPlatform                       → 400
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import {
  promoteApprovedSubmission,
  SubmissionNotFoundError,
  SubmissionNotApprovedError,
  MissingPlatformError,
} from '@/lib/ugc/promote-submission';
import { CalendarNotFoundError } from '@/lib/workflow/persist-publish-slot';

export const runtime = 'nodejs';

const PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
] as const;

const CONTENT_TYPES = [
  'educational',
  'promotional',
  'engagement',
  'behind-the-scenes',
  'testimonial',
  'trending',
] as const;

const promoteSchema = z.object({
  submissionId: z.string().min(1).max(64),
  calendarId: z.string().min(1).max(64),
  scheduledAt: z.string().datetime(),
  // Optional; defaults to the linked creator's platform inside the worker.
  // Constrained to the calendar-supported set so an unsupported platform is a
  // 400 here rather than an unhandled mapper throw.
  platform: z.enum(PLATFORMS).optional(),
  contentType: z.enum(CONTENT_TYPES).optional(),
});

export const POST = defineRoute(
  {
    body: promoteSchema,
    serverErrorMessage: 'Failed to promote UGC submission',
    onError: error =>
      logger.error('ugc: promote failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId }) => {
    try {
      const promoted = await promoteApprovedSubmission({
        organizationId: clientId,
        submissionId: body.submissionId,
        calendarId: body.calendarId,
        scheduledAt: new Date(body.scheduledAt),
        platform: body.platform,
        contentType: body.contentType,
      });
      return NextResponse.json({ promoted }, { status: 201 });
    } catch (error) {
      if (
        error instanceof SubmissionNotFoundError ||
        error instanceof CalendarNotFoundError
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof SubmissionNotApprovedError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error instanceof MissingPlatformError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error; // → defineRoute centralized 500
    }
  }
);
