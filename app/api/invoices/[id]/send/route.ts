/**
 * POST /api/invoices/[id]/send
 *
 * Sends the invoice as a styled HTML email to the client via Resend.
 * Updates invoice status to 'sent' (if currently 'draft') and stamps issuedAt.
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId
 *
 * UNI-173
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
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

// Lazy Resend singleton — matches the pattern in lib/email/billing-emails.ts
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';

// ============================================================================
// HELPERS
// ============================================================================

function formatCents(cents: number, currency: string): string {
  return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
}

function buildInvoiceEmailHtml(params: {
  invoiceNumber: string;
  orgName: string;
  orgAbn: string | null;
  clientName: string;
  dueDate: Date | null;
  currency: string;
  lineItems: {
    description: string;
    quantity: string | number;
    unitCents: number;
    totalCents: number;
    taxRate: string | number;
  }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  stripePaymentLinkUrl: string | null;
}): string {
  const {
    invoiceNumber,
    orgName,
    orgAbn,
    clientName,
    dueDate,
    currency,
    lineItems,
    subtotalCents,
    taxCents,
    totalCents,
    stripePaymentLinkUrl,
  } = params;

  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Upon receipt';

  const lineItemRows = lineItems
    .map(
      item => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${item.description}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;text-align:center;">${item.quantity}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;text-align:right;">${formatCents(item.unitCents, currency)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;text-align:right;">${formatCents(item.totalCents, currency)}</td>
      </tr>`
    )
    .join('');

  const payButton = stripePaymentLinkUrl
    ? `
      <tr>
        <td align="center" style="padding:32px 40px;">
          <a href="${stripePaymentLinkUrl}"
             style="display:inline-block;background-color:#10b981;color:#ffffff;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
            Pay Online — ${formatCents(totalCents, currency)}
          </a>
        </td>
      </tr>`
    : '';

  const abnLine = orgAbn
    ? `<p style="margin:4px 0;color:#6b7280;font-size:13px;">ABN: ${orgAbn}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#111827;padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Invoice</h1>
                    <p style="margin:4px 0 0;color:#9ca3af;font-size:14px;">${invoiceNumber}</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;color:#10b981;font-size:28px;font-weight:700;">${formatCents(totalCents, currency)}</p>
                    <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Due ${dueDateStr}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- From / To -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="vertical-align:top;padding-right:16px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">From</p>
                    <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">${orgName}</p>
                    ${abnLine}
                  </td>
                  <td width="50%" style="vertical-align:top;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">To</p>
                    <p style="margin:0;color:#111827;font-size:14px;font-weight:600;">${clientName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line items table -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background-color:#f9fafb;">
                    <th style="padding:12px 16px;text-align:left;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Description</th>
                    <th style="padding:12px 16px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Qty</th>
                    <th style="padding:12px 16px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Unit Price</th>
                    <th style="padding:12px 16px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:16px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td></td>
                  <td width="260">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;color:#6b7280;font-size:14px;">Subtotal</td>
                        <td style="padding:8px 0;color:#374151;font-size:14px;text-align:right;">${formatCents(subtotalCents, currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#6b7280;font-size:14px;">GST (10%)</td>
                        <td style="padding:8px 0;color:#374151;font-size:14px;text-align:right;">${formatCents(taxCents, currency)}</td>
                      </tr>
                      <tr style="border-top:2px solid #111827;">
                        <td style="padding:12px 0 0;color:#111827;font-size:16px;font-weight:700;">Total</td>
                        <td style="padding:12px 0 0;color:#10b981;font-size:16px;font-weight:700;text-align:right;">${formatCents(totalCents, currency)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pay button -->
          ${payButton}

          <!-- Footer -->
          <tr>
            <td style="padding:${stripePaymentLinkUrl ? '0' : '32px'} 40px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                ${orgName} · Invoice ${invoiceNumber}
              </p>
              <p style="margin:8px 0 0;color:#d1d5db;font-size:11px;text-align:center;">
                Sent via Synthex
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// POST /api/invoices/[id]/send
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
      include: { lineItems: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // 2. Reject cancelled invoices
    if (invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot send a cancelled invoice' },
        { status: 409 }
      );
    }

    // 3. Fetch organisation details
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, abn: true },
    });

    // 4. Build email HTML
    const emailHtml = buildInvoiceEmailHtml({
      invoiceNumber: invoice.invoiceNumber,
      orgName: org?.name ?? 'Synthex',
      orgAbn: org?.abn ?? null,
      clientName: invoice.clientName,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      lineItems: invoice.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitCents: item.unitCents,
        totalCents: item.totalCents,
        taxRate: item.taxRate.toString(),
      })),
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      totalCents: invoice.totalCents,
      stripePaymentLinkUrl: invoice.stripePaymentLinkUrl,
    });

    // 5. Send via Resend
    await getResend().emails.send({
      from: FROM,
      to: invoice.clientEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${org?.name ?? 'Synthex'}`,
      html: emailHtml,
    });

    // 6. Update status to 'sent' (if draft) and stamp issuedAt
    const updateData: {
      status?: string;
      issuedAt?: Date;
    } = {};

    if (invoice.status === 'draft') {
      updateData.status = 'sent';
    }
    if (!invoice.issuedAt) {
      updateData.issuedAt = new Date();
    }

    const updatedInvoice =
      Object.keys(updateData).length > 0
        ? await prisma.invoice.update({
            where: { id },
            data: updateData,
            include: { lineItems: true },
          })
        : invoice;

    return NextResponse.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    logger.error('[invoices/[id]/send] POST error', { error, id, orgId });
    return NextResponse.json(
      { error: 'Failed to send invoice' },
      { status: 500 }
    );
  }
}
