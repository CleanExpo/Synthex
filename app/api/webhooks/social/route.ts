/**
 * Social Platform Webhook Handler (Legacy/Direct)
 *
 * Handles incoming webhooks from social media platforms for
 * post engagement updates, publishing confirmations, and errors.
 *
 * This is the direct-DB-write handler used via ?platform=xxx query param.
 * For the primary dynamic-route handler, see app/api/webhooks/[platform]/route.ts
 *
 * Supports all 9 platforms: Twitter, Facebook, Instagram, LinkedIn,
 * TikTok, Pinterest, YouTube, Reddit, Threads
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_WEBHOOK_SECRET (SECRET)
 * - LINKEDIN_WEBHOOK_SECRET (SECRET)
 * - META_WEBHOOK_SECRET (SECRET) — shared by Facebook, Instagram, Threads
 * - FACEBOOK_WEBHOOK_SECRET (SECRET) — fallback if META_WEBHOOK_SECRET not set
 * - INSTAGRAM_WEBHOOK_SECRET (SECRET) — fallback if META_WEBHOOK_SECRET not set
 * - TIKTOK_WEBHOOK_SECRET (SECRET)
 * - PINTEREST_WEBHOOK_SECRET (SECRET)
 * - GOOGLE_WEBHOOK_SECRET (SECRET) — for YouTube
 * - REDDIT_WEBHOOK_SECRET (SECRET)
 * - META_WEBHOOK_VERIFY_TOKEN — for Meta subscription verification
 * - DATABASE_URL (CRITICAL)
 *
 * @module app/api/webhooks/social/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// =============================================================================
// Webhook Secrets
// =============================================================================

const VALID_PLATFORMS = new Set([
  'twitter',
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'pinterest',
  'youtube',
  'reddit',
  'threads',
]);

function getWebhookSecret(platform: string): string | undefined {
  const secrets: Record<string, string | undefined> = {
    twitter: process.env.TWITTER_WEBHOOK_SECRET,
    linkedin: process.env.LINKEDIN_WEBHOOK_SECRET,
    // Meta platforms share a secret; fall back to platform-specific
    facebook: process.env.META_WEBHOOK_SECRET || process.env.FACEBOOK_WEBHOOK_SECRET,
    instagram: process.env.META_WEBHOOK_SECRET || process.env.INSTAGRAM_WEBHOOK_SECRET,
    threads: process.env.META_WEBHOOK_SECRET,
    tiktok: process.env.TIKTOK_WEBHOOK_SECRET,
    pinterest: process.env.PINTEREST_WEBHOOK_SECRET,
    youtube: process.env.GOOGLE_WEBHOOK_SECRET,
    reddit: process.env.REDDIT_WEBHOOK_SECRET,
  };
  return secrets[platform];
}

// =============================================================================
// Signature Verification (timing-safe)
// =============================================================================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verify webhook signature using platform-specific methods.
 * All comparisons use timing-safe equality to prevent timing attacks.
 */
function verifySignature(
  platform: string,
  payload: string,
  signature: string
): boolean {
  const secret = getWebhookSecret(platform);
  if (!secret) {
    logger.warn(`No webhook secret configured for ${platform}`);
    return false;
  }

  if (!signature) {
    logger.warn(`Missing signature header for ${platform}`);
    return false;
  }

  try {
    switch (platform) {
      case 'twitter': {
        // Twitter uses HMAC-SHA256 with base64 encoding, prefixed with "sha256="
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('base64');
        return safeCompare(`sha256=${hash}`, signature);
      }

      case 'facebook':
      case 'instagram':
      case 'threads': {
        // Modern Meta Graph API uses HMAC-SHA256 (x-hub-signature-256)
        // Fallback to SHA1 only if signature starts with "sha1="
        if (signature.startsWith('sha256=')) {
          const hash = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
          return safeCompare(`sha256=${hash}`, signature);
        } else if (signature.startsWith('sha1=')) {
          // Legacy SHA1 support for older Graph API versions
          const hash = crypto
            .createHmac('sha1', secret)
            .update(payload)
            .digest('hex');
          return safeCompare(`sha1=${hash}`, signature);
        }
        return false;
      }

      case 'linkedin': {
        // LinkedIn uses HMAC-SHA256 with hex encoding
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return safeCompare(hash, signature);
      }

      case 'tiktok': {
        // TikTok uses HMAC-SHA256 with hex encoding
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return safeCompare(hash, signature);
      }

      case 'pinterest': {
        // Pinterest uses HMAC-SHA256 with hex encoding
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return safeCompare(hash, signature);
      }

      case 'youtube': {
        // YouTube/Google uses HMAC-SHA256 with base64 encoding
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('base64');
        return safeCompare(hash, signature);
      }

      case 'reddit': {
        // Reddit uses HMAC-SHA256 with hex encoding
        const hash = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        return safeCompare(hash, signature);
      }

      default:
        return false;
    }
  } catch (error) {
    logger.error(`Signature verification error for ${platform}`, { error });
    return false;
  }
}

/**
 * Extract the appropriate signature header for each platform
 */
function extractSignatureHeader(
  request: NextRequest,
  platform: string
): string {
  switch (platform) {
    case 'twitter':
      return request.headers.get('x-twitter-webhooks-signature') || '';
    case 'facebook':
    case 'instagram':
    case 'threads':
      // Prefer SHA256 header, fall back to SHA1
      return (
        request.headers.get('x-hub-signature-256') ||
        request.headers.get('x-hub-signature') ||
        ''
      );
    case 'linkedin':
      return request.headers.get('x-li-signature') || request.headers.get('x-linkedin-signature') || '';
    case 'tiktok':
      return request.headers.get('x-tiktok-signature') || '';
    case 'pinterest':
      return request.headers.get('x-pinterest-signature') || '';
    case 'youtube':
      return request.headers.get('x-goog-signature') || '';
    case 'reddit':
      return request.headers.get('x-reddit-signature') || '';
    default:
      return '';
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

/** Post update data from webhook */
interface PostUpdateData {
  url?: string;
  error?: string;
  message?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  saves?: number;
  views?: number;
  userId?: string;
  active?: boolean;
  [key: string]: unknown;
}

interface WebhookEvent {
  platform: string;
  type: string;
  postId?: string;
  externalId?: string;
  data: PostUpdateData;
  timestamp: Date;
}

async function handlePostPublished(event: WebhookEvent) {
  const { postId, externalId, data } = event;

  if (!postId && !externalId) return;

  // Update post status
  const updateData: {
    status: string;
    publishedAt: Date;
    updatedAt: Date;
    externalId?: string;
    publishedUrl?: string;
  } = {
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
  const updateData: {
    updatedAt: Date;
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
    reach?: number;
    clicks?: number;
    saves?: number;
  } = {
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

  const currentMetadata = (post?.metadata || {}) as Record<string, unknown>;

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
      details: { platform: event.platform, error: JSON.stringify(data) },
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
// Event Parsing per Platform
// =============================================================================

function parseWebhookEvent(
  platform: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): WebhookEvent {
  switch (platform) {
    case 'twitter':
      return {
        platform,
        type: body.tweet_create_events
          ? 'engagement'
          : body.favorite_events
            ? 'engagement'
            : body.type || 'unknown',
        externalId: body.data?.id || body.tweet_create_events?.[0]?.id_str,
        data: body.data || body,
        timestamp: new Date(),
      };

    case 'facebook':
    case 'instagram':
    case 'threads':
      return {
        platform,
        type: body.entry?.[0]?.changes?.[0]?.field || body.object || 'unknown',
        externalId: body.entry?.[0]?.id,
        data: body.entry?.[0]?.changes?.[0]?.value || body,
        timestamp: new Date(),
      };

    case 'linkedin':
      return {
        platform,
        type: body.eventType || 'unknown',
        externalId: body.activityUrn?.split(':').pop(),
        data: body,
        timestamp: new Date(),
      };

    case 'tiktok':
      return {
        platform,
        type: body.event || body.type || 'unknown',
        externalId: body.video_id || body.data?.video_id,
        data: body.data || body,
        timestamp: new Date(),
      };

    case 'pinterest':
      return {
        platform,
        type: body.event_type || body.type || 'unknown',
        externalId: body.data?.id || body.pin_id,
        data: body.data || body,
        timestamp: new Date(),
      };

    case 'youtube':
      return {
        platform,
        type: body.eventType || body.type || 'unknown',
        externalId: body.videoId || body.data?.videoId || body.resourceId?.videoId,
        data: body.data || body,
        timestamp: new Date(),
      };

    case 'reddit':
      return {
        platform,
        type: body.event_type || body.type || 'unknown',
        externalId: body.data?.id || body.thing_id,
        data: body.data || body,
        timestamp: new Date(),
      };

    default:
      return {
        platform,
        type: body.type || 'unknown',
        data: body,
        timestamp: new Date(),
      };
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

// GET - Webhook verification (used by Facebook/Instagram/Threads)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Facebook/Instagram/Threads verification challenge
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token && token === verifyToken) {
    logger.info('Social webhook verification succeeded');
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

    if (!VALID_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Unsupported platform: ${platform}` },
        { status: 400 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Empty body' },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any>;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Extract platform-specific signature header
    const signature = extractSignatureHeader(request, platform);

    // Verify webhook signature - ALWAYS required in ALL environments
    if (!verifySignature(platform, rawBody, signature)) {
      // Log verification failure for security monitoring
      logger.error('[SECURITY] Webhook signature verification failed', {
        platform,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

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
        logger.error('Failed to log signature verification failure', { auditError });
      }

      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse event type based on platform
    const eventData = parseWebhookEvent(platform, body);

    // Process event based on type
    switch (eventData.type) {
      case 'post_published':
      case 'tweet_create':
      case 'media':
      case 'video.publish':
      case 'video.published':
      case 'pin.created':
      case 'SHARE_CREATED':
      case 'submission.created':
        await handlePostPublished(eventData);
        break;

      case 'engagement':
      case 'insights':
      case 'reactions':
      case 'story_insights':
      case 'likes':
      case 'REACTION_CREATED':
      case 'upvote':
      case 'vote':
        await handlePostEngagement(eventData);
        break;

      case 'post_failed':
      case 'error':
        await handlePostFailed(eventData);
        break;

      case 'account_update':
      case 'permissions':
      case 'authorize':
      case 'deauthorize':
      case 'ORGANIZATION_ACCESS_GRANTED':
      case 'ORGANIZATION_ACCESS_REVOKED':
      case 'account.connected':
      case 'account.disconnected':
        await handleAccountUpdate(eventData);
        break;

      default:
        // Log unknown event types for observability (not an error)
        logger.debug('Unhandled webhook event type', {
          platform,
          type: eventData.type,
        });
        break;
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true, received: true });
  } catch (error: unknown) {
    logger.error('Social webhook error', { error });
    // Return 200 anyway to prevent retries on processing errors
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 200 });
  }
}

// ============================================================================
// CONFIG
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
