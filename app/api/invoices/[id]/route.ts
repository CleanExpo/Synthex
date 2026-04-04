/**
 * Invoice Detail API
 *
 * GET    /api/invoices/[id] — Get a single invoice with line items
 * PATCH  /api/invoices/[id] — Update invoice metadata / status
 * DELETE /api/invoices/[id] — Delete an invoice (not allowed if paid)
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId
 *
 * UNI-173
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION
// ============================================================================

const UpdateInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  clientName: z.string().min(1).max(200).optional(),
  clientEmail: z.string().email().optional(),
  clientAddress: z.string().max(500).optional(),
  clientAbn: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  issuedAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
});

// ============================================================================
// GET /api/invoices/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: { lineItems: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    logger.error('[invoices/[id]] GET error', { error, id, orgId });
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/invoices/[id]
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  const existing = await prisma.invoice.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.dueDate) updateData.dueDate = new Date(parsed.data.dueDate);
    if (parsed.data.issuedAt)
      updateData.issuedAt = new Date(parsed.data.issuedAt);
    if (parsed.data.paidAt) updateData.paidAt = new Date(parsed.data.paidAt);
    // Auto-stamp paidAt when marking as paid
    if (parsed.data.status === 'paid' && !existing.paidAt) {
      updateData.paidAt = new Date();
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { lineItems: true },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    logger.error('[invoices/[id]] PATCH error', { error, id, orgId });
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/invoices/[id]
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organisation context found' },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot delete a paid invoice' },
        { status: 409 }
      );
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[invoices/[id]] DELETE error', { error, id, orgId });
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
