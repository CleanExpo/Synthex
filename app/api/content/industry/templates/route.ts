/**
 * GET /api/content/industry/templates
 *
 * Returns all industry templates for a given industry key.
 *
 * Query param: ?industry=trades
 *
 * Part of SYN-408 — Voice Onboarding + Industry Modes.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { seedIndustryTemplates } from '@/lib/content/industry-templates';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Security check — authentication
  const security = await APISecurityChecker.check(
    req,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error ?? 'Unauthorised' },
      401,
      security.context
    );
  }

  // 2. Extract and validate query param
  const { searchParams } = new URL(req.url);
  const industry = searchParams.get('industry')?.trim() ?? '';

  if (!industry) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Missing required query parameter: industry' },
      400,
      security.context
    );
  }

  // 3. Lazy-seed templates on first request (fire-and-forget)
  const count = await prisma.industryTemplate.count();
  if (count === 0) {
    await seedIndustryTemplates();
  }

  // 4. Fetch templates for the requested industry
  const templates = await prisma.industryTemplate.findMany({
    where: { industry },
    select: { id: true, scenarioName: true, exampleOutput: true },
    orderBy: { scenarioName: 'asc' },
  });

  return APISecurityChecker.createSecureResponse(
    { templates },
    200,
    security.context
  );
}
