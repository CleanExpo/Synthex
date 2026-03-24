/**
 * Invoices API
 *
 * GET  /api/invoices — Returns user's Stripe billing invoices
 * POST /api/invoices — Create a new internal Invoice with line items
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 *
 * UNI-173
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe/config';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION — POST /api/invoices
// ============================================================================

const CreateInvoiceSchema = z.object({
  clientName: z.string().min(1).max(200),
  clientEmail: z.string().email(),
  clientAddress: z.string().max(500).optional(),
  clientAbn: z.string().max(20).optional(),
  currency: z.string().length(3).default('AUD'),
  notes: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().positive().default(1),
        unitCents: z.number().int().positive(),
        taxRate: z.number().min(0).max(1).default(0.1),
      })
    )
    .min(1),
});

export async function GET(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        {
          error: 'Billing not configured',
          message: 'Payment processing is not set up yet.',
          invoices: [],
        },
        { status: 200 }
      );
    }

    // Security check
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

    // Get user from centralised auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's subscription to find Stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({
        invoices: [],
        message: 'No billing history available',
      });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const startingAfter = searchParams.get('starting_after') || undefined;

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit,
      starting_after: startingAfter,
    });

    // Map to safe response format
    const safeInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      description: invoice.description,
      created: invoice.created,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      lines: invoice.lines.data.map(line => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
      })),
    }));

    return NextResponse.json({
      invoices: safeInvoices,
      hasMore: invoices.has_more,
    });
  } catch (error) {
    logger.error('Invoice fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/invoices — Create a new invoice
// ============================================================================

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Calculate line item totals and overall totals (outside the retry loop)
  const lineItemsWithTotals = parsed.data.lineItems.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitCents: item.unitCents,
    totalCents: Math.round(item.quantity * item.unitCents),
    taxRate: item.taxRate,
  }));
  const subtotalCents = lineItemsWithTotals.reduce(
    (sum, item) => sum + item.totalCents,
    0
  );
  const taxCents = lineItemsWithTotals.reduce(
    (sum, item) => sum + Math.round(item.totalCents * item.taxRate),
    0
  );
  const totalCents = subtotalCents + taxCents;

  // Invoice number generation uses MAX + 1 with a retry loop to handle the
  // unique constraint (@@unique([organizationId, invoiceNumber])) under
  // concurrent creation. Retries up to 3 times before giving up.
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Derive next number from the highest existing number (race-condition-safe via unique constraint)
      const latest = await prisma.invoice.findFirst({
        where: { organizationId: orgId },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      const nextSeq = latest
        ? parseInt(latest.invoiceNumber.replace(/\D/g, ''), 10) + 1
        : 1;
      const invoiceNumber = `INV-${String(nextSeq).padStart(4, '0')}`;

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          invoiceNumber,
          status: 'draft',
          currency: parsed.data.currency,
          clientName: parsed.data.clientName,
          clientEmail: parsed.data.clientEmail,
          clientAddress: parsed.data.clientAddress,
          clientAbn: parsed.data.clientAbn,
          notes: parsed.data.notes,
          dueDate: parsed.data.dueDate
            ? new Date(parsed.data.dueDate)
            : undefined,
          subtotalCents,
          taxCents,
          totalCents,
          lineItems: {
            create: lineItemsWithTotals,
          },
        },
        include: { lineItems: true },
      });

      return NextResponse.json({ invoice }, { status: 201 });
    } catch (error) {
      // Retry on unique constraint violation (P2002) — another request grabbed the same number
      const isPrismaUniqueError =
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002';
      if (isPrismaUniqueError && attempt < MAX_RETRIES - 1) {
        continue;
      }
      logger.error('[invoices] POST error', { error, orgId });
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      );
    }
  }

  // Exhausted retries (should not reach here — last iteration always returns or throws)
  return NextResponse.json(
    { error: 'Failed to generate invoice number after retries' },
    { status: 500 }
  );
}

export const runtime = 'nodejs';
