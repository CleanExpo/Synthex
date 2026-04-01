/**
 * Team Invite Email — SYN-597
 *
 * Branded Resend email sent to collaborator invitees.
 * Contains business name, owner name, and a one-click CTA to accept.
 *
 * @task SYN-597
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

export interface TeamInviteEmailParams {
  to: string;
  businessName: string;
  ownerName: string;
  invitationId: string;
}

/**
 * Sends a branded team invitation email. Returns { success, error? }.
 * Does NOT throw — callers handle retry logic.
 */
export async function sendBrandedTeamInviteEmail(
  params: TeamInviteEmailParams
): Promise<{ success: boolean; error?: string }> {
  const { to, businessName, ownerName, invitationId } = params;

  // The accept URL is handled by SYN-598's accept flow
  const acceptUrl = `${APP_URL}/invite/accept?token=${invitationId}`;
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You've been invited to view ${businessName}'s dashboard</title>
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
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Team Invitation</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 0;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${ownerName} invited you to view ${businessName}'s dashboard
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                ${ownerName} is using Synthex to run their marketing automatically.
                As a collaborator, you'll be able to see their results — posts published,
                audience growth, and weekly performance reports.
              </p>

              <!-- Permissions summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f9fafb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;">Your access</p>
                    <p style="margin:0 0 6px;font-size:14px;color:#374151;">✓ &nbsp;View dashboard, content calendar, and reports</p>
                    <p style="margin:0;font-size:14px;color:#9ca3af;">✗ &nbsp;Cannot change brand voice, auto-publish settings, or billing</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${acceptUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;">
                View ${businessName}'s Dashboard →
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">
                This invitation expires in 7 days. If you did not expect this, you can ignore it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Sent via Synthex AI Marketing Platform.<br>
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
      subject: `${ownerName} invited you to view ${businessName}'s marketing dashboard`,
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
