/**
 * Review Request Service
 *
 * Automates the post-job review generation loop:
 * 1. Send a personalised review request email immediately after job completion
 * 2. Auto-follow-up at day 3 if no review received
 * 3. Mark complete when GBP sync detects a new review
 *
 * Uses Resend (same lazy singleton pattern as lib/email/billing-emails.ts).
 * Fire-and-forget email sends — never await in the main request path.
 */

import { Resend } from 'resend';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Lazy singleton — won't throw on import if RESEND_API_KEY absent
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';

// ============================================================================
// SEND INITIAL REVIEW REQUEST
// ============================================================================

export async function sendReviewRequest(
  orgId: string,
  locationId: string,
  recipient: { recipientName: string; recipientEmail: string }
): Promise<{ reviewRequestId: string }> {
  // Fetch location to get the newReviewUri
  const location = await prisma.gBPLocation.findFirst({
    where: { organizationId: orgId, id: locationId },
    select: {
      locationName: true,
      newReviewUri: true,
    },
  });

  if (!location) {
    throw new Error(
      'Location not found or does not belong to this organisation'
    );
  }

  const reviewLink = location.newReviewUri;

  if (!reviewLink) {
    throw new Error(
      'No Google review link available for this location. Ensure the GBP connection has synced.'
    );
  }

  // Fetch org name for personalisation
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  // Create record first so we have an ID
  const reviewRequest = await prisma.reviewRequest.create({
    data: {
      organizationId: orgId,
      locationId,
      recipientName: recipient.recipientName,
      recipientEmail: recipient.recipientEmail,
      reviewLink,
      status: 'pending',
    },
  });

  // Fire-and-forget email
  getResend()
    .emails.send({
      from: FROM,
      to: recipient.recipientEmail,
      subject: `How did we go, ${recipient.recipientName}?`,
      html: buildReviewRequestEmail({
        recipientName: recipient.recipientName,
        businessName: org?.name ?? location.locationName ?? 'us',
        reviewLink,
        isFollowUp: false,
      }),
    })
    .catch((err: unknown) =>
      logger.error('review-request:send-failed', {
        reviewRequestId: reviewRequest.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );

  logger.info('review-request:sent', {
    reviewRequestId: reviewRequest.id,
    orgId,
    locationId,
    recipientEmail: recipient.recipientEmail,
  });

  return { reviewRequestId: reviewRequest.id };
}

// ============================================================================
// SEND FOLLOW-UP (called by cron at day 3)
// ============================================================================

export async function sendFollowUp(reviewRequestId: string): Promise<void> {
  const reviewRequest = await prisma.reviewRequest.findUnique({
    where: { id: reviewRequestId },
    include: {
      organization: { select: { name: true } },
    },
  });

  if (!reviewRequest) return;
  if (reviewRequest.status !== 'pending') return;
  if (reviewRequest.followUpSentAt) return; // Already sent

  getResend()
    .emails.send({
      from: FROM,
      to: reviewRequest.recipientEmail,
      subject: `Just checking in — ${reviewRequest.organization.name}`,
      html: buildReviewRequestEmail({
        recipientName: reviewRequest.recipientName,
        businessName: reviewRequest.organization.name,
        reviewLink: reviewRequest.reviewLink,
        isFollowUp: true,
      }),
    })
    .catch((err: unknown) =>
      logger.error('review-request:follow-up-failed', {
        reviewRequestId,
        error: err instanceof Error ? err.message : String(err),
      })
    );

  await prisma.reviewRequest.update({
    where: { id: reviewRequestId },
    data: {
      followUpSentAt: new Date(),
      status: 'followed_up',
    },
  });

  logger.info('review-request:follow-up-sent', { reviewRequestId });
}

// ============================================================================
// MARK REVIEW RECEIVED (called by gbp-monitor cron after sync)
// ============================================================================

export async function markReviewReceived(
  orgId: string,
  locationId: string
): Promise<void> {
  const updated = await prisma.reviewRequest.updateMany({
    where: {
      organizationId: orgId,
      locationId,
      status: { in: ['pending', 'followed_up'] },
      reviewReceivedAt: null,
    },
    data: {
      status: 'completed',
      reviewReceivedAt: new Date(),
    },
  });

  if (updated.count > 0) {
    logger.info('review-request:review-received', {
      orgId,
      locationId,
      count: updated.count,
    });
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function buildReviewRequestEmail(params: {
  recipientName: string;
  businessName: string;
  reviewLink: string;
  isFollowUp: boolean;
}): string {
  const { recipientName, businessName, reviewLink, isFollowUp } = params;

  const intro = isFollowUp
    ? `We noticed you haven't had a chance to leave us a review yet — no worries at all! If you have a spare minute, we'd genuinely love to hear about your experience.`
    : `We hope you're happy with the work we completed for you recently. If you have a moment, we'd really appreciate it if you could leave us a quick Google review — it helps us enormously.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#f97316;padding:24px 32px;">
      <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">${businessName}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:16px;">Hi ${recipientName},</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">${intro}</p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">It only takes 30 seconds — your feedback makes a real difference.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${reviewLink}"
           style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;">
          Leave a Google Review
        </a>
      </div>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">Thank you for choosing ${businessName}. We appreciate your support.</p>
    </div>
  </div>
</body>
</html>`;
}
