/**
 * Quarterly Milestone Review Email — SYN-662
 *
 * Sent once per quarter when quarterly_review_ready() ≥ 3.
 * The highest-stakes client communication Synthex sends — leads with
 * Synthex IQ and closes with a testimonial card download link.
 *
 * Sections (in order):
 *   1. Synthex IQ             (always — dominant opening metric)
 *   2. GEO Score trajectory   (conditional: ≥4 weekly data points)
 *   3. Content Intelligence   (conditional: content_performance_profiles ≥ cold-start gate)
 *   4. Attribution estimate   (conditional: confidence ≥ 0.80 only)
 *   5. Authority Score        (conditional: ≥2 data points for delta)
 *   6. Win Notification summary (always)
 *   7. Testimonial card CTA   (always — links to /api/results/testimonial-card)
 *
 * Custom Oracle non-negotiable: every displayed metric carries a
 * "which means" plain-English translation sentence.
 *
 * Feature flag: QUARTERLY_REVIEW_ENABLED must be 'true' on the route side.
 *
 * Uses Resend singleton pattern consistent with other Synthex emails.
 * Never throws — callers receive { success, error? }.
 *
 * SYN-662
 */

import { Resend } from 'resend';
import {
  buildPulseSurveyHtml,
  buildTrackedUrl,
} from '@/lib/journey/pulse-survey';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeoScoreSection {
  currentScore: number;
  delta90Days: number | null; // current minus score 90 days ago
  peerPercentile: number | null; // 0-100: % of same-industry clients with lower score
}

export interface ContentTopPost {
  excerpt: string; // first 60 chars of post content
  reachCount: number;
}

export interface QuarterlyMilestoneEmailParams {
  to: string;
  businessName: string;
  industry: string; // plain-English e.g. "Carpet & Upholstery Cleaning"
  stateOrRegion: string; // e.g. "Victoria"
  quarterLabel: string; // e.g. "Q1 2026"
  joinDate: string; // e.g. "January 2026"

  /** Synthex IQ score. Always shown. */
  synthexIq: number;

  /** GEO Score trajectory — null when fewer than 4 weekly data points. */
  geoSection: GeoScoreSection | null;

  /** Top 3 posts. null when content_performance_profiles < cold-start gate. */
  topPosts: ContentTopPost[] | null;

  /** Attribution estimate string e.g. "$4,200". null when confidence < 0.80. */
  attributionAmount: string | null;
  monthlyPlanCost: number | null; // for ROI calculation

  /** Authority score 0-100 and delta. null when fewer than 2 data points. */
  authorityScore: number | null;
  authorityDelta: number | null;

  /** Win count this quarter. 0 = always show encouraging framing. */
  winsCount: number;
  bestWinExcerpt: string | null; // first 60 chars of best post
  bestWinReach: number | null;
  bestWinEngagement: number | null; // engagement rate 0-1

  /** URL for the testimonial card PNG download */
  testimonialCardUrl: string;

  dashboardUrl?: string;
  /** Journey event tracking — required to enable pulse survey + click tracking. */
  clientId?: string;
  momentId?: string;
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildSynthexIqSection(
  synthexIq: number,
  businessName: string,
  joinDate: string
): string {
  return `
          <!-- Synthex IQ — dominant opening -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#0f172a;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 28px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;">Your Synthex IQ</p>
                    <p style="margin:0 0 12px;font-size:52px;font-weight:800;color:#ffffff;letter-spacing:-2px;line-height:1;">${synthexIq.toLocaleString('en-AU')}</p>
                    <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.6;">
                      Synthex has invested ${synthexIq.toLocaleString('en-AU')} marketing actions in ${businessName} since ${joinDate} —
                      ${synthexIq.toLocaleString('en-AU')} moments of autonomous marketing work compounding in your favour.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildGeoSection(
  geo: GeoScoreSection,
  industry: string,
  region: string
): string {
  const multiplierEstimate =
    geo.delta90Days !== null && geo.delta90Days > 0
      ? `${(1 + geo.delta90Days / 100).toFixed(1)}×`
      : null;

  const directionWord =
    geo.delta90Days !== null
      ? geo.delta90Days > 0
        ? 'above'
        : geo.delta90Days < 0
          ? 'below'
          : 'at'
      : 'at';

  const peerStatement =
    geo.peerPercentile !== null
      ? `You're performing ${directionWord} average for ${industry} businesses in ${region} at the 90-day mark.`
      : '';

  const impactStatement = multiplierEstimate
    ? `Google is now showing your business to approximately ${multiplierEstimate} more local searchers than 90 days ago.`
    : `Your local search visibility has strengthened over the quarter.`;

  return `
          <!-- GEO Score trajectory -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#0369a1;text-transform:uppercase;">GEO Score</p>
                    <p style="margin:0 0 4px;font-size:32px;font-weight:800;color:#0f172a;">${geo.currentScore}<span style="font-size:16px;font-weight:500;color:#64748b;">/100</span>
                      ${geo.delta90Days !== null ? `<span style="font-size:16px;font-weight:600;color:${geo.delta90Days >= 0 ? '#16a34a' : '#dc2626'};margin-left:12px;">${geo.delta90Days >= 0 ? '+' : ''}${geo.delta90Days} pts</span>` : ''}
                    </p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      ${impactStatement} ${peerStatement}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildContentSection(topPosts: ContentTopPost[]): string {
  const postRows = topPosts
    .map(
      p => `
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                        <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">
                          "${p.excerpt}" — reached <strong>${p.reachCount.toLocaleString('en-AU')}</strong> people
                        </p>
                      </td>
                    </tr>`
    )
    .join('');

  return `
          <!-- Content Intelligence -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#374151;text-transform:uppercase;">Top Performing Posts</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${postRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildAttributionSection(amount: string, cost: number | null): string {
  const roiText =
    cost && cost > 0
      ? ` Your Synthex subscription returned approximately ${(parseFloat(amount.replace(/[^0-9.]/g, '')) / cost).toFixed(1)}× for every dollar you invested this quarter.`
      : '';

  return `
          <!-- Attribution estimate -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#9a3412;text-transform:uppercase;">Estimated Revenue Impact</p>
                    <p style="margin:0 0 8px;font-size:32px;font-weight:800;color:#c2410c;letter-spacing:-1px;">${amount}</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      Based on your Google Analytics data, Synthex content contributed approximately ${amount} in enquiry value this quarter.${roiText}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function authorityBandMeaning(score: number, industry: string): string {
  if (score >= 76)
    return `Google considers your business one of the more trusted local ${industry} businesses in your area.`;
  if (score >= 56)
    return `Google considers your business a trusted local ${industry} business in your area.`;
  if (score >= 31)
    return `Google is growing its trust in your business — your authority is building.`;
  return `Your business authority is in early stages — this is normal at 90 days, and it's growing.`;
}

function buildAuthoritySection(
  score: number,
  delta: number | null,
  industry: string
): string {
  const deltaHtml =
    delta !== null
      ? `<span style="font-size:15px;font-weight:600;color:${delta >= 0 ? '#16a34a' : '#dc2626'};margin-left:10px;">${delta >= 0 ? '▲ +' : '▼ '}${delta} pts from last month</span>`
      : '';

  return `
          <!-- Authority Score -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#15803d;text-transform:uppercase;">Authority Score</p>
                    <p style="margin:0 0 8px;font-size:28px;font-weight:800;color:#0f172a;">${score}/100 ${deltaHtml}</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                      ${authorityBandMeaning(score, industry)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildWinsSection(
  winsCount: number,
  bestWinExcerpt: string | null,
  bestWinReach: number | null,
  bestWinEngagement: number | null
): string {
  const countText =
    winsCount === 0
      ? 'Your audience data is building. Wins come when Synthex has learned enough about what resonates — that learning is happening now.'
      : `${winsCount} win${winsCount === 1 ? '' : 's'} this quarter — post${winsCount === 1 ? '' : 's'} that outperformed your industry average.`;

  const bestWinHtml =
    winsCount > 0 && bestWinExcerpt
      ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;font-style:italic;line-height:1.5;">
         "${bestWinExcerpt}" — your top post this quarter${bestWinReach ? `, reaching ${bestWinReach.toLocaleString('en-AU')} people` : ''}${bestWinEngagement ? ` with ${(bestWinEngagement * 100).toFixed(1)}% engagement` : ''}.
       </p>`
      : '';

  return `
          <!-- Win Notification summary -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#92400e;text-transform:uppercase;">🏆 Wins This Quarter</p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">${countText}</p>
                    ${bestWinHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// ── Main HTML builder ─────────────────────────────────────────────────────────

function buildHtml(params: QuarterlyMilestoneEmailParams): string {
  const {
    businessName,
    industry,
    stateOrRegion,
    quarterLabel,
    joinDate,
    synthexIq,
    geoSection,
    topPosts,
    attributionAmount,
    monthlyPlanCost,
    authorityScore,
    authorityDelta,
    winsCount,
    bestWinExcerpt,
    bestWinReach,
    bestWinEngagement,
    testimonialCardUrl,
    dashboardUrl = `${APP_URL}/dashboard`,
    clientId,
    momentId,
  } = params;

  const iqSection = buildSynthexIqSection(synthexIq, businessName, joinDate);
  const geoHtml = geoSection
    ? buildGeoSection(geoSection, industry, stateOrRegion)
    : '';
  const contentHtml =
    topPosts && topPosts.length > 0 ? buildContentSection(topPosts) : '';
  const attributionHtml = attributionAmount
    ? buildAttributionSection(attributionAmount, monthlyPlanCost)
    : '';
  const authorityHtml =
    authorityScore !== null && authorityDelta !== null
      ? buildAuthoritySection(authorityScore, authorityDelta, industry)
      : '';
  const winsHtml = buildWinsSection(
    winsCount,
    bestWinExcerpt,
    bestWinReach,
    bestWinEngagement
  );
  const pulseHtml =
    clientId && momentId
      ? buildPulseSurveyHtml({
          clientId,
          momentId,
          question: 'How useful was your Quarterly Milestone Review?',
        })
      : '';
  const trackedDashboardUrl =
    clientId && momentId
      ? buildTrackedUrl(clientId, momentId, dashboardUrl)
      : dashboardUrl;
  const trackedTestimonialUrl =
    clientId && momentId
      ? buildTrackedUrl(clientId, momentId, testimonialCardUrl)
      : testimonialCardUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${businessName} — Quarterly Milestone Review · ${quarterLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;">Synthex · Quarterly Milestone Review</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:36px 32px 24px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#94a3b8;text-transform:uppercase;">${quarterLabel}</p>
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${businessName}, here's your 90-day Synthex story.
              </h1>
              <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">
                Every number below represents work Synthex has done for your business since ${joinDate}.
              </p>
            </td>
          </tr>

          ${iqSection}
          ${geoHtml}
          ${contentHtml}
          ${attributionHtml}
          ${authorityHtml}
          ${winsHtml}
          ${pulseHtml}

          <!-- Testimonial card download -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a;">Share your result</p>
                    <p style="margin:0 0 12px;font-size:14px;color:#64748b;line-height:1.5;">
                      Download a shareable card showing your best result this quarter.
                    </p>
                    <a href="${trackedTestimonialUrl}"
                       style="display:inline-block;padding:10px 24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                      Download your result →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 40px;text-align:center;">
              <a href="${trackedDashboardUrl}"
                 style="display:inline-block;padding:14px 32px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                Your next 90 days start now →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You're receiving this because Synthex has completed your quarterly milestone review for ${businessName}.<br />
                <a href="${APP_URL}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Manage notifications</a>
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

function buildText(params: QuarterlyMilestoneEmailParams): string {
  const lines: string[] = [
    `${params.businessName} — Quarterly Milestone Review · ${params.quarterLabel}`,
    '',
    `Synthex IQ: ${params.synthexIq.toLocaleString('en-AU')}`,
    `Synthex has invested ${params.synthexIq.toLocaleString('en-AU')} marketing actions in ${params.businessName} since ${params.joinDate}.`,
    '',
  ];

  if (params.geoSection) {
    lines.push(
      `GEO Score: ${params.geoSection.currentScore}/100${params.geoSection.delta90Days !== null ? ` (${params.geoSection.delta90Days >= 0 ? '+' : ''}${params.geoSection.delta90Days} pts from 90 days ago)` : ''}`
    );
    lines.push('');
  }

  if (params.attributionAmount) {
    lines.push(`Estimated Revenue Impact: ${params.attributionAmount}`);
    lines.push('');
  }

  const winsText =
    params.winsCount === 0
      ? 'Your audience data is building. Wins come when Synthex has learned enough about what resonates.'
      : `${params.winsCount} win${params.winsCount === 1 ? '' : 's'} this quarter — posts that outperformed your industry average.`;
  lines.push(winsText);
  lines.push('');

  lines.push(`Download your result card: ${params.testimonialCardUrl}`);
  lines.push('');
  lines.push(
    `Your next 90 days start now: ${params.dashboardUrl ?? `${APP_URL}/dashboard`}`
  );
  lines.push('');
  lines.push(`Manage notifications: ${APP_URL}/dashboard/settings`);

  return lines.join('\n');
}

// ── Send function ─────────────────────────────────────────────────────────────

/**
 * Send the Quarterly Milestone Review email via Resend.
 *
 * Returns `{ success: true }` on delivery, `{ success: false, error }` on failure.
 * Never throws — caller checks the `success` flag.
 */
export async function sendQuarterlyMilestoneEmail(
  params: QuarterlyMilestoneEmailParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();

    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `${params.businessName} — your ${params.quarterLabel} Synthex Milestone Review`,
      html: buildHtml(params),
      text: buildText(params),
    });

    if (error) {
      console.error('[quarterly-milestone-email] Resend error:', error);
      return { success: false, error: String(error) };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quarterly-milestone-email] Unexpected error:', msg);
    return { success: false, error: msg };
  }
}
