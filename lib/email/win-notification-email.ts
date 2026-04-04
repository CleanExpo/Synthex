/**
 * Win Notification Email — SYN-671
 *
 * Sends a celebration email when a client's post ranks in the top-10%
 * of their own content by engagement rate. Part of the Sprint 5 Win
 * Notification fallback infrastructure (GEO Panel data absent — SYN-656).
 *
 * Plain-English rule: zero metric names, zero percentages without a
 * plain-English equivalent. "Your Tuesday post reached more people
 * than 9 out of 10 of your posts this month."
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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

// ── Params ────────────────────────────────────────────────────────────────────

export interface WinNotificationEmailParams {
  to: string;
  businessName: string;

  /** Excerpt of post content (first 60 chars) — e.g. "Your guide to finding the best..." */
  postExcerpt: string;

  /**
   * Human-readable day and platform for the post.
   * e.g. "your Tuesday Instagram post" or "your LinkedIn post from 3 days ago"
   */
  postLabel: string;

  /**
   * Plaintext description of the win.
   * e.g. "reached more locals than 9 out of 10 of your recent posts"
   */
  winDescription: string;

  /** Link to the specific post or calendar view */
  calendarUrl: string;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHtml(params: WinNotificationEmailParams): string {
  const { businessName, postExcerpt, postLabel, winDescription, calendarUrl } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your content is performing</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;">Synthex · Win Alert</p>
            </td>
          </tr>

          <!-- Celebration -->
          <tr>
            <td style="padding:40px 32px 24px;text-align:center;">
              <div style="font-size:48px;line-height:1;margin-bottom:20px;">🏆</div>
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#0f172a;line-height:1.3;">
                ${businessName}, your content is connecting.
              </h1>
              <p style="margin:0;font-size:16px;color:#64748b;line-height:1.6;">
                Synthex noticed something worth sharing.
              </p>
            </td>
          </tr>

          <!-- Win card -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:0;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;color:#16a34a;text-transform:uppercase;">
                      Top Performer
                    </p>
                    <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#0f172a;line-height:1.5;">
                      "${postExcerpt}"
                    </p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                      Congratulations — ${postLabel} ${winDescription}.
                      That's Synthex's content strategy working for you.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 40px;text-align:center;">
              <a href="${calendarUrl}"
                 style="display:inline-block;padding:14px 32px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                See your content calendar →
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
                Keep the momentum going — Synthex is scheduling your next posts.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You're receiving this because Synthex detected a top-performing post for ${businessName}.<br />
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

function buildText(params: WinNotificationEmailParams): string {
  const { businessName, postExcerpt, postLabel, winDescription, calendarUrl } = params;
  return [
    `${businessName}, your content is connecting.`,
    '',
    `"${postExcerpt}"`,
    '',
    `Congratulations — ${postLabel} ${winDescription}.`,
    `That's Synthex's content strategy working for you.`,
    '',
    `See your content calendar: ${calendarUrl}`,
    '',
    `Manage notifications: ${APP_URL}/dashboard/settings`,
  ].join('\n');
}

// ── Send function ─────────────────────────────────────────────────────────────

/**
 * Send a Win Notification email via Resend.
 *
 * Returns `{ success: true }` on delivery, `{ success: false, error }` on failure.
 * Never throws — caller can always check the `success` flag.
 */
export async function sendWinNotificationEmail(
  params: WinNotificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      params.to,
      subject: `${params.businessName} — your content is performing 🏆`,
      html:    buildHtml(params),
      text:    buildText(params),
    });

    if (error) {
      console.error('[win-notification-email] Resend error:', error);
      return { success: false, error: String(error) };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[win-notification-email] Unexpected error:', msg);
    return { success: false, error: msg };
  }
}
