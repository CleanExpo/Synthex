/**
 * Visibility Push Email — SYN-477
 *
 * Weekly Monday morning email to org owners showing their Visibility Score,
 * delta vs last week, and a single recommended action to improve it.
 *
 * Fire-and-forget — does not throw.
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

export type VisibilityComponent = 'reviews' | 'gbp' | 'content' | 'rankings';

const ACTION_TEXT: Record<VisibilityComponent, string> = {
  reviews:
    'You have room to grow your review count. Use the Review Request tool to send a personalised request to your 3 most recent customers.',
  gbp: 'Your Google Business Profile is missing key details. Complete your business description, add your service hours, and upload at least 3 photos.',
  content:
    "You haven't published content this week. Generate a local authority article targeting your primary suburb to boost your content score.",
  rankings:
    'Add your top 3 target keywords in the Rankings dashboard so Synthex can track your progress and surface content opportunities.',
};

const COMPONENT_LABEL: Record<VisibilityComponent, string> = {
  reviews: 'Reviews',
  gbp: 'Google Business Profile',
  content: 'Content',
  rankings: 'Keyword Rankings',
};

function scoreColour(score: number): string {
  if (score >= 70) return '#22c55e'; // green
  if (score >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function deltaLabel(delta: number): string {
  if (delta > 0) return `▲ ${delta} pts vs last week`;
  if (delta < 0) return `▼ ${Math.abs(delta)} pts vs last week`;
  return '→ No change vs last week';
}

function deltaBadgeColour(delta: number): string {
  if (delta > 0) return '#22c55e';
  if (delta < 0) return '#ef4444';
  return '#6b7280';
}

function buildHtml(params: {
  orgName: string;
  score: number;
  delta: number;
  weakestComponent: VisibilityComponent;
  dashboardUrl: string;
}): string {
  const { orgName, score, delta, weakestComponent, dashboardUrl } = params;
  const colour = scoreColour(score);
  const dLabel = deltaLabel(delta);
  const dColour = deltaBadgeColour(delta);
  const actionText = ACTION_TEXT[weakestComponent];
  const componentLabel = COMPONENT_LABEL[weakestComponent];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Weekly Visibility Score</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">Weekly Report</p>
              <h1 style="margin:8px 0 4px;font-size:24px;font-weight:700;color:#ffffff;">Visibility Score</h1>
              <p style="margin:0;font-size:15px;color:#9ca3af;">${orgName}</p>
            </td>
          </tr>

          <!-- Score gauge -->
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <div style="display:inline-block;position:relative;">
                <svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="80" cy="80" r="68" fill="none" stroke="#2a2a2a" stroke-width="12"/>
                  <circle cx="80" cy="80" r="68" fill="none" stroke="${colour}" stroke-width="12"
                    stroke-dasharray="${(score / 100) * 427} 427"
                    stroke-dashoffset="107"
                    stroke-linecap="round"
                    transform="rotate(-90 80 80)"/>
                  <text x="80" y="74" text-anchor="middle" font-size="42" font-weight="700" fill="${colour}" font-family="-apple-system,sans-serif">${score}</text>
                  <text x="80" y="98" text-anchor="middle" font-size="13" fill="#6b7280" font-family="-apple-system,sans-serif">out of 100</text>
                </svg>
              </div>
              <p style="margin:16px 0 0;font-size:14px;font-weight:600;color:${dColour};">${dLabel}</p>
            </td>
          </tr>

          <!-- Recommended action -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:24px;">
                <p style="margin:0 0 8px;font-size:11px;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase;">Top Opportunity · ${componentLabel}</p>
                <p style="margin:0 0 20px;font-size:15px;color:#e5e7eb;line-height:1.6;">${actionText}</p>
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
                  Open Dashboard →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#4b5563;">
                This email was sent by <a href="${APP_URL}" style="color:#7c3aed;text-decoration:none;">Synthex</a>.
                You're receiving this because you're an account owner.
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

/**
 * Send the weekly Visibility Push email.
 * Fire-and-forget — does not throw.
 */
export function sendVisibilityPushEmail(params: {
  email: string;
  orgName: string;
  score: number;
  delta: number;
  weakestComponent: VisibilityComponent;
  dashboardUrl: string;
}): void {
  const html = buildHtml(params);

  getResend()
    .emails.send({
      from: FROM,
      to: params.email,
      subject: `Your Visibility Score this week: ${params.score}/100`,
      html,
    })
    .catch((err: unknown) => {
      console.error('[visibility-push-email] send failed', {
        email: params.email,
        error: err,
      });
    });
}
