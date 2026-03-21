/**
 * Enhancement Plan API
 *
 * POST /api/seo/enhancements — returns enhancement plan for an audit
 * Auth required, org-scoped, Zod validated.
 *
 * UNI-1610
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { analyseAuditForEnhancements } from '@/lib/seo/enhancement-engine';

const RequestSchema = z.object({
  auditId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  try {
    const plan = await analyseAuditForEnhancements(
      parsed.data.auditId,
      userId,
      user.organizationId
    );
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('[Enhancements API]', error);
    return NextResponse.json(
      { error: 'Failed to analyse enhancements' },
      { status: 500 }
    );
  }
}
