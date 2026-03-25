/**
 * Waitlist Confirmation Email
 *
 * @description Sends a confirmation email when a user joins the Synthex waitlist.
 * Fire-and-forget — does not throw so the API route stays fast.
 *
 * ENVIRONMENT VARIABLES:
 * - RESEND_API_KEY: Resend API key (SECRET)
 * - EMAIL_FROM:     Sender address (e.g. "Synthex <noreply@synthex.social>")
 */

import { Resend } from 'resend';

// Lazy singleton — instantiated on first use so module import does not throw
// when RESEND_API_KEY is absent (e.g. in test environments).
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Synthex <noreply@synthex.social>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

/**
 * Send a waitlist confirmation email.
 * Fire-and-forget — does not throw.
 */
export function sendWaitlistConfirmationEmail(params: { email: string }): void {
  getResend()
    .emails.send({
      from: FROM,
      to: params.email,
      subject: "You're on the Synthex waitlist",
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the Synthex waitlist</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Logo wordmark -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:11px;letter-spacing:0.25em;color:rgba(255,255,255,0.4);text-transform:uppercase;">Synthex</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#0a0a12;border:0.5px solid rgba(255,255,255,0.06);border-radius:4px;padding:40px 36px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:300;color:#ffffff;">You&rsquo;re on the list</h1>
              <p style="margin:0 0 24px;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Thanks for your interest in Synthex &mdash; the AI-powered marketing automation platform.
                We&rsquo;re working through our waitlist and will reach out as soon as your spot is ready.
              </p>

              <div style="border-top:0.5px solid rgba(255,255,255,0.06);padding-top:24px;margin-top:8px;">
                <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">
                  In the meantime, you can learn more about what we&rsquo;re building:
                </p>
                <a href="${APP_URL}"
                   style="display:inline-block;background:#f59e0b;color:#050508;font-size:12px;font-weight:500;padding:10px 20px;border-radius:3px;text-decoration:none;">
                  Learn more about Synthex
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6;">
                You received this email because you joined the Synthex waitlist.<br>
                &copy; ${new Date().getFullYear()} Synthex &mdash;
                <a href="${APP_URL}" style="color:rgba(255,255,255,0.3);text-decoration:none;">synthex.social</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    })
    .catch(err => {
      console.error('[waitlist-email] Failed to send confirmation email:', err);
    });
}
