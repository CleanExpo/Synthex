/**
 * Explicit product feedback for a completed public Opportunity Map.
 *
 * This stores the visitor's usefulness verdict and, when the map missed the
 * mark, one short explanation. It does not subscribe, identify, or promote the
 * visitor into a client tenant.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const feedbackSchema = z
  .object({
    scanId: z.string().min(10).max(100),
    useful: z.boolean(),
    missing: z.string().trim().max(800).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.useful && (!value.missing || value.missing.length < 3)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['missing'],
        message: 'Tell us what was missing.',
      });
    }
  });

function permitted(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([
    request.nextUrl.origin,
    'http://localhost:3008',
    'http://127.0.0.1:3008',
    ...(process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  ]);
  return allowed.has(origin);
}

export async function POST(request: NextRequest) {
  if (!permitted(request)) {
    return NextResponse.json(
      { error: 'Origin not permitted' },
      { status: 403 }
    );
  }

  const rate = await checkRateLimit(request, {
    namespace: 'opportunity-map-feedback',
    orgKey: 'public-feedback',
    ipKey: extractClientIp(request),
    limits: {
      org: { limit: 1_000, windowSeconds: 3_600 },
      ip: { limit: 12, windowSeconds: 3_600 },
    },
  });
  if (!rate.ok) {
    const retryAfter = rate.retryAfterSeconds ?? 3_600;
    return NextResponse.json(
      { error: 'Feedback limit reached' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validated = feedbackSchema.safeParse(raw);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Choose an answer and add what was missing.' },
      { status: 400 }
    );
  }

  const { scanId, useful, missing } = validated.data;
  try {
    const outcome = await prisma.opportunityMapScan.updateMany({
      where: { id: scanId },
      data: {
        feedbackUseful: useful,
        feedbackMissing: missing || null,
        feedbackSubmittedAt: new Date(),
      },
    });
    if (outcome.count === 0) {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[opportunity-map] feedback failed', {
      scanId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'The feedback could not be saved. Try again in a moment.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
