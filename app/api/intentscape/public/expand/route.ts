import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { VisionExpansionRejectedError } from '@/lib/intentscape/engine';
import { createIntentScapeRuntime } from '@/lib/intentscape/runtime';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 120;

const PublicExpansionSchema = z
  .object({
    originSignal: z.string().trim().min(12).max(5_000),
  })
  .strict();

function titleFromSignal(signal: string): string {
  return signal
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .slice(0, 200);
}

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (origin === request.nextUrl.origin) return true;
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .includes(origin);
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Origin not permitted' },
      { status: 403 }
    );
  }

  const organizationId = process.env.MARKETING_LEADS_ORG_ID;
  if (!organizationId) {
    logger.error(
      '[intentscape-public] MARKETING_LEADS_ORG_ID is not configured'
    );
    return NextResponse.json(
      { error: 'The Marketing Extender is temporarily unavailable' },
      { status: 503 }
    );
  }

  const rate = await checkRateLimit(request, {
    namespace: 'intentscape-public-expansion',
    orgKey: organizationId,
    ipKey: extractClientIp(request),
    limits: {
      org: { limit: 120, windowSeconds: 3_600 },
      ip: { limit: 3, windowSeconds: 3_600 },
    },
  });
  if (!rate.ok) {
    const retryAfter = rate.retryAfterSeconds ?? 3_600;
    return NextResponse.json(
      {
        error:
          'This free tool has reached its hourly expansion limit. Your existing result remains available.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const input = PublicExpansionSchema.parse(raw);
    const intentscape = createIntentScapeRuntime({
      organizationId,
      userId: 'marketing-extender-public',
    });
    const workspace = await intentscape.createWorkspace({
      title: titleFromSignal(input.originSignal),
      originSignal: input.originSignal,
      retentionClass: 'prospect',
    });
    const acceptedVision = await intentscape.expandVision(workspace.id);

    return NextResponse.json({
      workspaceId: workspace.id,
      acceptedVision: {
        visionMap: acceptedVision.visionMap,
        independentEvaluation: acceptedVision.independentEvaluation,
        acceptedAt: acceptedVision.acceptedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    if (error instanceof VisionExpansionRejectedError) {
      return NextResponse.json(
        { error: 'The vision did not pass the independent quality gate' },
        { status: 422 }
      );
    }
    logger.error('[intentscape-public] expansion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'The Marketing Extender could not complete this expansion' },
      { status: 500 }
    );
  }
}
