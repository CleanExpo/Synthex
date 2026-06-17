/**
 * Contacts (CRM) — List + Create (backlog #3, Unify CRM primitives).
 *
 *   GET  /api/contacts   → list this org's contacts
 *   POST /api/contacts   → create a new contact record
 *
 * Org-scoped via withAuth's clientId (the organisation). NB: the Contact model
 * also has its own `clientId` field — a SOFT reference to the Supabase `clients`
 * table — which is distinct from the auth-context org id. Rows carry
 * organization_id and are additionally RLS-gated at the database layer.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320).optional(),
  role: z.string().max(120).optional(),
  phone: z.string().max(60).optional(),
  /** SOFT ref to a Supabase clients.id — which client this contact belongs to. */
  clientId: z.string().max(64).optional(),
});

export const GET = withAuth(async (_request, { clientId: organizationId }) => {
  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      clientId: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ contacts });
});

export const POST = defineRoute(
  {
    body: createSchema,
    serverErrorMessage: 'Failed to create contact',
    onError: error =>
      logger.error('contacts: create failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId: organizationId }) => {
    const contact = await prisma.contact.create({
      data: {
        organizationId,
        clientId: body.clientId,
        name: body.name,
        email: body.email,
        role: body.role,
        phone: body.phone,
      },
    });
    return NextResponse.json({ contact }, { status: 201 });
  }
);
