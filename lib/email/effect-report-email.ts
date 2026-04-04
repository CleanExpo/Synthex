/**
 * Synthex Effect Report Email — SYN-674
 *
 * Sent once per quarter after an Effect Report is generated.
 * Renders all five report sections (conditionally) as email-safe inline-styled HTML.
 *
 * Follows the Resend singleton pattern from quarterly-milestone-email.ts.
 * Does NOT throw — callers receive { success, error? }.
 */

import { Resend } from 'resend';
import type { EffectReportData } from '@/lib/effect-report/types';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export interface EffectReportEmailParams {
  to: string;
  businessName: string;
  quarterLabel: string; // e.g. "Q1 2026"
  reportUrl: string; // /dashboard/effect-report/Q1%202026
  pngUrl: string | null;
  pdfUrl: string | null;
  reportData: EffectReportData;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function scoreColour(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function deltaText(delta: number | null): string {
  if (delta === null) return '';
  if (delta > 0) return `▲ +${delta} QoQ`;
  if (delta < 0) return `▼ ${delta} QoQ`;
  return '→ No change QoQ';
}

function deltaColour(delta: number | null): string {
  if (delta === null) return '#6b7280';
  if (delta > 0) return '#22c55e';
  if (delta < 0) return '#ef4444';
  return '#6b7280';
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildStatsRow(rd: EffectReportData): string {
  const a = rd.achievementSummary;

  const reachCell =
    a.estimatedTotalReach !== null
      ? `<td width="4%"></td>
       <td width="29%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
         <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${a.estimatedTotalReach.toLocaleString('en-AU')}</p>
         <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Est. Reach</p>
       </td>`
      : '';

  return `
          <!-- Achievement stats -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="29%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${a.postsPublished}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Posts Published</p>
                  </td>
                  ${reachCell}
                  <td width="4%"></td>
                  <td width="29%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${a.consecutiveWeeksActive}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Weeks Active</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildMetricsBlock(rd: EffectReportData): string {
  const m = rd.proprietaryMetrics;
  const hasAny =
    m.healthScore !== null || m.geoScore !== null || m.attributionRoi !== null;
  if (!hasAny) return '';

  const healthRow =
    m.healthScore !== null
      ? `<tr>
         <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;width:50%;">Health Score</td>
         <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:${scoreColour(m.healthScore)};">
           ${m.healthScore}/100
           ${m.healthScoreQoQDelta !== null ? `<span style="font-size:11px;color:${deltaColour(m.healthScoreQoQDelta)};margin-left:6px;">${deltaText(m.healthScoreQoQDelta)}</span>` : ''}
         </td>
       </tr>`
      : '';

  const geoRow =
    m.geoScore !== null
      ? `<tr>
         <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">GEO Score</td>
         <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:${scoreColour(m.geoScore)};">
           ${m.geoScore}/100
           ${m.geoScoreQoQDelta !== null ? `<span style="font-size:11px;color:${deltaColour(m.geoScoreQoQDelta)};margin-left:6px;">${deltaText(m.geoScoreQoQDelta)}</span>` : ''}
         </td>
       </tr>`
      : '';

  const attributionRow = m.attributionRoi
    ? `<tr>
         <td style="padding:8px 0;font-size:13px;color:#6b7280;">Attribution ROI</td>
         <td style="padding:8px 0;font-size:13px;font-weight:700;color:#c2410c;">${m.attributionRoi}</td>
       </tr>`
    : '';

  return `
          <!-- Proprietary metrics -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Proprietary Metrics</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${healthRow}${geoRow}${attributionRow}
              </table>
            </td>
          </tr>`;
}

function buildBiggestWinBlock(rd: EffectReportData): string {
  if (!rd.biggestWin) return '';
  const w = rd.biggestWin;
  const dateStr = new Date(w.date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `
          <!-- Biggest win -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px;font-weight:600;">🏆 Biggest Win${w.isAllTime ? ' — All-Time Record' : ''}</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      On ${dateStr}, &ldquo;${w.postExcerpt}&hellip;&rdquo; generated <strong>${w.metric}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildHonestGapBlock(rd: EffectReportData): string {
  if (!rd.honestGap) return '';
  const g = rd.honestGap;

  return `
          <!-- Honest gap -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Honest Gap</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#111827;">
                      Your <strong>${g.dimensionName}</strong> score of <strong>${g.dimensionScore}/100</strong> is your lowest this quarter.
                    </p>
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">${g.recommendedAction}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildWhatsNextBlock(rd: EffectReportData): string {
  if (!rd.whatsNext) return '';
  const n = rd.whatsNext;

  return `
          <!-- What's next -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">What's Next</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${n.projection}</p>
              <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">${n.confidenceBasis}</p>
            </td>
          </tr>`;
}

function buildDownloadRow(
  pngUrl: string | null,
  pdfUrl: string | null
): string {
  if (!pngUrl && !pdfUrl) return '';

  const pngLink = pngUrl
    ? `<a href="${pngUrl}" style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;color:#374151;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;margin-right:8px;">⬇ Share card (PNG)</a>`
    : '';
  const pdfLink = pdfUrl
    ? `<a href="${pdfUrl}" style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;color:#374151;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;">⬇ PDF report</a>`
    : '';

  return `
          <!-- Download links -->
          <tr>
            <td style="padding:16px 32px 0;">
              ${pngLink}${pdfLink}
            </td>
          </tr>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Sends the Synthex Effect Report email.
 * Returns { success, error? }. Does NOT throw.
 */
export async function sendEffectReportEmail(
  params: EffectReportEmailParams
): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    businessName,
    quarterLabel,
    reportUrl,
    pngUrl,
    pdfUrl,
    reportData: rd,
  } = params;

  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const statsRow = buildStatsRow(rd);
  const metricsBlock = buildMetricsBlock(rd);
  const biggestWin = buildBiggestWinBlock(rd);
  const honestGap = buildHonestGapBlock(rd);
  const whatsNext = buildWhatsNextBlock(rd);
  const downloadRow = buildDownloadRow(pngUrl, pdfUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName} — Synthex Effect Report ${quarterLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Synthex</p>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Effect Report — ${quarterLabel}</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${quarterLabel}</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${businessName}'s quarterly effect report
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:#374151;line-height:1.7;">
                Here's everything Synthex achieved for ${businessName} this quarter — the full picture, honestly.
              </p>
            </td>
          </tr>

          ${statsRow}
          ${metricsBlock}
          ${biggestWin}
          ${honestGap}
          ${whatsNext}
          ${downloadRow}

          <!-- CTA -->
          <tr>
            <td style="padding:24px 32px 32px;">
              <a href="${reportUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View full report →
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

  const text = [
    `${businessName} — Synthex Effect Report ${quarterLabel}`,
    '',
    `Posts Published: ${rd.achievementSummary.postsPublished}`,
    rd.achievementSummary.estimatedTotalReach !== null
      ? `Estimated Reach: ${rd.achievementSummary.estimatedTotalReach.toLocaleString('en-AU')}`
      : null,
    `Consecutive Weeks Active: ${rd.achievementSummary.consecutiveWeeksActive}`,
    rd.proprietaryMetrics.healthScore !== null
      ? `Health Score: ${rd.proprietaryMetrics.healthScore}/100`
      : null,
    rd.proprietaryMetrics.geoScore !== null
      ? `GEO Score: ${rd.proprietaryMetrics.geoScore}/100`
      : null,
    rd.biggestWin
      ? `Biggest Win: "${rd.biggestWin.postExcerpt}…" generated ${rd.biggestWin.metric}`
      : null,
    rd.honestGap
      ? `Honest Gap: ${rd.honestGap.dimensionName} (${rd.honestGap.dimensionScore}/100) — ${rd.honestGap.recommendedAction}`
      : null,
    rd.whatsNext ? `What's Next: ${rd.whatsNext.projection}` : null,
    '',
    `View full report: ${reportUrl}`,
    pdfUrl ? `Download PDF: ${pdfUrl}` : null,
    pngUrl ? `Share card: ${pngUrl}` : null,
    '',
    'Powered by Synthex · synthex.social',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  try {
    const result = await getResend().emails.send({
      from: FROM,
      to,
      subject: `${businessName}'s Effect Report is ready — ${quarterLabel}`,
      html,
      text,
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
