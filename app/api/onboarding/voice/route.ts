/**
 * POST /api/onboarding/voice
 *
 * Saves the answers from the 5-step voice onboarding wizard.
 * Upserts an OnboardingProfile row scoped to the caller's organisation.
 *
 * Part of SYN-408 — Voice Onboarding + Industry Modes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const voiceOnboardingSchema = z.object({
  industry: z.string().min(2).max(500),
  targetCustomer: z.string().min(2).max(500),
  differentiator: z.string().min(2).max(500),
  tone: z.string().min(2).max(500),
  firstPostTopic: z.string().min(2).max(500),
});

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Security check — authentication, rate limiting, CSRF
  const security = await APISecurityChecker.check(
    req,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error ?? 'Unauthorised' },
      401,
      security.context
    );
  }

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Unauthorised' },
      401,
      security.context
    );
  }

  // 2. Resolve the user's effective organisation
  const organisationId = await getEffectiveOrganizationId(userId);
  if (!organisationId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'No organisation context found for this account.' },
      403,
      security.context
    );
  }

  // 3. Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid JSON body.' },
      400,
      security.context
    );
  }

  const parsed = voiceOnboardingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
      security.context
    );
  }

  const { industry, targetCustomer, differentiator, tone, firstPostTopic } =
    parsed.data;

  // 4. Upsert the onboarding profile (unique on organisationId)
  const profile = await prisma.onboardingProfile.upsert({
    where: { organizationId: organisationId },
    create: {
      organizationId: organisationId,
      userId,
      industry,
      targetCustomer,
      differentiator,
      tone,
      firstPostTopic,
    },
    update: {
      industry,
      targetCustomer,
      differentiator,
      tone,
      firstPostTopic,
    },
  });

  return APISecurityChecker.createSecureResponse(
    { success: true, profileId: profile.id },
    200,
    security.context
  );
}
