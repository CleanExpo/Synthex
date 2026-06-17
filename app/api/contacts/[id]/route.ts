/**
 * Contact detail (CRM) — Read / Update / Delete a single contact (backlog #3).
 *
 *   GET    /api/contacts/[id]  → fetch one contact in the caller's org
 *   PATCH  /api/contacts/[id]  → update mutable fields (partial)
 *   DELETE /api/contacts/[id]  → remove the contact
 *
 * Completes the org-scoped CRUD surface the collection route (list + create)
 * started. Org isolation is enforced the same way: resolve the caller's org from
 * their user row, then read/write the contact via an org-scoped `findFirst`.
 * A contact outside the caller's org returns 404 (not 403) so existence does not
 * leak across organisations. Rows are additionally RLS-gated at the DB layer.
 *
 * Validation ladder (repo norm): 401 (no session) → 403 (no org) → 400 (bad body,
 * PATCH only) → 404 (not in org) → 2xx.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// All fields optional (partial update); `null` clears an optional column. `name`
// stays non-empty when present — a contact must keep a name. Same field bounds as
// the create schema on the collection route.
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).nullable().optional(),
  role: z.string().max(120).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  /** SOFT ref to a Supabase clients.id — which client this contact belongs to. */
  clientId: z.string().max(64).nullable().optional(),
});

const CONTACT_SELECT = {
  id: true,
  clientId: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Resolve the caller and their organisation, or the HTTP response to return. */
async function resolveOrg(
  request: NextRequest
): Promise<{ organizationId: string } | { error: NextResponse }> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return {
      error: NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 }
      ),
    };
  }

  return { organizationId: user.organizationId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveOrg(request);
    if ('error' in auth) return auth.error;
    const { id } = await params;

    const contact = await prisma.contact.findFirst({
      where: { id, organizationId: auth.organizationId },
      select: CONTACT_SELECT,
    });
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    logger.error('contacts: detail fetch failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveOrg(request);
    if ('error' in auth) return auth.error;
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Org-scoped existence check first — guarantees a cross-org id is a 404, never
    // an unscoped update by id.
    const existing = await prisma.contact.findFirst({
      where: { id, organizationId: auth.organizationId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: parsed.data,
      select: CONTACT_SELECT,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    logger.error('contacts: update failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveOrg(request);
    if ('error' in auth) return auth.error;
    const { id } = await params;

    const existing = await prisma.contact.findFirst({
      where: { id, organizationId: auth.organizationId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await prisma.contact.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('contacts: delete failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
