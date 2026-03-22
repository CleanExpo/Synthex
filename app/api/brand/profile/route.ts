/**
 * GET /api/brand/profile?orgId=xxx
 * Returns the client's brand profile for dynamic theming.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/jwt-utils';
import { hasOrganizationAccess } from '@/lib/multi-business/business-scope';

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const hasAccess = await hasOrganizationAccess(userId, orgId);
  if (!hasAccess) return forbiddenResponse();

  try {
    const profile = await prisma.brandDNA.findUnique({
      where: { organizationId: orgId },
      select: {
        businessName: true,
        primaryColour: true,
        secondaryColour: true,
        neutralColour: true,
        logoUrl: true,
        brandVoice: true,
        vertical: true,
        industry: true,
      },
    });

    return NextResponse.json({ profile: profile ?? null });
  } catch (err) {
    console.error('[API] Brand profile error:', err);
    return NextResponse.json({ profile: null });
  }
}
