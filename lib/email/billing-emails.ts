/**
 * Billing Email Notifications
 *
 * @description Fire-and-forget email notifications for Stripe billing lifecycle events:
 * - Payment receipt (payment_intent.succeeded / invoice.payment_succeeded)
 * - Payment failed alert (invoice.payment_failed)
 * - Subscription cancelled confirmation (customer.subscription.deleted)
 *
 * IMPORTANT: All functions are synchronous (void return) and use .catch() to swallow
 * errors. Stripe webhook handlers must respond within 3 seconds — awaiting email
 * delivery would risk timeout.
 *
 * ENVIRONMENT VARIABLES:
 * - RESEND_API_KEY: Resend API key (SECRET)
 * - EMAIL_FROM: Sender address (e.g. "Synthex <noreply@synthex.social>")
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

// ============================================================================
// PAYMENT RECEIPT
// ============================================================================

/**
 * Send a payment receipt email after a successful charge.
 * Fire-and-forget — does not throw.
 */
export function sendPaymentReceiptEmail(params: {
  email: string;
  name?: string;
  amount: number;      // Amount in cents
  currency: string;    // e.g. "aud"
  plan: string;        // e.g. "Professional"
  billingPortalUrl: string;
}): void {
  const displayAmount = `${params.currency.toUpperCase()} ${(params.amount / 100).toFixed(2)}`;
  const planLabel = params.plan.charAt(0).toUpperCase() + params.plan.slice(1);

  getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: `Payment received — ${planLabel} plan`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment received</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);padding:40px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;">✓ Payment Received</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Synthex</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#ffffff;font-size:18px;">Hi ${params.name ?? 'there'},</p>
              <p style="margin:0 0 20px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                Thank you for your payment. Your subscription has been renewed successfully.
              </p>
              <div style="background:#1a1a1a;border-radius:12px;padding:24px;margin:24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#666666;font-size:14px;padding-bottom:8px;">Amount paid</td>
                    <td align="right" style="color:#10b981;font-size:20px;font-weight:bold;padding-bottom:8px;">${displayAmount}</td>
                  </tr>
                  <tr>
                    <td style="color:#666666;font-size:14px;">Plan</td>
                    <td align="right" style="color:#ffffff;font-size:14px;">${planLabel}</td>
                  </tr>
                </table>
              </div>
              <p style="margin:0 0 30px;color:#a3a3a3;font-size:14px;">
                Your ${planLabel} subscription is now active. You can manage your billing and download invoices at any time.
              </p>
              <div style="text-align:center;">
                <a href="${params.billingPortalUrl}" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;padding:14px 35px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                  Manage Subscription
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#000000;padding:25px;text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">© 2026 Synthex. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }).catch((err: unknown) => console.error('[billing-email] receipt send failed:', err));
}

// ============================================================================
// PAYMENT FAILED
// ============================================================================

/**
 * Send a payment failed alert with a link to update the payment method.
 * Fire-and-forget — does not throw.
 */
export function sendPaymentFailedEmail(params: {
  email: string;
  name?: string;
  amount: number;      // Amount in cents
  currency: string;    // e.g. "aud"
  billingPortalUrl: string;
}): void {
  const displayAmount = `${params.currency.toUpperCase()} ${(params.amount / 100).toFixed(2)}`;

  getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: 'Payment failed — action required',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment failed</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#ef4444 0%,#f59e0b 100%);padding:40px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;">Payment Failed</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Action required to keep your subscription active</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#ffffff;font-size:18px;">Hi ${params.name ?? 'there'},</p>
              <p style="margin:0 0 20px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                We were unable to process your payment of <strong style="color:#ffffff;">${displayAmount}</strong>.
                Your subscription may be interrupted if payment is not updated promptly.
              </p>
              <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:20px;margin:24px 0;">
                <p style="margin:0;color:#fca5a5;font-size:14px;line-height:1.6;">
                  Common causes: expired card, insufficient funds, or bank authorisation required.
                  Please update your payment details to avoid service interruption.
                </p>
              </div>
              <div style="text-align:center;margin-top:32px;">
                <a href="${params.billingPortalUrl}" style="display:inline-block;background:linear-gradient(135deg,#ef4444 0%,#f59e0b 100%);color:#ffffff;padding:14px 35px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                  Update Payment Method
                </a>
              </div>
              <p style="margin:24px 0 0;color:#666666;font-size:13px;text-align:center;">
                If you believe this is an error, please contact us at support@synthex.social.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#000000;padding:25px;text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">© 2026 Synthex. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }).catch((err: unknown) => console.error('[billing-email] failed-payment send failed:', err));
}

// ============================================================================
// SUBSCRIPTION CANCELLED
// ============================================================================

/**
 * Send a subscription cancellation confirmation.
 * Fire-and-forget — does not throw.
 */
export function sendSubscriptionCancelledEmail(params: {
  email: string;
  name?: string;
  plan: string;    // e.g. "Professional"
  endDate: string; // Human-readable date string, e.g. "31 March 2026"
}): void {
  const planLabel = params.plan.charAt(0).toUpperCase() + params.plan.slice(1);

  getResend().emails.send({
    from: FROM,
    to: params.email,
    subject: 'Your Synthex subscription has been cancelled',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription cancelled</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#6b7280 0%,#374151 100%);padding:40px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;">Subscription Cancelled</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Synthex</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#ffffff;font-size:18px;">Hi ${params.name ?? 'there'},</p>
              <p style="margin:0 0 20px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                Your <strong style="color:#ffffff;">${planLabel}</strong> subscription has been cancelled.
              </p>
              <div style="background:#1a1a1a;border-radius:12px;padding:24px;margin:24px 0;">
                <p style="margin:0 0 8px;color:#666666;font-size:14px;">Access continues until</p>
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">${params.endDate}</p>
              </div>
              <p style="margin:0 0 30px;color:#a3a3a3;font-size:14px;line-height:1.6;">
                After this date your account will move to the free plan. Your data will be preserved.
                We'd love to have you back — you can reactivate your subscription at any time.
              </p>
              <div style="text-align:center;">
                <a href="${APP_URL}/pricing" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;padding:14px 35px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                  View Plans
                </a>
              </div>
              <p style="margin:24px 0 0;color:#666666;font-size:13px;text-align:center;">
                Questions? Contact us at support@synthex.social
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#000000;padding:25px;text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">© 2026 Synthex. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }).catch((err: unknown) => console.error('[billing-email] cancellation send failed:', err));
}

// ============================================================================
// WELCOME SEQUENCE — D+0
// ============================================================================

/**
 * Send the immediate welcome email when a user completes onboarding.
 * Fire-and-forget — does not throw.
 */
export function sendWelcomeSequenceDay0(email: string, name?: string): void {
  getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Welcome to Synthex — let\'s get you your first result',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Synthex</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);padding:40px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;">Welcome to Synthex</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Your AI marketing platform is ready</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#ffffff;font-size:18px;">Hi ${name ?? 'there'},</p>
              <p style="margin:0 0 24px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                You're all set! Your Synthex workspace is live. Here are the three things to do first to get real results fast:
              </p>
              <!-- Step 1 -->
              <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:0 0 16px;">
                <div style="display:flex;align-items:flex-start;">
                  <div style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);border-radius:50%;width:32px;height:32px;display:inline-block;text-align:center;line-height:32px;color:#fff;font-weight:bold;font-size:14px;flex-shrink:0;">1</div>
                  <div style="margin-left:16px;">
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Connect a social platform</p>
                    <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">Link Instagram, LinkedIn, or Facebook so Synthex can publish directly on your behalf.</p>
                  </div>
                </div>
              </div>
              <!-- Step 2 -->
              <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:0 0 16px;">
                <div style="display:flex;align-items:flex-start;">
                  <div style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);border-radius:50%;width:32px;height:32px;display:inline-block;text-align:center;line-height:32px;color:#fff;font-weight:bold;font-size:14px;flex-shrink:0;">2</div>
                  <div style="margin-left:16px;">
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Generate your first piece of content</p>
                    <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">Head to the Content Studio and let the AI write a post tailored to your brand voice.</p>
                  </div>
                </div>
              </div>
              <!-- Step 3 -->
              <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin:0 0 32px;">
                <div style="display:flex;align-items:flex-start;">
                  <div style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);border-radius:50%;width:32px;height:32px;display:inline-block;text-align:center;line-height:32px;color:#fff;font-weight:bold;font-size:14px;flex-shrink:0;">3</div>
                  <div style="margin-left:16px;">
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Connect your AI API key</p>
                    <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">Add your OpenRouter key in Settings to use your own model credits and unlock full AI power.</p>
                  </div>
                </div>
              </div>
              <div style="text-align:center;">
                <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;padding:14px 35px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                  Go to Your Dashboard
                </a>
              </div>
              <p style="margin:24px 0 0;color:#666666;font-size:13px;text-align:center;">
                Questions? Reply to this email or reach us at support@synthex.social
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#000000;padding:25px;text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">© 2026 Synthex. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }).catch((err: unknown) => console.error('[welcome-email] day-0 send failed:', err));
}

// ============================================================================
// WELCOME SEQUENCE — D+3
// ============================================================================

/**
 * Send the Day 3 tips email to users who have started the welcome sequence.
 * Fire-and-forget — does not throw.
 */
export function sendWelcomeSequenceDay3(email: string, name?: string): void {
  getResend().emails.send({
    from: FROM,
    to: email,
    subject: '3 things our best users do in their first week',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tips from top Synthex users</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#8b5cf6 0%,#06b6d4 100%);padding:40px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;">3 Days In — Great Start</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Here's what sets top performers apart</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 24px;color:#ffffff;font-size:18px;">Hi ${name ?? 'there'},</p>
              <p style="margin:0 0 24px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                Our most successful users share a few habits in their first week. Here's what's working for them:
              </p>
              <!-- Tip 1 -->
              <div style="background:#1a1a1a;border-left:3px solid #8b5cf6;border-radius:0 12px 12px 0;padding:20px;margin:0 0 16px;">
                <p style="margin:0 0 6px;color:#c4b5fd;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tip 01</p>
                <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Use AI content generation every day</p>
                <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">
                  The Content Studio gets smarter the more you use it. Generate 3–5 posts per session — even if you only publish one. The variety trains the AI to your voice.
                </p>
              </div>
              <!-- Tip 2 -->
              <div style="background:#1a1a1a;border-left:3px solid #06b6d4;border-radius:0 12px 12px 0;padding:20px;margin:0 0 16px;">
                <p style="margin:0 0 6px;color:#67e8f9;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tip 02</p>
                <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Schedule a week of posts in one sitting</p>
                <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">
                  Block 30 minutes on Monday to fill your content calendar for the week. Consistent posting beats sporadic posting every time — and scheduling removes the daily decision fatigue.
                </p>
              </div>
              <!-- Tip 3 -->
              <div style="background:#1a1a1a;border-left:3px solid #10b981;border-radius:0 12px 12px 0;padding:20px;margin:0 0 32px;">
                <p style="margin:0 0 6px;color:#6ee7b7;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tip 03</p>
                <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Check analytics 24 hours after each post</p>
                <p style="margin:0;color:#a3a3a3;font-size:14px;line-height:1.5;">
                  Engagement data after 24 hours tells you what resonates. Use the Analytics tab to spot your best-performing format, then do more of it. Small adjustments compound fast.
                </p>
              </div>
              <div style="text-align:center;">
                <a href="${APP_URL}/dashboard/content" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6 0%,#06b6d4 100%);color:#ffffff;padding:14px 35px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                  Open Content Studio
                </a>
              </div>
              <p style="margin:24px 0 0;color:#666666;font-size:13px;text-align:center;">
                Reply anytime — we read every email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#000000;padding:25px;text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">© 2026 Synthex. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }).catch((err: unknown) => console.error('[welcome-email] day-3 send failed:', err));
}

// ============================================================================
// WELCOME SEQUENCE — D+7
// ============================================================================

/**
 * Send the Day 7 check-in and upgrade nudge email (free/starter users only).
 * Fire-and-forget — does not throw.
 */
export function sendWelcomeSequenceDay7(email: string, name?: string): void {
  getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'How\'s your first week with Synthex going?',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your first week with Synthex</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#0a0a0a 100%);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#3b82f6 100%);padding:40px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:32px;">One Week In</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">You've taken the first step — here's what's next</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#ffffff;font-size:18px;">Hi ${name ?? 'there'},</p>
              <p style="margin:0 0 24px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                It's been a week since you joined Synthex — how's it going? We'd love to know what's been most useful (just reply to this email).
              </p>
              <p style="margin:0 0 24px;color:#a3a3a3;font-size:16px;line-height:1.6;">
                If you're ready to go further, here's what unlocks on Pro:
              </p>
              <!-- Pro features -->
              <div style="background:#1a1a1a;border-radius:12px;padding:24px;margin:0 0 32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
                      <span style="color:#10b981;font-size:16px;margin-right:10px;">&#10003;</span>
                      <span style="color:#ffffff;font-size:14px;">Unlimited AI content generation</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
                      <span style="color:#10b981;font-size:16px;margin-right:10px;">&#10003;</span>
                      <span style="color:#ffffff;font-size:14px;">Advanced analytics &amp; competitor tracking</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
                      <span style="color:#10b981;font-size:16px;margin-right:10px;">&#10003;</span>
                      <span style="color:#ffffff;font-size:14px;">All 9 social platform integrations</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
                      <span style="color:#10b981;font-size:16px;margin-right:10px;">&#10003;</span>
                      <span style="color:#ffffff;font-size:14px;">A/B testing for content variants</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="color:#10b981;font-size:16px;margin-right:10px;">&#10003;</span>
                      <span style="color:#ffffff;font-size:14px;">Priority email support</span>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="text-align:center;margin-bottom:16px;">
                <a href="${APP_URL}/pricing" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#3b82f6 100%);color:#ffffff;padding:14px 35px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                  View Pro Plans
                </a>
              </div>
              <p style="margin:0;color:#666666;font-size:13px;text-align:center;">
                Not ready yet? No worries — your free plan is always here. Just reply if you have questions.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#000000;padding:25px;text-align:center;">
              <p style="margin:0;color:#666666;font-size:12px;">© 2026 Synthex. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }).catch((err: unknown) => console.error('[welcome-email] day-7 send failed:', err));
}
