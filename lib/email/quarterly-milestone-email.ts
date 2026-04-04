/**
 * Quarterly Milestone Review Email — SYN-662
 *
 * Sent once per quarter to org owners when `quarterly_review_ready()` returns ≥3,
 * meaning enough data exists for a meaningful 90-day performance narrative.
 *
 * Hero metrics (shown as stat cards):
 *   - Posts published in the quarter
 *   - Current health score
 *   - Dollar attribution (from latest advisor brief)
 *
 * Conditional block:
 *   - Authority score delta (shown when ≥2 data points exist for month-on-month delta)
 *
 * Uses Resend singleton pattern consistent with other Synthex emails.
 * Does NOT throw — callers receive { success, error? }.
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export interface QuarterlyMilestoneEmailParams {
  to: string;
  businessName: string;
  quarterLabel: string;       // e.g. "Q1 2026"
  postsPublished: number;
  healthScore: number | null;
  dollarAttribution: string | null; // e.g. "$4,200 worth of jobs" — from advisor brief
  authorityScoreDelta: number | null; // positive = improved; null = insufficient data
  dashboardUrl?: string;
}

function healthScoreColour(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function deltaArrow(delta: number): string {
  if (delta > 0) return `▲ +${delta} pts from last month`;
  if (delta < 0) return `▼ ${delta} pts from last month`;
  return '→ No change from last month';
}

function deltaColour(delta: number): string {
  if (delta > 0) return '#22c55e';
  if (delta < 0) return '#ef4444';
  return '#6b7280';
}

function buildAuthorityBlock(delta: number): string {
  return `
          <!-- Authority Score Delta -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Authority Score Trend</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:${deltaColour(delta)};">${deltaArrow(delta)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildAttributionBlock(dollarAttribution: string): string {
  return `
          <!-- Attribution hero -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#9a3412;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Estimated Revenue Impact</p>
                    <p style="margin:0;font-size:22px;font-weight:800;color:#c2410c;letter-spacing:-0.5px;">${dollarAttribution}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#9a3412;">from Synthex activity this quarter</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/**
 * Sends the Quarterly Milestone Review email. Returns { success, error? }.
 * Does NOT throw — callers handle journey event fallback logic.
 */
export async function sendQuarterlyMilestoneEmail(
  params: QuarterlyMilestoneEmailParams
): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    businessName,
    quarterLabel,
    postsPublished,
    healthScore,
    dollarAttribution,
    authorityScoreDelta,
    dashboardUrl = `${APP_URL}/dashboard`,
  } = params;

  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const healthCell = healthScore !== null
    ? `
                  <td width="4%"></td>
                  <td width="33%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:${healthScoreColour(healthScore)};">${healthScore}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Health Score</p>
                  </td>`
    : '';

  const authorityBlock = authorityScoreDelta !== null
    ? buildAuthorityBlock(authorityScoreDelta)
    : '';

  const attributionBlock = dollarAttribution
    ? buildAttributionBlock(dollarAttribution)
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName}'s Quarterly Milestone Review — ${quarterLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#111111;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Synthex</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Quarterly Milestone Review</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${quarterLabel}</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${businessName}'s quarterly marketing snapshot
              </h1>
            </td>
          </tr>

          <!-- Stats row -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="${healthScore !== null ? '29%' : '60%'}" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:#111827;">${postsPublished}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Posts Published</p>
                  </td>
                  ${healthCell}
                </tr>
              </table>
            </td>
          </tr>

          ${attributionBlock}

          <!-- Body copy -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                Your AI marketing system has been learning and improving over the past quarter.
                Every piece of content published has added to ${businessName}'s digital footprint —
                building brand presence and driving potential customers to your door.
              </p>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                Head to your dashboard to explore your full quarterly report, including content
                performance trends, advisor recommendations, and what to focus on next quarter.
              </p>
            </td>
          </tr>

          ${authorityBlock}

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View quarterly report →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                You're receiving this because you're a Synthex subscriber.<br>
                <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to,
      subject: `${businessName}'s quarterly marketing snapshot — ${quarterLabel}`,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
