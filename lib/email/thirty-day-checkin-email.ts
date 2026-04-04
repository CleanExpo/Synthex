/**
 * 30-Day Check-In Email — SYN-661
 *
 * Sent once to org owners approximately 30 days after their organisation was created.
 * Celebrates the first month and surfaces three key metrics:
 *   - Posts published
 *   - Estimated hours saved
 *   - Health score (optional — omitted when ClientHealthScore not yet available)
 *
 * Uses Resend singleton pattern consistent with other Synthex emails.
 * Fire-and-forget variant is NOT used — callers receive { success, error? } to decide
 * on retry or journey event fallback.
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

export interface ThirtyDayCheckinEmailParams {
  to: string;
  businessName: string;
  postsPublished: number;
  minutesSaved: number;
  healthScore: number | null; // null = no score yet, omit the stat card
  dashboardUrl?: string; // defaults to APP_URL/dashboard
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-AU');
}

function scoreColour(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function buildHealthScoreCard(score: number): string {
  const colour = scoreColour(score);
  return `
          <td width="33%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
            <p style="margin:0;font-size:26px;font-weight:700;color:${colour};">${score}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Health Score</p>
          </td>`;
}

/**
 * Sends the 30-day check-in email. Returns { success, error? }.
 * Does NOT throw — caller handles retry / journey event fallback.
 */
export async function sendThirtyDayCheckinEmail(
  params: ThirtyDayCheckinEmailParams
): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    businessName,
    postsPublished,
    minutesSaved,
    healthScore,
    dashboardUrl = `${APP_URL}/dashboard`,
  } = params;

  const hoursSaved = Math.round(minutesSaved / 60);
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const thirdStatCell = healthScore !== null
    ? buildHealthScoreCard(healthScore)
    : `
          <td width="33%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;">
            <p style="margin:0;font-size:26px;font-weight:700;color:#111827;">30</p>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Days Active</p>
          </td>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>30 days in — ${businessName}'s Synthex snapshot</title>
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
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">30-Day Check-In</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">30 Days In</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                Here's what Synthex has done for ${businessName}
              </h1>
            </td>
          </tr>

          <!-- Stats row -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:#111827;">${formatNumber(postsPublished)}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Posts Published</p>
                  </td>
                  <td width="4%"></td>
                  <td width="30%" style="text-align:center;padding:16px 8px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:#ea580c;">${formatNumber(hoursSaved)}h</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;">Hours Saved</p>
                  </td>
                  <td width="4%"></td>
                  ${thirdStatCell}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                Your AI marketing system has been working in the background — publishing content,
                tracking engagement, and learning what works for ${businessName}.
              </p>
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                The first 30 days are when the data foundations are built. Head to your dashboard to
                see your content performance, upcoming scheduled posts, and the AI advisor's latest
                recommendations for next month.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View your dashboard →
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
      subject: `30 days in — here's what Synthex has done for ${businessName}`,
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
