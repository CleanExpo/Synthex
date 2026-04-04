/**
 * GET /api/brand-dna/[organizationId]
 * Returns the current BrandDNA for an organisation.
 * Returns 404 if not yet extracted.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  // Ensure user can only access their own org's DNA
  const orgId = await getEffectiveOrganizationId(userId);
  const { organizationId } = await params;
  if (!orgId || orgId !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const brandDna = await prisma.brandDNA.findUnique({
    where: { organizationId: orgId },
  });

  if (!brandDna) {
    return NextResponse.json(
      { error: 'Brand DNA not yet extracted' },
      { status: 404 }
    );
  }

  return NextResponse.json({ brandDna, status: 'complete' });
}
