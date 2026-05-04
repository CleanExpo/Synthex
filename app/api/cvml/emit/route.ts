/**
 * POST /api/cvml/emit — client-side CVML event bridge
 *
 * Client components (`'use client'`) cannot import `lib/measurement/emit.ts`
 * directly because it uses Prisma. This route is the thin server-side
 * bridge: client posts an event payload, server validates with Zod, calls
 * `emit()` server-side.
 *
 * Auth: required. The caller must be authenticated. We don't trust
 * client-supplied `userId` / `clientId` — we use the authenticated user's
 * ID and resolve their organisation server-side. This stops a client
 * from emitting events on behalf of someone else.
 *
 * Rate limit: writeDefault (30 req/min per user). CVML events are
 * legitimately frequent on engaged surfaces (one banner can fire view +
 * interact + dismiss within seconds), so the limiter must be lenient
 * enough not to drop signal — but tight enough that a runaway client
 * loop doesn't pollute the table.
 *
 * Response: 204 No Content on success — events are fire-and-forget; the
 * caller doesn't need an event ID back. 400 on validation failure, 401
 * on missing auth, 429 on rate limit.
 *
 * @task SYN-729 (First Win Notification retrofit ships first)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { emit } from '@/lib/measurement/emit';
import {
  CLIENT_VALUE_EVENT_TYPES,
  CLIENT_VALUE_FEATURE_IDS,
  JOURNEY_STAGES,
} from '@/lib/measurement/client-value-events';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { writeDefault } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const emitSchema = z.object({
  featureId: z.enum(
    CLIENT_VALUE_FEATURE_IDS as unknown as [string, ...string[]]
  ),
  eventType: z.enum(
    CLIENT_VALUE_EVENT_TYPES as unknown as [string, ...string[]]
  ),
  sessionId: z.string().min(1).max(128),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  journey_moment_id: z.string().min(1).max(128).optional(),
  journey_stage: z
    .enum(JOURNEY_STAGES as unknown as [string, ...string[]])
    .optional(),
});

export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    const userId = await getUserIdFromRequestOrCookies(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = emitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      // No org context = no clientId = nothing to attribute the event to.
      // Drop silently — emit is fire-and-forget by contract.
      logger.warn('[cvml-emit-route] no organization context, dropping', {
        userId,
        featureId: parsed.data.featureId,
      });
      return new NextResponse(null, { status: 204 });
    }

    // Server-controlled fields: clientId from the user's org, userId from
    // the authenticated session, timestamp = now (ignore any client clock).
    await emit({
      featureId: parsed.data
        .featureId as (typeof CLIENT_VALUE_FEATURE_IDS)[number],
      eventType: parsed.data
        .eventType as (typeof CLIENT_VALUE_EVENT_TYPES)[number],
      clientId: organizationId,
      userId,
      timestamp: new Date().toISOString(),
      sessionId: parsed.data.sessionId,
      metadata: parsed.data.metadata,
      journey_moment_id: parsed.data.journey_moment_id,
      journey_stage: parsed.data
        .journey_stage as (typeof JOURNEY_STAGES)[number],
    });

    return new NextResponse(null, { status: 204 });
  });
}

export const runtime = 'nodejs';
