/**
 * POST /api/invoices/[id]/payment-link
 *
 * Creates a Stripe Payment Link for the invoice total and persists it on the
 * invoice record. Idempotent — returns the existing URL if already created.
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId
 *
 * UNI-173
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
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
// POST /api/invoices/[id]/payment-link
// ============================================================================

export async function POST(
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
    // 1. Fetch invoice (org-scoped)
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // 2. Cannot create a payment link for a paid invoice
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Invoice is already paid' },
        { status: 409 }
      );
    }

    // 3. Idempotent — return existing link if already generated
    if (invoice.stripePaymentLinkUrl) {
      return NextResponse.json({
        paymentLinkUrl: invoice.stripePaymentLinkUrl,
      });
    }

    // 4. Stripe must be configured
    if (!stripe) {
      return NextResponse.json(
        { error: 'Payment processing is not configured' },
        { status: 503 }
      );
    }

    // 5. Create a one-time Stripe Price for the invoice total
    const price = await stripe.prices.create({
      currency: invoice.currency.toLowerCase(),
      unit_amount: invoice.totalCents,
      product_data: {
        name: `Invoice ${invoice.invoiceNumber}`,
        metadata: { invoiceId: invoice.id, orgId },
      },
    });

    // 6. Create the Stripe Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoiceId: invoice.id, orgId },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social'}/dashboard/invoices`,
        },
      },
    });

    // 7. Persist to the invoice record
    await prisma.invoice.update({
      where: { id },
      data: {
        stripePaymentLinkId: paymentLink.id,
        stripePaymentLinkUrl: paymentLink.url,
      },
    });

    return NextResponse.json({ paymentLinkUrl: paymentLink.url });
  } catch (error) {
    logger.error('[invoices/[id]/payment-link] POST error', {
      error,
      id,
      orgId,
    });
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
}
