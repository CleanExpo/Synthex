/**
 * 30-Day Check-In Email — SYN-661
 *
 * Sent once to org owners 28–45 days after account creation.
 * Bridges the gap before the Quarterly Milestone Review arrives at day 90.
 *
 * Three sections:
 *   1. GEO Score baseline card  (conditional — shown only if client_geo_scores has data)
 *   2. First Wins summary       (conditional — shown only if win_notifications exist)
 *   3. Promise statement        (always shown)
 *
 * Adaptive subject line — based on actual_send_day:
 *   28-32 → "30 days in — here's what we've learned about your business"
 *   33-38 → "Five weeks in — your Synthex starting point"
 *   39-45 → "Your Synthex baseline — here's where we start from"
 *
 * Custom Oracle non-negotiable: every displayed metric carries a plain-English
 * "which means" sentence. No metric name appears without an immediate outcome.
 *
 * Uses Resend singleton pattern consistent with other Synthex emails.
 * Never throws — callers receive { success, error? }.
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

export type SubjectLineVariant = 'day_28_32' | 'day_33_38' | 'day_39_45';

export interface ThirtyDayCheckinEmailParams {
  to: string;
  businessName: string;
  /** Actual calendar day since client creation (28-45). Drives subject + variant. */
  actualSendDay: number;
  /** Latest GEO Score (0-100). null = no data yet. */
  geoScore: number | null;
  /** Count of win_notification events for this client before send date. */
  winsCount: number;
  dashboardUrl?: string;
  calendarUrl?: string;
  /** Journey event tracking — required to enable pulse survey + click tracking. */
  clientId?: string;
  momentId?: string;
}

// ── Subject line ──────────────────────────────────────────────────────────────

export function getSubjectVariant(actualSendDay: number): SubjectLineVariant {
  if (actualSendDay <= 32) return 'day_28_32';
  if (actualSendDay <= 38) return 'day_33_38';
  return 'day_39_45';
}

function getSubjectLine(variant: SubjectLineVariant): string {
  switch (variant) {
    case 'day_28_32':
      return "30 days in — here's what we've learned about your business";
    case 'day_33_38':
      return 'Five weeks in — your Synthex starting point';
    case 'day_39_45':
      return "Your Synthex baseline — here's where we start from";
  }
}

// ── GEO Score section ─────────────────────────────────────────────────────────

function geoScoreBandMeaning(score: number): string {
  if (score <= 30) {
    return "Google has limited visibility of your business in local search right now — that's exactly what we're here to fix.";
  }
  if (score <= 55) {
    return "Google can find your business in local search — there's meaningful room to grow your visibility.";
  }
  if (score <= 75) {
    return "Google is showing your business well in local search — we'll push that further.";
  }
  return "Google considers your business highly visible in local search — we're working to maintain and extend that.";
}

function buildGeoScoreSection(geoScore: number | null): string {
  if (geoScore === null) {
    return `
          <!-- GEO Score placeholder -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#0369a1;text-transform:uppercase;">Local Search Visibility</p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                      We're monitoring your local search visibility. Your first GEO Score arrives within the next 14 days.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  const meaning = geoScoreBandMeaning(geoScore);
  return `
          <!-- GEO Score baseline card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#0369a1;text-transform:uppercase;">Your GEO Score Baseline</p>
                    <p style="margin:0 0 12px;font-size:28px;font-weight:800;color:#0f172a;">${geoScore}<span style="font-size:16px;font-weight:500;color:#64748b;">/100</span></p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                      ${meaning}
                      This is your starting point. In your first Milestone Review (around day 90), we'll show you how it's grown.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// ── First Wins section ────────────────────────────────────────────────────────

function buildWinsSection(winsCount: number): string {
  if (winsCount === 0) {
    return `
          <!-- First Wins — none yet -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fefce8;border:1.5px solid #fde68a;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#92400e;text-transform:uppercase;">Your First Win</p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                      Your first win is coming. Synthex is actively learning what resonates with your audience — the more we post, the faster we learn.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  const winWord = winsCount === 1 ? 'win' : 'wins';
  const postWord = winsCount === 1 ? 'post' : 'posts';
  const dataWord = winsCount === 1 ? 'data point' : 'data points';

  return `
          <!-- First Wins summary -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#15803d;text-transform:uppercase;">🏆 Early Wins</p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                      You've already had <strong>${winsCount} ${winWord}</strong> with Synthex — ${postWord} that outperformed your industry average.
                      That's ${winsCount} ${dataWord} Synthex is already learning from.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: ThirtyDayCheckinEmailParams): string {
  const {
    businessName,
    actualSendDay,
    geoScore,
    winsCount,
    dashboardUrl = `${APP_URL}/dashboard`,
    clientId,
    momentId,
  } = params;

  const variant = getSubjectVariant(actualSendDay);
  const geoSection = buildGeoScoreSection(geoScore);
  const winsSection = buildWinsSection(winsCount);
  const pulseSection =
    clientId && momentId
      ? buildPulseSurveyHtml({
          clientId,
          momentId,
          question: 'How useful was this 30-day update?',
        })
      : '';
  const trackedDashboardUrl =
    clientId && momentId
      ? buildTrackedUrl(clientId, momentId, dashboardUrl)
      : dashboardUrl;

  // Vary headline copy to match subject variant
  const headlineText =
    variant === 'day_28_32'
      ? `30 days in — here's what we've learned.`
      : variant === 'day_33_38'
        ? `Five weeks in — your starting point.`
        : `Your Synthex baseline.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${businessName} — ${headlineText}</title>
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
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;">Synthex · 30-Day Update</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${businessName}, ${headlineText}
              </h1>
              <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">
                Here's where things stand at the ${variant === 'day_28_32' ? '30-day' : variant === 'day_33_38' ? 'five-week' : '45-day'} mark.
              </p>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:24px;"></td></tr>

          ${geoSection}

          ${winsSection}

          ${pulseSection}

          <!-- Promise statement (always shown) -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#475569;text-transform:uppercase;">What's Coming</p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                      Over the next 60 days, Synthex will continue posting, learning from your results,
                      and building your local search visibility. By day 90, you'll get a full Milestone Review
                      showing exactly what's changed — and what it means for your business.
                    </p>
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
                See your dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You're receiving this because Synthex is monitoring ${businessName}'s marketing.<br />
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

function buildText(params: ThirtyDayCheckinEmailParams): string {
  const {
    businessName,
    actualSendDay,
    geoScore,
    winsCount,
    dashboardUrl = `${APP_URL}/dashboard`,
  } = params;

  const variant = getSubjectVariant(actualSendDay);
  const lines: string[] = [
    getSubjectLine(variant),
    '',
    `Hi ${businessName},`,
    '',
  ];

  // GEO Score
  if (geoScore !== null) {
    lines.push(`Your GEO Score Baseline: ${geoScore}/100`);
    lines.push(geoScoreBandMeaning(geoScore));
    lines.push(
      "This is your starting point. In your first Milestone Review (around day 90), we'll show you how it's grown."
    );
  } else {
    lines.push(
      "We're monitoring your local search visibility. Your first GEO Score arrives within the next 14 days."
    );
  }

  lines.push('');

  // Wins
  if (winsCount > 0) {
    const winWord = winsCount === 1 ? 'win' : 'wins';
    const dataWord = winsCount === 1 ? 'data point' : 'data points';
    lines.push(
      `You've already had ${winsCount} ${winWord} with Synthex — posts that outperformed your industry average. That's ${winsCount} ${dataWord} Synthex is already learning from.`
    );
  } else {
    lines.push(
      'Your first win is coming. Synthex is actively learning what resonates with your audience — the more we post, the faster we learn.'
    );
  }

  lines.push('');
  lines.push(
    "Over the next 60 days, Synthex will continue posting, learning from your results, and building your local search visibility. By day 90, you'll get a full Milestone Review showing exactly what's changed — and what it means for your business."
  );
  lines.push('');
  lines.push(`See your dashboard: ${dashboardUrl}`);
  lines.push('');
  lines.push(`Manage notifications: ${APP_URL}/dashboard/settings`);

  return lines.join('\n');
}

// ── Send function ─────────────────────────────────────────────────────────────

/**
 * Send the 30-Day Check-In email via Resend.
 *
 * Returns `{ success: true }` on delivery, `{ success: false, error }` on failure.
 * Never throws — caller checks the `success` flag.
 */
export async function sendThirtyDayCheckinEmail(
  params: ThirtyDayCheckinEmailParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const variant = getSubjectVariant(params.actualSendDay);
    const subject = getSubjectLine(variant);
    const resend = getResend();

    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject,
      html: buildHtml(params),
      text: buildText(params),
    });

    if (error) {
      console.error('[thirty-day-checkin-email] Resend error:', error);
      return { success: false, error: String(error) };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[thirty-day-checkin-email] Unexpected error:', msg);
    return { success: false, error: msg };
  }
}
