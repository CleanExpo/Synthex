/**
 * POST /api/seo/rankings/targets — Add a keyword target (max 20 per org)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { addKeywordTarget } from '@/lib/seo/rank-tracker';

const AddTargetSchema = z.object({
  keyword: z.string().min(1).max(200),
  location: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = AddTargetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const target = await addKeywordTarget(
      organizationId,
      parsed.data.keyword,
      parsed.data.location
    );
    return NextResponse.json({ success: true, target }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to add keyword target';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
