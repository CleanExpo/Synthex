/**
 * Enhancement Execution API
 *
 * POST /api/seo/enhancements/execute — executes auto-enhancements for an audit
 * Auth required, org-scoped, Zod validated.
 *
 * UNI-1610
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import {
  analyseAuditForEnhancements,
  executeAutoEnhancements,
} from '@/lib/seo/enhancement-engine';

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

    if (plan.autoExecute.length === 0) {
      return NextResponse.json({
        success: true,
        executed: 0,
        errors: 0,
        message: 'No auto-executable enhancements found',
      });
    }

    const result = await executeAutoEnhancements(
      plan,
      userId,
      user.organizationId
    );

    return NextResponse.json({
      success: true,
      executed: result.executed,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Enhancement Execute API]', error);
    return NextResponse.json(
      { error: 'Failed to execute enhancements' },
      { status: 500 }
    );
  }
}
