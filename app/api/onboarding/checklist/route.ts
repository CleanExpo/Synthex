/**
 * Activation Checklist Endpoint
 *
 * GET /api/onboarding/checklist
 *
 * Returns the 5-step activation status for the current user's organisation.
 * Steps:
 *   1. url_health_check   — BrandDNA exists (URL was audited during onboarding)
 *   2. social_connection  — at least one active non-GMB PlatformConnection
 *   3. gmb_connection     — at least one googlebusiness PlatformConnection or GBPLocation
 *   4. llm_integration    — active APICredential OR platform env key configured
 *   5. first_post         — at least one Post across the org's campaigns
 *
 * UNI-1615
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export interface ChecklistStatus {
  url_health_check: boolean;
  social_connection: boolean;
  gmb_connection: boolean;
  llm_integration: boolean;
  first_post: boolean;
}

// Platform env keys that count as an available LLM integration
const PLATFORM_LLM_KEYS = [
  process.env.OPENROUTER_API_KEY,
  process.env.ANTHROPIC_API_KEY,
  process.env.GOOGLE_AI_API_KEY,
  process.env.OPENAI_API_KEY,
].some(Boolean);

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json({
      status: {
        url_health_check: false,
        social_connection: false,
        gmb_connection: false,
        llm_integration: PLATFORM_LLM_KEYS,
        first_post: false,
      } satisfies ChecklistStatus,
    });
  }

  const [brandDna, socialConnections, gmbConnections, byokCredentials, posts] =
    await Promise.all([
      // 1. URL Health Check — BrandDNA exists for this org
      prisma.brandDNA.findUnique({
        where: { organizationId },
        select: { id: true },
      }),

      // 2. Social Media Connection — any active non-GMB platform
      prisma.platformConnection.findFirst({
        where: {
          organizationId,
          platform: { not: 'googlebusiness' },
          isActive: true,
        },
        select: { id: true },
      }),

      // 3. GMB Connection — googlebusiness platform
      prisma.platformConnection.findFirst({
        where: {
          organizationId,
          platform: 'googlebusiness',
        },
        select: { id: true },
      }),

      // 4. LLM Integration — BYOK key via APICredential
      prisma.aPICredential.findFirst({
        where: {
          userId,
          isActive: true,
          revokedAt: null,
          provider: { in: ['openrouter', 'anthropic', 'google', 'openai'] },
        },
        select: { id: true },
      }),

      // 5. First Post — any Post across org campaigns
      prisma.post.findFirst({
        where: {
          campaign: { organizationId },
        },
        select: { id: true },
      }),
    ]);

  const status: ChecklistStatus = {
    url_health_check: !!brandDna,
    social_connection: !!socialConnections,
    gmb_connection: !!gmbConnections,
    llm_integration: !!byokCredentials || PLATFORM_LLM_KEYS,
    first_post: !!posts,
  };

  return NextResponse.json({ status });
}
