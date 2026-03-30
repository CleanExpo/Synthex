/**
 * Monthly Story Email
 *
 * Sends the monthly marketing narrative to a client 48h before their billing anchor date.
 * Uses the existing Resend singleton pattern from billing-emails.ts.
 *
 * @task SYN-553
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

export interface MonthlyStoryEmailParams {
  to: string;
  businessName: string;
  monthLabel: string; // e.g. "March 2026"
  storyText: string;
  totalReach: number;
  postsPublished: number;
  autonomousPosts: number;
  minutesSaved: number;
  // Referral prompt — only included when liveModeT >= 1 and months_subscribed >= 1
  includeReferral?: boolean;
  referralUrl?: string;
  // Dashboard link
  storyId: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-AU');
}

function buildReferralBlock(totalReach: number, referralUrl: string): string {
  return `
  <tr>
    <td style="padding:24px 32px;background:#fff8f0;border-top:1px solid #ffe4cc;border-bottom:1px solid #ffe4cc;">
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#c2410c;">
        Know another business that could use this?
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
        Your marketing ran automatically this month.
        ${formatNumber(totalReach)} people engaged with your content.
        Know another local business that could use this?
      </p>
      <a href="${referralUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;">
        Share Synthex →
      </a>
    </td>
  </tr>`;
}

/**
 * Sends the monthly story email. Returns true on success, false on failure.
 * Does NOT throw — callers handle retry logic.
 */
export async function sendMonthlyStoryEmail(
  params: MonthlyStoryEmailParams
): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    businessName,
    monthLabel,
    storyText,
    totalReach,
    postsPublished,
    autonomousPosts,
    minutesSaved,
    includeReferral = false,
    referralUrl = '',
    storyId,
  } = params;

  const hoursaved = Math.round(minutesSaved / 60);
  const dashboardUrl = `${APP_URL}/dashboard?story=${storyId}`;
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const storyParagraphs = storyText
    .split('\n\n')
    .filter(Boolean)
    .map(
      p =>
        `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">${p.replace(/\n/g, '<br>')}</p>`
    )
    .join('');

  const referralBlock =
    includeReferral && referralUrl
      ? buildReferralBlock(totalReach, referralUrl)
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${businessName}'s marketing in ${monthLabel}</title>
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
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Monthly Marketing Story</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:32px 32px 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">${monthLabel}</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${businessName}'s marketing — here's what happened
              </h1>
            </td>
          </tr>

          <!-- Stats row -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:#111827;">${formatNumber(totalReach)}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Total Reach</p>
                  </td>
                  <td width="4%"></td>
                  <td width="33%" style="text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:#111827;">${postsPublished}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Posts Published</p>
                  </td>
                  <td width="4%"></td>
                  <td width="26%" style="text-align:center;padding:16px 8px;background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;">
                    <p style="margin:0;font-size:26px;font-weight:700;color:#ea580c;">${hoursaved}h</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;">Time Saved</p>
                  </td>
                </tr>
              </table>
              ${
                autonomousPosts > 0
                  ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;text-align:center;">${autonomousPosts} of ${postsPublished} posts published automatically</p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Story text -->
          <tr>
            <td style="padding:0 32px 24px;">
              ${storyParagraphs}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View full story in dashboard →
              </a>
            </td>
          </tr>

          ${referralBlock}

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
      subject: `${businessName}'s marketing in ${monthLabel} — here's what happened`,
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
