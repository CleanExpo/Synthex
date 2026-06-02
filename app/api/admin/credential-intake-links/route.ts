import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  isOwnerEmail,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import {
  CREDENTIAL_INTAKE_PROVIDERS,
  createCredentialIntakeToken,
} from '@/lib/credential-intake/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createLinkSchema = z.object({
  organizationId: z.string().min(1),
  providers: z
    .array(z.enum(CREDENTIAL_INTAKE_PROVIDERS))
    .min(1)
    .max(CREDENTIAL_INTAKE_PROVIDERS.length)
    .optional(),
  purpose: z.string().max(160).optional(),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email || !isOwnerEmail(user.email)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Owner access required' },
      { status: 403 }
    );
  }

  const parsed = createLinkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!org || org.status !== 'active') {
    return NextResponse.json(
      { error: 'Active organisation not found' },
      { status: 404 }
    );
  }

  const token = createCredentialIntakeToken({
    ...parsed.data,
    createdByUserId: userId,
  });
  const link = new URL('/credential-intake', request.nextUrl.origin);
  link.searchParams.set('token', token);

  return NextResponse.json({
    success: true,
    organization: org,
    providers: parsed.data.providers ?? CREDENTIAL_INTAKE_PROVIDERS,
    expiresInHours: parsed.data.expiresInHours ?? 72,
    url: link.toString(),
  });
}
