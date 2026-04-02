/**
 * Intervention Email Renderer — SYN-616
 *
 * Renders and sends the Tier 2 "While You Were Away" value proof email.
 * Fetches templates from the intervention_templates table, substitutes
 * merge fields, and sends via Resend.
 *
 * Hero metric sources:
 *   reach             → posts published in last 30 days
 *   reviews_handled   → pending GBP review count
 *   dollar_attribution → latest RecommendedAction.dollarAttribution text
 */

import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Lazy Resend singleton — safe to import in test environments
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export interface ValueProofEmailParams {
  to: string;
  clientName: string;
  dimension: string;
  currentScore: number;
  baselineScore: number;
  /** Negative number — the stored value from HealthIntervention.declineMagnitude */
  declineMagnitude: number;
  organizationId: string;
}

// ── Hero Metric ───────────────────────────────────────────────────────────────

async function computeHeroMetric(
  source: string | null,
  organizationId: string
): Promise<string> {
  if (!source) return '—';

  if (source === 'reach') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const count = await prisma.post.count({
      where: { campaign: { organizationId }, scheduledAt: { gte: thirtyDaysAgo } },
    });
    return `${count} posts`;
  }

  if (source === 'reviews_handled') {
    const count = await prisma.gBPReview.count({
      where: { organizationId, responseStatus: 'pending' },
    });
    return String(count);
  }

  if (source === 'dollar_attribution') {
    const latest = await prisma.recommendedAction.findFirst({
      where: { organizationId },
      orderBy: { weekStart: 'desc' },
      select: { dollarAttribution: true },
    });
    return latest?.dollarAttribution ?? '—';
  }

  return '—';
}

// ── Merge Fields ──────────────────────────────────────────────────────────────

function applyMergeFields(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? `{{${key}}}`);
}

// ── HTML Rendering ────────────────────────────────────────────────────────────

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const htmlLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<br>';

    // ALL-CAPS section headings (e.g. "IN THE LAST 30 DAYS:")
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 4 &&
      /[A-Z]{3}/.test(trimmed)
    ) {
      return `<p style="margin:20px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;color:#6b7280;">${trimmed}</p>`;
    }

    // Bullet points
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      return `<p style="margin:4px 0 4px 16px;font-size:15px;color:#374151;line-height:1.6;">${trimmed}</p>`;
    }

    // CTA links (→ prefix)
    if (trimmed.startsWith('→')) {
      const label = trimmed.replace(/^→\s*\[?/, '').replace(/\]$/, '');
      return `<p style="margin:16px 0;"><a href="${APP_URL}/dashboard" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">${label} →</a></p>`;
    }

    return `<p style="margin:8px 0;font-size:15px;color:#374151;line-height:1.6;">${trimmed}</p>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#7c3aed;padding:24px 32px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Synthex</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${htmlLines.join('\n            ')}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
              You're receiving this as a Synthex subscriber.
              <a href="${APP_URL}/settings/notifications" style="color:#7c3aed;text-decoration:none;">Manage preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders and sends the Tier 2 "While You Were Away" value proof email.
 * Fetches the template from the DB, applies merge fields, and sends via Resend.
 * Throws if template is missing or Resend fails — caller handles the error.
 */
export async function sendValueProofEmail(params: ValueProofEmailParams): Promise<void> {
  const { to, clientName, dimension, currentScore, baselineScore, declineMagnitude, organizationId } =
    params;

  const template = await prisma.interventionTemplate.findFirst({
    where: { tier: 2, dimension, channel: 'email', active: true },
  });
  if (!template) {
    logger.warn(`[email-renderer] No active Tier 2 template for dimension: ${dimension}`);
    return;
  }

  const heroMetric = await computeHeroMetric(template.heroMetricSource, organizationId);

  const fields: Record<string, string> = {
    clientName,
    dimension: dimension.replace(/_/g, ' '),
    currentScore: String(currentScore),
    baselineScore: String(baselineScore),
    declineAmount: String(Math.abs(declineMagnitude)),
    heroMetric,
  };

  const subject = applyMergeFields(template.subjectTemplate ?? 'An update from Synthex', fields);
  const textBody = applyMergeFields(template.bodyTemplate, fields);
  const htmlBody = textToHtml(textBody);

  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: htmlBody,
    text: textBody,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info(`[email-renderer] Sent Tier 2 email to ${to} — dimension: ${dimension}`);
}

/**
 * Looks up the primary contact email for an organisation.
 * Uses billingEmail first, then the oldest user (owner).
 */
export async function getOrgContactEmail(
  organizationId: string
): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      billingEmail: true,
      users: { select: { email: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });
  return org?.billingEmail ?? org?.users[0]?.email ?? null;
}
