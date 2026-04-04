/**
 * POST /api/push/subscribe
 *
 * Upserts a Web Push subscription for the authenticated user's organisation.
 * Called by the browser after the user grants push notification permission.
 *
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * DELETE /api/push/subscribe
 *
 * Removes a push subscription (user unsubscribed / browser revoked permission).
 * Body: { endpoint: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { writeDefault } from '@/lib/rate-limit';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    const security = await APISecurityChecker.check(
      req,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );
    if (!security.allowed) {
      return NextResponse.json({ error: security.error }, { status: 401 });
    }

    const userId = security.context.userId!;
    const organizationId = await getEffectiveOrganizationId(userId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        organizationId: organizationId ?? null,
        userId,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        organizationId: organizationId ?? null,
        userId,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  });
}

export async function DELETE(req: NextRequest) {
  return writeDefault(req, async () => {
    const security = await APISecurityChecker.check(
      req,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );
    if (!security.allowed) {
      return NextResponse.json({ error: security.error }, { status: 401 });
    }

    const userId = security.context.userId!;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = z.object({ endpoint: z.string().url() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: parsed.data.endpoint,
        userId,
      },
    });

    return NextResponse.json({ success: true });
  });
}
