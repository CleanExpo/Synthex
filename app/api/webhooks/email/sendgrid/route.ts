/**
 * SendGrid Webhook Handler
 *
 * @description Handles SendGrid event webhooks:
 * - Delivery tracking (delivered, processed)
 * - Bounce handling (bounce, blocked)
 * - Complaint handling (spam_report)
 * - Open/click tracking (optional)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - SENDGRID_WEBHOOK_VERIFICATION_KEY: Webhook signature key (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: string;
  sg_event_id: string;
  sg_message_id: string;
  category?: string[];
  emailId?: string;
  type?: string;
  userId?: string;
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  url?: string;
  useragent?: string;
  ip?: string;
}

type EventType =
  | 'processed'
  | 'dropped'
  | 'delivered'
  | 'deferred'
  | 'bounce'
  | 'blocked'
  | 'open'
  | 'click'
  | 'spam_report'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'group_resubscribe';

// ============================================================================
// CONFIGURATION
// ============================================================================

const VERIFICATION_KEY = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY || '';

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

function verifySignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!VERIFICATION_KEY) {
    logger.warn('SendGrid webhook verification key not configured');
    return true; // Allow in development
  }

  const timestampPayload = timestamp + payload;
  const expectedSignature = crypto
    .createHmac('sha256', VERIFICATION_KEY)
    .update(timestampPayload)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleDelivered(event: SendGridEvent): Promise<void> {
  logger.info('Email delivered', {
    email: event.email,
    messageId: event.sg_message_id,
    emailId: event.emailId,
  });

  if (event.emailId) {
    await updateDeliveryStatus(event.emailId, 'delivered', event);
  }
}

async function handleBounce(event: SendGridEvent): Promise<void> {
  logger.warn('Email bounced', {
    email: event.email,
    messageId: event.sg_message_id,
    reason: event.reason,
    status: event.status,
  });

  if (event.emailId) {
    await updateDeliveryStatus(event.emailId, 'bounced', event);
  }

  // Mark email as invalid for future sends
  await markEmailInvalid(event.email, 'bounce', event.reason);
}

async function handleSpamReport(event: SendGridEvent): Promise<void> {
  logger.warn('Spam complaint received', {
    email: event.email,
    messageId: event.sg_message_id,
  });

  if (event.emailId) {
    await updateDeliveryStatus(event.emailId, 'complained', event);
  }

  // Mark email as unsubscribed/complained
  await markEmailInvalid(event.email, 'complaint');
}

async function handleDropped(event: SendGridEvent): Promise<void> {
  logger.warn('Email dropped', {
    email: event.email,
    messageId: event.sg_message_id,
    reason: event.reason,
  });

  if (event.emailId) {
    await updateDeliveryStatus(event.emailId, 'failed', event);
  }
}

async function handleOpen(event: SendGridEvent): Promise<void> {
  logger.debug('Email opened', {
    email: event.email,
    messageId: event.sg_message_id,
    ip: event.ip,
    useragent: event.useragent,
  });

  if (event.emailId) {
    await trackEngagement(event.emailId, 'open', event);
  }
}

async function handleClick(event: SendGridEvent): Promise<void> {
  logger.debug('Email link clicked', {
    email: event.email,
    messageId: event.sg_message_id,
    url: event.url,
  });

  if (event.emailId) {
    await trackEngagement(event.emailId, 'click', event);
  }
}

async function handleUnsubscribe(event: SendGridEvent): Promise<void> {
  logger.info('User unsubscribed', {
    email: event.email,
    messageId: event.sg_message_id,
  });

  await markEmailInvalid(event.email, 'unsubscribe');
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function updateDeliveryStatus(
  emailId: string,
  status: 'delivered' | 'bounced' | 'complained' | 'failed',
  event: SendGridEvent
): Promise<void> {
  try {
    await prisma.notification.update({
      where: { id: emailId },
      data: {
        message: status,
        data: {
          emailId,
          status,
          messageId: event.sg_message_id,
          timestamp: new Date(event.timestamp * 1000).toISOString(),
          reason: event.reason,
          response: event.response,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to update delivery status', { emailId, error });
  }
}

async function markEmailInvalid(
  email: string,
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  details?: string
): Promise<void> {
  try {
    // Check if user exists with this email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, preferences: true },
    });

    if (user) {
      // Update user preferences to mark as unsubscribed
      const currentPrefs = (user.preferences as Record<string, unknown>) || {};
      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: {
            ...currentPrefs,
            emailStatus: {
              status: reason === 'unsubscribe' ? 'unsubscribed' : 'invalid',
              reason,
              details,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      logger.info('Email marked as invalid', { email, reason, userId: user.id });
    }
  } catch (error) {
    logger.error('Failed to mark email as invalid', { email, error });
  }
}

async function trackEngagement(
  emailId: string,
  type: 'open' | 'click',
  event: SendGridEvent
): Promise<void> {
  try {
    // Get current notification data
    const notification = await prisma.notification.findUnique({
      where: { id: emailId },
      select: { data: true },
    });

    const currentData = (notification?.data as Record<string, unknown>) || {};
    const engagement = (currentData.engagement as Record<string, unknown>) || {};

    // Update engagement tracking
    const updatedData = {
      ...currentData,
      engagement: {
        ...engagement,
        [type]: {
          count: ((engagement[type] as { count?: number })?.count || 0) + 1,
          lastAt: new Date(event.timestamp * 1000).toISOString(),
          url: event.url,
          ip: event.ip,
          useragent: event.useragent,
        },
      },
    };

    await prisma.notification.update({
      where: { id: emailId },
      data: {
        data: updatedData as object,
      },
    });
  } catch (error) {
    logger.error('Failed to track engagement', { emailId, type, error });
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-twilio-email-event-webhook-signature') || '';
    const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp') || '';

    // Verify signature in production
    if (VERIFICATION_KEY && !verifySignature(body, signature, timestamp)) {
      logger.warn('Invalid SendGrid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse events
    const events: SendGridEvent[] = JSON.parse(body);

    logger.debug('Received SendGrid webhook', { count: events.length });

    // Process each event
    for (const event of events) {
      const eventType = event.event as EventType;

      switch (eventType) {
        case 'delivered':
          await handleDelivered(event);
          break;
        case 'bounce':
        case 'blocked':
          await handleBounce(event);
          break;
        case 'spam_report':
          await handleSpamReport(event);
          break;
        case 'dropped':
          await handleDropped(event);
          break;
        case 'open':
          await handleOpen(event);
          break;
        case 'click':
          await handleClick(event);
          break;
        case 'unsubscribe':
        case 'group_unsubscribe':
          await handleUnsubscribe(event);
          break;
        case 'processed':
        case 'deferred':
        case 'group_resubscribe':
          // Log but don't process
          logger.debug('SendGrid event', { type: eventType, email: event.email });
          break;
        default:
          logger.debug('Unknown SendGrid event', { type: eventType });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('SendGrid webhook error', { error });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Note: In App Router, body parsing is handled automatically
// Use request.text() for raw body access as shown above
