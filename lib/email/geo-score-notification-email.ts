/**
 * GEO Score Monthly Notification Email
 *
 * Two variants:
 *   improved      — delta ≥ +5  → "Your AI visibility improved!"
 *   needs_attention — delta ≤ -5 → "Your AI visibility needs attention"
 *
 * Follows the Resend singleton pattern from monthly-story-email.ts.
 *
 * @task SYN-658
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM    = process.env.EMAIL_FROM      ?? 'Synthex <noreply@synthex.social>';
const REPLY_TO = 'support@synthex.social';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export type GeoEmailVariant = 'improved' | 'needs_attention';

export interface GeoScoreTrendPoint {
  week: string;  // ISO date label e.g. "2026-03-24"
  score: number; // 0-100
}

export interface GeoRecommendedAction {
  action:    string;
  impact:    number;
  cta_url:   string;
  cta_text?: string;
}

export interface GeoScoreNotificationEmailParams {
  to:                    string;
  businessName:          string;
  variant:               GeoEmailVariant;
  currentScore:          number;
  delta:                 number;           // signed, e.g. +12 or -8
  trendData:             GeoScoreTrendPoint[];
  recommendedActions:    GeoRecommendedAction[];
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

function scoreBandColor(score: number): string {
  if (score >= 67) return '#10B981'; // green — Strong
  if (score >= 34) return '#F59E0B'; // amber — Growing
  return '#EF4444';                  // red   — Low
}

function scoreBandLabel(score: number): string {
  if (score >= 67) return 'Strong';
  if (score >= 34) return 'Growing';
  return 'Low';
}

// ── Mini trend chart (HTML bar chart — email-safe, no images) ─────────────────

function buildTrendChart(trendData: GeoScoreTrendPoint[]): string {
  const points = trendData.slice(-8); // last 8 weeks
  if (points.length === 0) return '';

  const maxScore = 100;
  const chartHeight = 48;

  const bars = points
    .map(p => {
      const barHeight = Math.max(3, Math.round((p.score / maxScore) * chartHeight));
      const color = scoreBandColor(p.score);
      return `<td style="vertical-align:bottom;padding:0 1px;">
        <div style="width:12px;height:${barHeight}px;background:${color};border-radius:2px 2px 0 0;"></div>
      </td>`;
    })
    .join('');

  return `
  <table cellpadding="0" cellspacing="0" style="margin:12px 0 4px;">
    <tr style="height:${chartHeight}px;vertical-align:bottom;">
      ${bars}
    </tr>
  </table>
  <p style="margin:0;font-size:11px;color:#9ca3af;">Last ${points.length} weeks</p>`;
}

// ── Score hero badge ───────────────────────────────────────────────────────────

function buildScoreHero(
  score: number,
  delta: number,
  variant: GeoEmailVariant
): string {
  const color       = scoreBandColor(score);
  const label       = scoreBandLabel(score);
  const deltaSign   = delta >= 0 ? '+' : '';
  const deltaColor  = variant === 'improved' ? '#10B981' : '#EF4444';
  const deltaLabel  = `${deltaSign}${delta} points this month`;

  return `
  <table cellpadding="0" cellspacing="0" style="margin:24px 0 20px;">
    <tr>
      <td style="width:80px;height:80px;border-radius:50%;border:4px solid ${color};
                 text-align:center;vertical-align:middle;background:#ffffff;">
        <p style="margin:0;font-size:22px;font-weight:700;color:${color};line-height:1;">${score}</p>
        <p style="margin:0;font-size:10px;color:${color};text-transform:uppercase;
                  letter-spacing:0.5px;font-weight:600;">${label}</p>
      </td>
      <td style="padding-left:16px;vertical-align:middle;">
        <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${score} / 100</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${deltaColor};">${deltaLabel}</p>
      </td>
    </tr>
  </table>`;
}

// ── Recommended action card ────────────────────────────────────────────────────

function buildActionCard(action: GeoRecommendedAction): string {
  const ctaText = action.cta_text ?? 'Take action';
  const ctaUrl  = action.cta_url.startsWith('http')
    ? action.cta_url
    : `${APP_URL}${action.cta_url}`;

  return `
  <tr>
    <td style="padding:16px;background:#f9fafb;border-radius:8px;margin-bottom:8px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${action.action}</p>
          </td>
          <td style="white-space:nowrap;padding-left:12px;vertical-align:middle;">
            <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;
                         font-size:12px;font-weight:600;padding:2px 8px;border-radius:12px;">
              +${action.impact} pts
            </span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:8px;">
            <a href="${ctaUrl}"
               style="font-size:13px;color:#2563eb;text-decoration:underline;">${ctaText} →</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="height:8px;"></td></tr>`;
}

// ── HTML builder ───────────────────────────────────────────────────────────────

function buildHtml(params: GeoScoreNotificationEmailParams): { subject: string; html: string } {
  const {
    businessName,
    variant,
    currentScore,
    delta,
    trendData,
    recommendedActions,
  } = params;

  const isImproved     = variant === 'improved';
  const utmCampaign    = isImproved ? 'geo_score_improved' : 'geo_score_needs_attention';
  const panelUrl       = `${APP_URL}/dashboard/geo-score?utm_source=synthex_email&utm_medium=geo_score_monthly&utm_campaign=${utmCampaign}`;
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(params.to)}`;

  const subject = isImproved
    ? `Your AI visibility improved this month 🟢`
    : `Your AI visibility dropped this month — here's how to recover`;

  const headlineText = isImproved
    ? `${businessName}'s AI visibility improved this month`
    : `${businessName}'s AI visibility needs attention`;

  const bodyText = isImproved
    ? `Your business is appearing more often when AI tools like ChatGPT and Google AI Overviews recommend local businesses. Here's what moved the needle:`
    : `Your GEO Score dropped this month, which means fewer AI recommendations for your business. One action can turn this around:`;

  const ctaText   = isImproved ? 'View Your Full GEO Score →' : 'Take Action Now →';
  const topActions = isImproved
    ? recommendedActions.slice(0, 3)
    : recommendedActions.slice(0, 1);

  const scoreHero  = buildScoreHero(currentScore, delta, variant);
  const trendChart = isImproved ? buildTrendChart(trendData) : '';
  const actionRows = topActions.map(buildActionCard).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
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
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">AI Search Visibility</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 0;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${headlineText}
              </h1>
              ${scoreHero}
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">${bodyText}</p>
              ${trendChart ? `<div>${trendChart}</div>` : ''}
            </td>
          </tr>

          <!-- Actions -->
          ${topActions.length > 0 ? `
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
                ${isImproved ? 'Keep the momentum' : 'Your top action'}
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${actionRows}
              </table>
            </td>
          </tr>` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding:24px 32px;">
              <a href="${panelUrl}"
                 style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;
                        padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                ${ctaText}
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

  return { subject, html };
}

// ── Public send function ───────────────────────────────────────────────────────

/**
 * Sends a GEO Score monthly notification email.
 * Returns { success: true } or { success: false, error: string }.
 * Never throws.
 */
export async function sendGeoScoreNotificationEmail(
  params: GeoScoreNotificationEmailParams
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const { subject, html } = buildHtml(params);

  try {
    const result = await getResend().emails.send({
      from:     FROM,
      to:       params.to,
      replyTo:  REPLY_TO,
      subject,
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, emailId: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
