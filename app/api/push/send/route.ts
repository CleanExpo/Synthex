/**
 * POST /api/push/send
 *
 * Sends a Web Push notification to all subscribers in the authenticated
 * user's organisation.
 *
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.
 * Generate a pair with: npx web-push generate-vapid-keys
 *
 * Body: { title: string, body: string, url?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import webpush from 'web-push';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { writeDefault } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const PayloadSchema = z.object({
  title: z.string().min(1).max(128),
  body: z.string().min(1).max(256),
  url: z.string().url().optional(),
});

function getVapidConfig(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    const security = await APISecurityChecker.check(
      req,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );
    if (!security.allowed) {
      return NextResponse.json({ error: security.error }, { status: 401 });
    }

    const vapid = getVapidConfig();
    if (!vapid) {
      return NextResponse.json(
        { error: 'Push notifications not configured (missing VAPID keys)' },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    const userId = security.context.userId!;
    const organizationId = await getEffectiveOrganizationId(userId);

    webpush.setVapidDetails(
      `mailto:${process.env.EMAIL_FROM ?? 'support@synthex.social'}`,
      vapid.publicKey,
      vapid.privateKey
    );

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { organizationId: organizationId ?? undefined },
    });

    const payload = JSON.stringify({
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url ?? '/dashboard',
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async sub => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Subscription expired or revoked — clean up
            staleEndpoints.push(sub.endpoint);
          } else {
            logger.error('[push/send] delivery failed', {
              endpoint: sub.endpoint,
              err,
            });
          }
          failed++;
        }
      })
    );

    if (staleEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: staleEndpoints } },
      });
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
    });
  });
}
