/**
 * Milestone Notification Emails — SYN-675
 *
 * Three transactional emails sent when a client crosses a usage milestone:
 *   posts_100        — 100th post published
 *   anniversary_1yr  — 1 year since onboarding
 *   local_views_1000 — 1,000 total content views
 *
 * Design principle (Custom Oracle rule):
 *   Every metric is followed by a plain-English "which means" sentence
 *   so clients immediately understand the significance.
 *
 * Uses Resend singleton pattern consistent with all other Synthex emails.
 * Returns { success, error? } — never throws.
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM    = process.env.EMAIL_FROM    ?? 'Synthex <noreply@synthex.social>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthex.social';

export type MilestoneType = 'posts_100' | 'anniversary_1yr' | 'local_views_1000';

export interface MilestoneNotificationEmailParams {
  to:              string;
  businessName:    string;
  milestoneType:   MilestoneType;
  /** posts_100: total posts count */
  postCount?:      number;
  /** anniversary_1yr: join date formatted as "April 2025" */
  joinDateLabel?:  string;
  /** local_views_1000: total reach count */
  totalReach?:     number;
  dashboardUrl?:   string;
}

// ── Shared layout wrappers ────────────────────────────────────────────────────

function emailWrapper(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
          style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Header bar -->
          <tr>
            <td style="background:#0f172a;padding:24px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                Synthex
              </p>
            </td>
          </tr>

          <!-- Body -->
          ${body}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
                Synthex · AI-Powered Local Marketing ·
                <a href="${APP_URL}/dashboard/settings" style="color:#9ca3af;">Manage preferences</a>
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

function statCard(value: string, label: string, accent: string = '#0f172a'): string {
  return `
    <td style="text-align:center;padding:20px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <p style="margin:0;font-size:28px;font-weight:700;color:${accent};">${value}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
    </td>`;
}

function cta(label: string, url: string): string {
  return `
    <tr>
      <td style="padding:0 32px 32px;">
        <a href="${url}"
          style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:13px;font-weight:500;">
          ${label}
        </a>
      </td>
    </tr>`;
}

// ── Template: posts_100 ───────────────────────────────────────────────────────

function buildPosts100Body(
  businessName: string,
  postCount: number,
  dashboardUrl: string
): string {
  const countLabel = postCount >= 100 ? postCount.toLocaleString('en-AU') : '100+';

  return emailWrapper(
    `You've published ${countLabel} posts — a major milestone`,
    `
          <!-- Hero -->
          <tr>
            <td style="padding:40px 32px 24px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:500;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">
                Milestone unlocked
              </p>
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#0f172a;line-height:1.2;">
                ${countLabel} posts published, ${businessName}.
              </h1>
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
                You've just crossed a milestone most local businesses never reach —
                which means your brand now has a consistent publishing record that
                search engines and AI tools treat as a signal of authority.
              </p>
            </td>
          </tr>

          <!-- Stat -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  ${statCard(countLabel, 'Posts Published', '#6366f1')}
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
                Which means: you have ${countLabel} pieces of content working for you 24/7 — each one a
                potential entry point for a new customer finding you through Google or AI search.
              </p>
            </td>
          </tr>

          <!-- What's next -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">
                What this means for your GEO score
              </h2>
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                Volume is one of the three signals AI tools use when deciding whether to cite
                a local business. With 100+ posts, your content library is now large enough
                for Synthex to start identifying your highest-performing formats and doubling
                down on them.
              </p>
            </td>
          </tr>

          ${cta('See your content dashboard', dashboardUrl)}
    `
  );
}

// ── Template: anniversary_1yr ─────────────────────────────────────────────────

function buildAnniversaryBody(
  businessName: string,
  joinDateLabel: string,
  dashboardUrl: string
): string {
  return emailWrapper(
    `One year of Synthex — here's what you've built`,
    `
          <!-- Hero -->
          <tr>
            <td style="padding:40px 32px 24px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:500;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">
                Happy anniversary
              </p>
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#0f172a;line-height:1.2;">
                One year of consistent local marketing, ${businessName}.
              </h1>
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
                Since you joined Synthex in ${joinDateLabel}, your business has been showing up
                consistently online — which means you've built the kind of long-term digital
                presence that compounds over time and is very hard for competitors to replicate quickly.
              </p>
            </td>
          </tr>

          <!-- Stats row -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  ${statCard('1 Year', 'With Synthex', '#f59e0b')}
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
                Which means: 12 months of AI-generated content, automated publishing, and
                consistent brand presence — building authority that search engines and AI
                tools recognise.
              </p>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">
                The compounding advantage
              </h2>
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">
                Most local businesses give up on content after a few months. You didn't.
                That consistency is what separates businesses that get found from those
                that stay invisible. Your second year starts now — and the data you've
                built will make it even more targeted.
              </p>
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                Thank you for trusting Synthex to be part of your growth.
              </p>
            </td>
          </tr>

          ${cta('See your year in review', dashboardUrl)}
    `
  );
}

// ── Template: local_views_1000 ────────────────────────────────────────────────

function buildViews1000Body(
  businessName: string,
  totalReach: number,
  dashboardUrl: string
): string {
  const reachLabel = totalReach.toLocaleString('en-AU');

  return emailWrapper(
    `Your content has reached ${reachLabel} people`,
    `
          <!-- Hero -->
          <tr>
            <td style="padding:40px 32px 24px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:500;color:#10b981;text-transform:uppercase;letter-spacing:1px;">
                Reach milestone
              </p>
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#0f172a;line-height:1.2;">
                ${reachLabel} people have seen your content, ${businessName}.
              </h1>
              <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6;">
                Your posts have now reached ${reachLabel} people — which means your business
                is no longer invisible locally. Real potential customers are seeing your
                brand in their feeds.
              </p>
            </td>
          </tr>

          <!-- Stat -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  ${statCard(reachLabel, 'Total Reach', '#10b981')}
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
                Which means: you've already started converting local visibility into
                brand awareness. The next milestone is 10,000 — and Synthex is building
                the content strategy to get you there.
              </p>
            </td>
          </tr>

          <!-- What's next -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">
                What drives reach
              </h2>
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                Synthex analyses which of your posts generated the most reach and
                automatically creates more content in those formats. The more you publish,
                the smarter the system gets about your audience.
              </p>
            </td>
          </tr>

          ${cta('See your top-performing content', dashboardUrl)}
    `
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendMilestoneNotificationEmail(
  params: MilestoneNotificationEmailParams
): Promise<{ success: boolean; error?: string }> {
  const dashboardUrl = params.dashboardUrl ?? `${APP_URL}/dashboard`;

  let subject: string;
  let html: string;

  switch (params.milestoneType) {
    case 'posts_100': {
      const count = params.postCount ?? 100;
      subject = `You've published ${count >= 100 ? count.toLocaleString('en-AU') : '100+'} posts — a major milestone`;
      html    = buildPosts100Body(params.businessName, count, dashboardUrl);
      break;
    }
    case 'anniversary_1yr': {
      const joinDate = params.joinDateLabel ?? 'last year';
      subject = `One year of Synthex — here's what you've built, ${params.businessName}`;
      html    = buildAnniversaryBody(params.businessName, joinDate, dashboardUrl);
      break;
    }
    case 'local_views_1000': {
      const reach = params.totalReach ?? 1000;
      subject = `Your content has reached ${reach.toLocaleString('en-AU')} people`;
      html    = buildViews1000Body(params.businessName, reach, dashboardUrl);
      break;
    }
    default:
      return { success: false, error: `Unknown milestone type: ${params.milestoneType}` };
  }

  try {
    const { error } = await getResend().emails.send({
      from:    FROM,
      to:      params.to,
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
