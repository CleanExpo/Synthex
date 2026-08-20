/**
 * Featured-in-Synthex opt-in — app/api/clients/featured-opt-in/route.ts
 *
 * PATCH /api/clients/featured-opt-in
 * body: { clientId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/platform/noop-client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  buildOptInSlackMessage,
  canOptIn,
  extractBestMetric,
} from '@/lib/videos/featuredProgramme';

export const runtime = 'nodejs';

const OptInBodySchema = z.object({
  clientId: z.string().trim().min(1),
});

export async function PATCH(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OptInBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'clientId is required', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { clientId } = parsed.data;
  const platform = createClient();

  const { data: client, error } = await platform
    .from('clients')
    .select('id, name, featured_programme_status')
    .eq('id', clientId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Featured opt-in lookup failed', error, { clientId, userId });
    return NextResponse.json({ error: 'Failed to load client' }, { status: 500 });
  }

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  if (!canOptIn(client.featured_programme_status)) {
    return NextResponse.json(
      { status: client.featured_programme_status, alreadyOptedIn: true },
      { status: 200 }
    );
  }

  const { error: updateError } = await platform
    .from('clients')
    .update({ featured_programme_status: 'applied' })
    .eq('id', clientId)
    .eq('user_id', userId);

  if (updateError) {
    logger.error('Featured opt-in update failed', updateError, { clientId, userId });
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }

  await fireFeaturedClientsSlackAlert({ userId, clientName: client.name });

  return NextResponse.json({ status: 'applied', alreadyOptedIn: false });
}

async function fireFeaturedClientsSlackAlert(params: {
  userId: string;
  clientName: string;
}): Promise<void> {
  const webhook = process.env.SLACK_FEATURED_CLIENTS_WEBHOOK_URL;
  if (!webhook) return;

  try {
    let bestMetric: string | null = null;
    const digest = await prisma.aIWeeklyDigest.findFirst({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
      select: { highlights: true },
    });
    if (digest) {
      bestMetric = extractBestMetric(digest.highlights);
    }

    const payload = buildOptInSlackMessage({
      clientName: params.clientName,
      bestMetric,
    });

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logger.warn('Featured opt-in: Slack alert failed', { error });
  }
}
