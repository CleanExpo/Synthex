/**
 * Public card events — POST /api/card/[slug]/events
 *
 * Records what a visitor did on the card (need picked, action shown, rating,
 * contact saved, problems reported) against the card's authorised learning
 * experiment. No personal data is accepted: the session id is a random value
 * the browser generates, and the schema rejects any other field. Same-origin
 * and rate-limited, like the public Opportunity Map feedback route. The
 * organisation comes from the experiment's authorisation row, never from this
 * request. If the card has no authorised experiment it answers 503
 * FEATURE_NOT_PROVISIONED rather than dropping the event.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { getCardConfig } from '@/lib/cards/white-rabbit';
import { CARD_EVENT_TYPES } from '@/lib/learning-loop/summary';
import {
  findCardBinding,
  LearningLoopError,
  recordCardEvent,
} from '@/lib/learning-loop/store';
import { logger } from '@/lib/logger';

const eventSchema = z
  .object({
    sessionId: z.string().uuid(),
    type: z.enum(CARD_EVENT_TYPES),
    variant: z.enum(['story', 'plain']),
    needId: z.string().max(40).optional(),
    rating: z.enum(['useful', 'not_useful', 'confusing']).optional(),
  })
  .strict();

function permitted(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([
    request.nextUrl.origin,
    ...(process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  ]);
  return allowed.has(origin);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const card = getCardConfig(slug);
  if (!card)
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  if (!permitted(request))
    return NextResponse.json(
      { error: 'Origin not permitted' },
      { status: 403 }
    );

  const rate = await checkRateLimit(request, {
    namespace: 'card-events',
    orgKey: `card:${slug}`,
    ipKey: extractClientIp(request),
    limits: {
      org: { limit: 5_000, windowSeconds: 3_600 },
      ip: { limit: 120, windowSeconds: 3_600 },
    },
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many events' },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 3_600) },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  const e = parsed.data;
  if (e.needId && !card.needs.some(n => n.id === e.needId)) {
    return NextResponse.json({ error: 'Unknown need' }, { status: 400 });
  }
  if ((e.type === 'action_rated') !== Boolean(e.rating)) {
    return NextResponse.json(
      { error: 'A rating goes with action_rated only' },
      { status: 400 }
    );
  }

  try {
    const binding = await findCardBinding(slug);
    const row = await recordCardEvent(binding, e);
    return NextResponse.json(
      { recorded: true, id: row.id, dataClass: binding.dataClass },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof LearningLoopError &&
      error.code === 'NOT_PROVISIONED'
    ) {
      return NextResponse.json(
        { error: 'FEATURE_NOT_PROVISIONED', message: error.message },
        { status: 503 }
      );
    }
    if (error instanceof LearningLoopError && error.code === 'FORBIDDEN') {
      logger.error('card-events: tenant boundary refused', { slug });
      return NextResponse.json(
        { error: 'Card misconfigured' },
        { status: 409 }
      );
    }
    logger.error('card-events: record failed', {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Could not record the event' },
      { status: 500 }
    );
  }
}
