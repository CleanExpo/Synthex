/**
 * AI Advisor Brief Email
 *
 * Sends the weekly advisor brief to an organisation owner every Monday at 08:00 AEDT.
 * Dollar attribution is the hero metric — largest type, first thing seen on mobile.
 *
 * @task SYN-595
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

export interface AdvisorBriefEmailAction {
  rank: number;
  title: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
}

export interface AdvisorBriefEmailParams {
  to: string;
  businessName: string;
  weekLabel: string; // e.g. "31 Mar 2026"
  dollarAttribution: string; // e.g. "$2,800 worth of jobs"
  actions: AdvisorBriefEmailAction[];
  competitorMicroInsight?: string | null;
  geoTeaserText?: string | null;
  briefId: string;
}

const EFFORT_LABELS: Record<string, string> = {
  low: 'Quick win',
  medium: 'Medium effort',
  high: 'High impact',
};

function effortBadge(effort: string): string {
  const label = EFFORT_LABELS[effort] ?? effort;
  const bg =
    effort === 'low'
      ? '#dcfce7'
      : effort === 'medium'
        ? '#fef9c3'
        : '#fee2e2';
  const colour =
    effort === 'low'
      ? '#166534'
      : effort === 'medium'
        ? '#854d0e'
        : '#991b1b';
  return `<span style="display:inline-block;background:${bg};color:${colour};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>`;
}

function buildActionRow(action: AdvisorBriefEmailAction, index: number): string {
  return `
  <tr>
    <td style="padding:${index === 0 ? '0' : '16px'} 0 16px;border-bottom:1px solid #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;padding-right:12px;width:28px;">
            <div style="width:24px;height:24px;border-radius:50%;background:#111827;display:inline-flex;align-items:center;justify-content:center;">
              <span style="font-size:12px;font-weight:700;color:#ffffff;">${action.rank}</span>
            </div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#111827;">${action.title}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5;">${action.rationale}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:8px;">${effortBadge(action.effort)}</td>
                <td><span style="font-size:12px;color:#0ea5e9;font-weight:500;">${action.expectedImpact}</span></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/**
 * Sends the weekly advisor brief email. Returns { success, error? }.
 * Does NOT throw — callers handle retry logic.
 */
export async function sendAdvisorBriefEmail(
  params: AdvisorBriefEmailParams
): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    businessName,
    weekLabel,
    dollarAttribution,
    actions,
    competitorMicroInsight,
    geoTeaserText,
    briefId,
  } = params;

  const dashboardUrl = `${APP_URL}/dashboard/advisor?brief=${briefId}`;
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const actionRows = actions
    .sort((a, b) => a.rank - b.rank)
    .map((a, i) => buildActionRow(a, i))
    .join('');

  const competitorBlock =
    competitorMicroInsight
      ? `
          <!-- Competitor Pulse -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Competitor Pulse</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${competitorMicroInsight}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const geoBlock =
    geoTeaserText
      ? `
          <!-- GEO Teaser -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#065f46;text-transform:uppercase;letter-spacing:1px;font-weight:600;">AI Search Visibility</p>
                    <p style="margin:0;font-size:14px;color:#065f46;line-height:1.5;">${geoTeaserText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Synthex brief for the week of ${weekLabel}</title>
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
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Weekly Advisor Brief</p>
            </td>
          </tr>

          <!-- Hero: Dollar Attribution -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Week of ${weekLabel}</p>
              <h1 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#6b7280;">
                ${businessName}'s marketing this week
              </h1>
              <p style="margin:0;font-size:38px;font-weight:800;color:#111827;line-height:1.1;letter-spacing:-1px;">${dollarAttribution}</p>
              <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">estimated from your Synthex activity this week</p>
            </td>
          </tr>

          <!-- Actions -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Your 3 Actions This Week</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${actionRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                Open advisor dashboard →
              </a>
            </td>
          </tr>

          ${competitorBlock}
          ${geoBlock}

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
      subject: `Your Synthex brief for the week of ${weekLabel} — ${dollarAttribution}`,
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
