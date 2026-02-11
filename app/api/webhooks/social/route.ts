/**
 * Social Platform Webhook Handler
 *
 * Handles incoming webhooks from social media platforms for
 * post engagement updates, publishing confirmations, and errors.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_WEBHOOK_SECRET (SECRET)
 * - LINKEDIN_WEBHOOK_SECRET (SECRET)
 * - INSTAGRAM_WEBHOOK_SECRET (SECRET)
 * - FACEBOOK_WEBHOOK_SECRET (SECRET)
 * - DATABASE_URL (CRITICAL)
 *
 * @module app/api/webhooks/social/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// =============================================================================
// Webhook Secrets
// =============================================================================

const webhookSecrets: Record<string, string | undefined> = {
  twitter: process.env.TWITTER_WEBHOOK_SECRET,
  linkedin: process.env.LINKEDIN_WEBHOOK_SECRET,
  instagram: process.env.INSTAGRAM_WEBHOOK_SECRET,
  facebook: process.env.FACEBOOK_WEBHOOK_SECRET,
  tiktok: process.env.TIKTOK_WEBHOOK_SECRET,
};

// =============================================================================
// Signature Verification
// =============================================================================

function verifySignature(
  platform: string,
  payload: string,
  signature: string
): boolean {
  const secret = webhookSecrets[platform];
  if (!secret) {
    console.warn(`No webhook secret configured for ${platform}`);
    return false;
  }

  try {
    // Different platforms use different signature methods
    switch (platform) {
      case 'twitter': {
        // Twitter uses HMAC-SHA256
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('base64');
        return `sha256=${hash}` === signature;
      }
      case 'facebook':
      case 'instagram': {
        // Facebook/Instagram use HMAC-SHA1
        const hash = crypto
          .createHmac('sha1', secret)
          .update(payload)
          .digest('hex');
        return `sha1=${hash}` === signature;
      }
      case 'linkedin': {
        // LinkedIn uses HMAC-SHA256
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return hash === signature;
      }
      default:
        return false;
    }
  } catch (error) {
    console.error(`Signature verification error for ${platform}:`, error);
    return false;
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

interface WebhookEvent {
  platform: string;
  type: string;
  postId?: string;
  externalId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

async function handlePostPublished(event: WebhookEvent) {
  const { postId, externalId, data } = event;

  if (!postId && !externalId) return;

  // Update post status
  const updateData: any = {
    status: 'published',
    publishedAt: new Date(),
    updatedAt: new Date(),
  };

  if (externalId) {
    updateData.externalId = externalId;
  }

  if (data.url) {
    updateData.publishedUrl = data.url;
  }

  const where = postId ? { id: postId } : { externalId };

  await prisma.post.updateMany({
    where,
    data: updateData,
  });

  // Log the event
  await prisma.auditLog.create({
    data: {
      action: 'post_published',
      resource: 'post',
      resourceId: postId || externalId,
      details: { platform: event.platform, ...data },
      severity: 'low',
      category: 'content',
      outcome: 'success',
    },
  });
}

async function handlePostEngagement(event: WebhookEvent) {
  const { postId, externalId, data } = event;

  if (!postId && !externalId) return;

  const where = postId ? { id: postId } : { externalId };

  // Update engagement metrics
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.likes !== undefined) updateData.likes = data.likes;
  if (data.comments !== undefined) updateData.comments = data.comments;
  if (data.shares !== undefined) updateData.shares = data.shares;
  if (data.impressions !== undefined) updateData.impressions = data.impressions;
  if (data.reach !== undefined) updateData.reach = data.reach;
  if (data.clicks !== undefined) updateData.clicks = data.clicks;
  if (data.saves !== undefined) updateData.saves = data.saves;

  await prisma.post.updateMany({
    where,
    data: updateData,
  });
}

async function handlePostFailed(event: WebhookEvent) {
  const { postId, data } = event;

  if (!postId) return;

  // Get current post metadata to merge with error info
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { metadata: true },
  });

  const currentMetadata = (post?.metadata || {}) as Record<string, any>;

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'failed',
      metadata: {
        ...currentMetadata,
        errorMessage: data.error || data.message || 'Publishing failed',
        failedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });

  // Log error
  await prisma.auditLog.create({
    data: {
      action: 'post_failed',
      resource: 'post',
      resourceId: postId,
      details: { platform: event.platform, error: data },
      severity: 'high',
      category: 'content',
      outcome: 'failure',
    },
  });
}

async function handleAccountUpdate(event: WebhookEvent) {
  const { data } = event;

  if (!data.userId) return;

  // Update platform connection status
  await prisma.platformConnection.updateMany({
    where: {
      userId: data.userId,
      platform: event.platform,
    },
    data: {
      isActive: data.active !== false,
      lastSync: new Date(),
      metadata: {
        lastWebhook: new Date().toISOString(),
        ...data,
      },
    },
  });
}

// =============================================================================
// Route Handlers
// =============================================================================

// GET - Webhook verification (used by Facebook/Instagram)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Facebook/Instagram verification challenge
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST - Handle incoming webhooks
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform')?.toLowerCase();

    if (!platform) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Platform parameter required' },
        { status: 400 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Verify webhook signature - ALWAYS required in ALL environments
    // Security: Never skip signature verification regardless of environment
    const signature =
      request.headers.get('x-hub-signature-256') ||
      request.headers.get('x-twitter-webhooks-signature') ||
      request.headers.get('x-linkedin-signature') ||
      '';

    if (!verifySignature(platform, rawBody, signature)) {
      // Log verification failure for security monitoring
      console.error(
        `[SECURITY] Webhook signature verification failed for platform: ${platform}, ` +
        `IP: ${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}, ` +
        `User-Agent: ${request.headers.get('user-agent') || 'unknown'}`
      );

      // Attempt to log to audit trail for security monitoring
      try {
        await prisma.auditLog.create({
          data: {
            action: 'webhook_signature_invalid',
            resource: 'webhook',
            resourceId: platform,
            details: {
              platform,
              ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown',
              timestamp: new Date().toISOString(),
            },
            severity: 'critical',
            category: 'security',
            outcome: 'failure',
          },
        });
      } catch (auditError) {
        console.error('[SECURITY] Failed to log signature verification failure:', auditError);
      }

      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse event type based on platform
    let eventType: string;
    let eventData: WebhookEvent;

    switch (platform) {
      case 'twitter':
        eventType = body.tweet_create_events ? 'engagement' : body.type || 'unknown';
        eventData = {
          platform,
          type: eventType,
          externalId: body.data?.id || body.tweet_create_events?.[0]?.id_str,
          data: body.data || body,
          timestamp: new Date(),
        };
        break;

      case 'facebook':
      case 'instagram':
        eventType = body.entry?.[0]?.changes?.[0]?.field || body.object || 'unknown';
        eventData = {
          platform,
          type: eventType,
          externalId: body.entry?.[0]?.id,
          data: body.entry?.[0]?.changes?.[0]?.value || body,
          timestamp: new Date(),
        };
        break;

      case 'linkedin':
        eventType = body.eventType || 'unknown';
        eventData = {
          platform,
          type: eventType,
          externalId: body.activityUrn?.split(':').pop(),
          data: body,
          timestamp: new Date(),
        };
        break;

      default:
        eventData = {
          platform,
          type: body.type || 'unknown',
          data: body,
          timestamp: new Date(),
        };
    }

    // Process event based on type
    switch (eventData.type) {
      case 'post_published':
      case 'tweet_create':
      case 'media':
        await handlePostPublished(eventData);
        break;

      case 'engagement':
      case 'insights':
      case 'reactions':
        await handlePostEngagement(eventData);
        break;

      case 'post_failed':
      case 'error':
        await handlePostFailed(eventData);
        break;

      case 'account_update':
      case 'permissions':
        await handleAccountUpdate(eventData);
        break;

      default:
        // Unknown event types are silently ignored
        break;
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true, received: true });
  } catch (error: unknown) {
    console.error('Social webhook error:', error);
    // Return 200 anyway to prevent retries on processing errors
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 200 });
  }
}

export const runtime = 'nodejs';
