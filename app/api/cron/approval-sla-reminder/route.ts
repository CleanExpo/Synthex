/**
 * Approval SLA Reminder Cron (backlog #12).
 *
 * GET /api/cron/approval-sla-reminder
 * Runs daily. Finds still-open approval requests whose due date has lapsed and
 * have not yet been reminded, and notifies the submitter. Delegates to the
 * `sendApprovalSlaReminders` worker (separately unit-tested).
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET_APPROVAL_SLA_REMINDER (or shared CRON_SECRET): cron authorisation.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { sendApprovalSlaReminders } from '@/lib/approvals/sla-reminder';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/observability/sentry-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'APPROVAL_SLA_REMINDER');
  if (!auth.ok) return auth.response;

  try {
    const { reminded } = await sendApprovalSlaReminders();
    logger.info('cron:approval-sla-reminder:done', { reminded });
    return NextResponse.json({ ok: true, reminded });
  } catch (error) {
    logger.error('cron:approval-sla-reminder:error', {
      error: error instanceof Error ? error.message : String(error),
    });
    captureServerException(error, {
      level: 'error',
      operation: 'cron/approval-sla-reminder',
      tags: { cron: 'approval-sla-reminder' },
    });
    return NextResponse.json(
      { ok: false, error: 'Failed to send approval SLA reminders' },
      { status: 500 }
    );
  }
}
