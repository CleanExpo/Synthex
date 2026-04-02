/**
 * POST /api/analytics/engagement-event
 *
 * Dual-writes client engagement events to:
 *   1. Supabase (client_engagement_events) — feeds Health Score computation
 *   2. GA4 Measurement Protocol — feeds attribution analytics
 *
 * Privacy: no PII in event_data. clientId is internal UUID, never email.
 * SYN-612
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/with-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

const VALID_EVENT_TYPES = [
  'dashboard_visit',
  'calendar_post_viewed',
  'calendar_post_approved',
  'calendar_post_dismissed',
  'digest_email_opened',
  'advisor_brief_viewed',
  'review_response_started',
  'review_response_published',
  'authority_hub_viewed',
  'settings_changed',
] as const;

const EventSchema = z.object({
  eventType: z.enum(VALID_EVENT_TYPES),
  eventData: z.record(z.string(), z.unknown()).optional(),
  pagePath: z.string().max(500).optional(),
  sessionId: z.string().uuid(),
});

export const POST = withAuth(async (request: NextRequest, { clientId }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { eventType, eventData, pagePath, sessionId } = parsed.data;

  // Write to Supabase via Prisma — non-fatal
  try {
    await prisma.clientEngagementEvent.create({
      data: {
        clientId,
        eventType,
        eventData: (eventData ?? {}) as Prisma.InputJsonValue,
        pagePath: pagePath ?? null,
        sessionId,
      },
    });
  } catch (err) {
    logger.error('[engagement-event] Failed to write to DB', err);
  }

  // Fire-and-forget to GA4 Measurement Protocol
  sendToGA4(clientId, eventType, eventData ?? {}, sessionId).catch(err =>
    logger.error('[engagement-event] GA4 send failed', err)
  );

  return NextResponse.json({ ok: true });
});

async function sendToGA4(
  clientId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  sessionId: string
): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId,
        events: [
          {
            name: eventType,
            params: { session_id: sessionId, engagement_time_msec: 1, ...eventData },
          },
        ],
      }),
    }
  );
}
