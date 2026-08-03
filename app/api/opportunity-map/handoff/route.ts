/**
 * Consent-bound handoff from a completed public map to Nexus CRM.
 *
 * A Lead is created only when the visitor explicitly asks Unite-Group to
 * contact them about the map. The scan result is copied into rawPayload so the
 * receiving team never needs to repeat discovery.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { checkRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logger';
import type { OpportunityMap } from '@/lib/opportunity-map';
import { prisma } from '@/lib/prisma';

const CONSENT_POLICY_VERSION = 'nexus-opportunity-map-contact-v1';

const handoffSchema = z
  .object({
    scanId: z.string().min(10).max(100),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional(),
    consent: z.literal(true),
  })
  .strict();

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
    namespace: 'opportunity-map-handoff',
    orgKey: 'public-handoff',
    ipKey: extractClientIp(request),
    limits: {
      org: { limit: 500, windowSeconds: 3_600 },
      ip: { limit: 6, windowSeconds: 3_600 },
    },
  });
  if (!rate.ok) {
    const retryAfter = rate.retryAfterSeconds ?? 3_600;
    return NextResponse.json(
      { error: 'Handoff limit reached' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const validated = handoffSchema.safeParse(raw);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Enter valid contact details and confirm contact consent.' },
      { status: 400 }
    );
  }

  const marketingOrgId = process.env.MARKETING_LEADS_ORG_ID;
  if (!marketingOrgId) {
    logger.error('[opportunity-map] MARKETING_LEADS_ORG_ID not configured');
    return NextResponse.json(
      { error: 'Nexus handoff is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const { scanId, name, email, phone } = validated.data;
  const consentedAt = new Date();

  try {
    const outcome = await prisma.$transaction(async tx => {
      const scan = await tx.opportunityMapScan.findUnique({
        where: { id: scanId },
      });
      if (!scan) return { state: 'not-found' as const };
      if (scan.leadId) {
        return { state: 'existing' as const, leadId: scan.leadId };
      }

      const map = scan.result as unknown as OpportunityMap;
      const lead = await tx.lead.create({
        data: {
          organizationId: marketingOrgId,
          stage: scan.fitState === 'qualified' ? 'qualified' : 'enquiry',
          contactMethod: 'form_submission',
          source: scan.source ?? 'opportunity_map',
          medium: scan.medium ?? 'web',
          campaign: scan.campaign ?? 'nexus_opportunity_map',
          occurredAt: consentedAt,
          capturedFrom: '/opportunity-map',
          rawPayload: {
            name,
            email,
            ...(phone ? { phone } : {}),
            businessName: scan.businessName,
            website: scan.website,
            opportunityMapScanId: scan.id,
            fit: map.fit,
            opportunities: map.opportunities,
            serviceRecommendation: map.serviceRecommendation,
            consent: {
              purpose:
                'Contact about this Opportunity Map and related Unite-Group services',
              policyVersion: CONSENT_POLICY_VERSION,
              consentedAt: consentedAt.toISOString(),
            },
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, stage: true },
      });

      await tx.opportunityMapScan.update({
        where: { id: scan.id },
        data: {
          leadId: lead.id,
          status: 'handed-off',
          consentPolicyVersion: CONSENT_POLICY_VERSION,
          consentedAt,
          handoffAt: consentedAt,
        },
      });

      return { state: 'created' as const, lead };
    });

    if (outcome.state === 'not-found') {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      alreadySubmitted: outcome.state === 'existing',
      nextStep:
        'Nexus has the map and your contact consent. The next contact will reference this evidence, not restart discovery.',
    });
  } catch (error) {
    logger.error('[opportunity-map] handoff failed', {
      scanId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'The handoff could not be recorded. Try again in a moment.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
