/**
 * Featured-in-Synthex opt-in — app/api/clients/featured-opt-in/route.ts
 *
 *   PATCH /api/clients/featured-opt-in   body: { clientId: string }
 *     → sets clients.featured_programme_status = 'applied' for the given soft
 *       client id, then fires a Slack alert to #featured-clients with the
 *       client name + best metric pulled from the caller's latest weekly digest.
 *
 * Opt-in is idempotent: if the client is already 'applied' (or further along)
 * the update + Slack alert are skipped so a double-click can't re-notify.
 *
 * `clientId` is the SOFT reference to a Supabase `clients.id` (the same id
 * `/api/clients` manages). The status column is added by the create-only
 * migration 20260710000000_syn508_featured_programme_status.sql.
 *
 * @task SYN-508
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  canOptIn,
  extractBestMetric,
  buildOptInSlackMessage,
} from '@/lib/videos/featuredProgramme';

export const runtime = 'nodejs';

const OptInBodySchema = z.object({
  clientId: z.string().trim().min(1),
});

export async function PATCH(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────────
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error('Featured opt-in: Supabase env not configured');
    return NextResponse.json(
      { error: 'Service not configured' },
      { status: 503 }
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Read current status (idempotency guard) ─────────────────────────────────
  const { data: current, error: readError } = await supabase
    .from('clients')
    .select('id, name, featured_programme_status')
    .eq('id', clientId)
    .maybeSingle();

  if (readError) {
    logger.error('Featured opt-in: client read failed', {
      error: readError.message,
    });
    return NextResponse.json(
      { error: 'Client lookup failed' },
      { status: 500 }
    );
  }
  if (!current) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  if (!canOptIn(current.featured_programme_status)) {
    // Already applied / in production / published — no-op, no re-notify.
    return NextResponse.json({
      status: current.featured_programme_status,
      alreadyOptedIn: true,
    });
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('clients')
    .update({ featured_programme_status: 'applied' })
    .eq('id', clientId);

  if (updateError) {
    logger.error('Featured opt-in: update failed', {
      error: updateError.message,
    });
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // ── Slack alert (non-fatal) ──────────────────────────────────────────────────
  const clientName =
    (typeof current.name === 'string' && current.name) || 'Unknown client';
  await fireFeaturedClientsSlackAlert({ userId, clientName });

  return NextResponse.json({ status: 'applied', alreadyOptedIn: false });
}

/**
 * Fire the #featured-clients Slack alert with the best metric from the caller's
 * most recent weekly digest. Every failure path is swallowed — the opt-in has
 * already succeeded and must not be rolled back by a flaky webhook.
 */
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
    if (digest) bestMetric = extractBestMetric(digest.highlights);

    const body = buildOptInSlackMessage({
      clientName: params.clientName,
      bestMetric,
    });

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn('Featured opt-in: Slack alert failed', { error: err });
  }
}
