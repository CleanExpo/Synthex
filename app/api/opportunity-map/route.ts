/**
 * Public Marketing Extender scan.
 *
 * The route runs the existing website/onboarding intelligence behind a strict
 * public intake, then stores the exact evidence-backed map shown to the
 * visitor. It performs no publishing, spend, email or tenant provisioning.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { runOnboardingPipeline } from '@/lib/ai/onboarding-pipeline';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logger';
import {
  buildOpportunityMap,
  opportunityMapIntakeSchema,
  parseOpportunityMapIntake,
} from '@/lib/opportunity-map';
import { prisma } from '@/lib/prisma';
import { assertExternalUrlSafe } from '@/lib/security/validate-url';

function allowedOrigins(request: NextRequest): Set<string> {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return new Set([
    request.nextUrl.origin,
    'http://localhost:3008',
    'http://127.0.0.1:3008',
    ...configured,
  ]);
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && allowedOrigins(request).has(origin));
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Origin not permitted' },
      { status: 403 }
    );
  }

  const rate = await checkRateLimit(request, {
    namespace: 'opportunity-map',
    orgKey: 'public-scan',
    ipKey: extractClientIp(request),
    limits: {
      org: { limit: 500, windowSeconds: 3_600 },
      ip: { limit: 4, windowSeconds: 3_600 },
    },
  });
  if (!rate.ok) {
    const retryAfter = rate.retryAfterSeconds ?? 3_600;
    return NextResponse.json(
      { error: 'Scan limit reached', retryAfterSeconds: retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validated = opportunityMapIntakeSchema.safeParse(raw);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Check the supplied context and try again.' },
      { status: 400 }
    );
  }

  let intake;
  try {
    intake = parseOpportunityMapIntake(validated.data);
    await assertExternalUrlSafe(intake.website);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The website could not be checked safely.',
      },
      { status: 400 }
    );
  }

  try {
    const analysis = await runOnboardingPipeline({
      url: intake.website,
      businessName: intake.businessName,
    });
    const map = buildOpportunityMap(intake, analysis);
    const scan = await prisma.opportunityMapScan.create({
      data: {
        businessName: intake.businessName,
        website: intake.website,
        inputEvidence: intake.evidence as unknown as Prisma.InputJsonValue,
        result: map as unknown as Prisma.InputJsonValue,
        fitScore: map.fit.score,
        fitState: map.fit.state,
        source: intake.attribution.source,
        medium: intake.attribution.medium,
        campaign: intake.attribution.campaign,
      },
      select: { id: true },
    });

    return NextResponse.json({ scanId: scan.id, map });
  } catch (error) {
    logger.error('[opportunity-map] scan failed', {
      website: intake.website,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          'The map could not be completed. No result was saved; try again in a moment.',
      },
      { status: 502 }
    );
  }
}

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
