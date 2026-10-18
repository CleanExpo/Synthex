/**
 * Featured-in-Synthex opt-in — app/api/clients/featured-opt-in/route.ts
 *
 * PATCH /api/clients/featured-opt-in
 * body: { clientId: string }
 *
 * NOT PROVISIONED: the opt-in reads and writes clients.featured_programme_status,
 * but prisma/schema.prisma has no `clients` table (nor that column). Until it is
 * provisioned the route answers 503 FEATURE_NOT_PROVISIONED instead of
 * pretending the opt-in was recorded.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

export const runtime = 'nodejs';

const OptInBodySchema = z.object({
  clientId: z.string().trim().min(1),
});

export async function PATCH(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OptInBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'clientId is required', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return notProvisionedResponse(
    'Featured-programme opt-in is not available: the clients table is not provisioned.'
  );
}
