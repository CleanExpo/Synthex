/**
 * Invoice PDF Export API
 *
 * GET /api/invoices/[id]/pdf — Generate and stream an invoice as a PDF
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId
 *
 * Uses Puppeteer to render an HTML template and return PDF bytes.
 * Content-Type: application/pdf
 * Content-Disposition: attachment; filename="INV-XXXX.pdf"
 *
 * UNI-173
 */

import { NextRequest } from 'next/server';
import puppeteer from 'puppeteer';
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
// HELPERS
// ============================================================================

/** Format cents as Australian dollar string, e.g. $1,234.56 */
function formatAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Format a Date (or null) as DD/MM/YYYY */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Capitalise first letter */
function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// HTML TEMPLATE
// ============================================================================

interface InvoiceWithLineItems {
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  clientName: string;
  clientEmail: string;
  clientAddress: string | null;
  clientAbn: string | null;
  notes: string | null;
  dueDate: Date | null;
  issuedAt: Date | null;
  lineItems: {
    id: string;
    description: string;
    quantity: { toString(): string };
    unitCents: number;
    totalCents: number;
    taxRate: { toString(): string };
  }[];
}

interface OrgDetails {
  name: string;
  abn: string | null;
}

function buildInvoiceHtml(
  invoice: InvoiceWithLineItems,
  org: OrgDetails
): string {
  const lineItemRows = invoice.lineItems
    .map(item => {
      const qty = parseFloat(item.quantity.toString());
      const taxRate = parseFloat(item.taxRate.toString());
      const gstCents = Math.round(item.totalCents * (taxRate / (1 + taxRate)));
      return `
        <tr>
          <td class="description">${escapeHtml(item.description)}</td>
          <td class="center">${qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)}</td>
          <td class="right">${formatAud(item.unitCents)}</td>
          <td class="right">${formatAud(gstCents)}</td>
          <td class="right">${formatAud(item.totalCents)}</td>
        </tr>`;
    })
    .join('');

  const statusColour =
    invoice.status === 'paid'
      ? '#16a34a'
      : invoice.status === 'overdue'
        ? '#dc2626'
        : invoice.status === 'cancelled'
          ? '#6b7280'
          : '#2563eb';

  const clientAbnRow = invoice.clientAbn
    ? `<p>ABN: ${escapeHtml(invoice.clientAbn)}</p>`
    : '';
  const clientAddressRow = invoice.clientAddress
    ? `<p>${escapeHtml(invoice.clientAddress).replace(/\n/g, '<br>')}</p>`
    : '';
  const notesSection = invoice.notes
    ? `
      <div class="section">
        <h3>Notes</h3>
        <p class="notes">${escapeHtml(invoice.notes).replace(/\n/g, '<br>')}</p>
      </div>`
    : '';
  const orgAbnRow = org.abn ? `<span>ABN: ${escapeHtml(org.abn)}</span>` : '';

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
    }

    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 0;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #111827;
      margin-bottom: 24px;
    }
    .header-org {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }
    .header-org-abn {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    .header-title {
      text-align: right;
    }
    .header-title h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      letter-spacing: 0.05em;
    }
    .header-title .invoice-number {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }

    /* ── Meta row ── */
    .meta-row {
      display: flex;
      gap: 32px;
      margin-bottom: 28px;
      background: #f9fafb;
      border-radius: 6px;
      padding: 14px 18px;
    }
    .meta-item {
      flex: 1;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: ${statusColour}1a;
      color: ${statusColour};
      border: 1px solid ${statusColour}40;
    }

    /* ── Client block ── */
    .section {
      margin-bottom: 28px;
    }
    .section h3 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .section p {
      font-size: 13px;
      color: #111827;
      margin-bottom: 2px;
    }
    .client-name {
      font-size: 15px;
      font-weight: 600;
    }
    .notes {
      font-size: 13px;
      color: #374151;
      background: #f9fafb;
      border-left: 3px solid #d1d5db;
      padding: 10px 14px;
      border-radius: 0 4px 4px 0;
    }

    /* ── Line items table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead tr {
      background: #111827;
      color: #ffffff;
    }
    thead th {
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
    }
    thead th.center { text-align: center; }
    thead th.right  { text-align: right;  }

    tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }
    tbody tr:last-child {
      border-bottom: none;
    }
    tbody td {
      padding: 10px 12px;
      font-size: 13px;
      color: #111827;
      vertical-align: top;
    }
    td.description { width: 44%; }
    td.center { text-align: center; }
    td.right  { text-align: right;  }

    /* ── Totals ── */
    .totals {
      margin-left: auto;
      width: 280px;
      margin-bottom: 32px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
    }
    .totals-row.grand-total {
      border-top: 2px solid #111827;
      border-bottom: none;
      padding-top: 10px;
      margin-top: 4px;
      font-size: 16px;
      font-weight: 700;
      color: #111827;
    }
    .totals-label { font-weight: 500; }
    .totals-value { font-weight: 500; text-align: right; }
    .totals-row.grand-total .totals-value { font-weight: 700; }

    /* ── Footer ── */
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #9ca3af;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div class="header-org-block">
        <div class="header-org">${escapeHtml(org.name)}</div>
        ${orgAbnRow ? `<div class="header-org-abn">${orgAbnRow}</div>` : ''}
      </div>
      <div class="header-title">
        <h1>TAX INVOICE</h1>
        <div class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</div>
      </div>
    </div>

    <!-- Meta row -->
    <div class="meta-row">
      <div class="meta-item">
        <div class="meta-label">Invoice #</div>
        <div class="meta-value">${escapeHtml(invoice.invoiceNumber)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Status</div>
        <div class="meta-value">
          <span class="status-badge">${escapeHtml(capitalise(invoice.status))}</span>
        </div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Issue Date</div>
        <div class="meta-value">${formatDate(invoice.issuedAt)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Due Date</div>
        <div class="meta-value">${formatDate(invoice.dueDate)}</div>
      </div>
    </div>

    <!-- Bill To -->
    <div class="section">
      <h3>Bill To</h3>
      <p class="client-name">${escapeHtml(invoice.clientName)}</p>
      <p>${escapeHtml(invoice.clientEmail)}</p>
      ${clientAddressRow}
      ${clientAbnRow}
    </div>

    <!-- Line Items -->
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="center">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">GST</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${formatAud(invoice.subtotalCents)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">GST (10%)</span>
        <span class="totals-value">${formatAud(invoice.taxCents)}</span>
      </div>
      <div class="totals-row grand-total">
        <span class="totals-label">Total (AUD)</span>
        <span class="totals-value">${formatAud(invoice.totalCents)}</span>
      </div>
    </div>

    ${notesSection}

    <!-- Footer -->
    <div class="footer">
      <span>Generated by Synthex</span>
      <span>${escapeHtml(invoice.invoiceNumber)} · ${formatDate(new Date())}</span>
    </div>

  </div>
</body>
</html>`;
}

/** Minimal HTML entity escaping to prevent XSS in the generated document */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// GET /api/invoices/[id]/pdf
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
    return Response.json(
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
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, abn: true },
    });

    if (!org) {
      return Response.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    const html = buildInvoiceHtml(invoice, org);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let pdfBytes: Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
    } finally {
      await browser.close();
    }

    // Slice to get a plain ArrayBuffer — required for Web Response BodyInit
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('[invoices/[id]/pdf] GET error', { error, id, orgId });
    return Response.json(
      { error: 'Failed to generate invoice PDF' },
      { status: 500 }
    );
  }
}
