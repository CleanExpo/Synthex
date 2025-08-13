import nodemailer from 'nodemailer';

type MailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

function getBooleanEnv(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

/**
 * Create a reusable mail transporter based on environment configuration.
 * Currently supports SMTP when EMAIL_PROVIDER=smtp and SMTP_* are set.
 */
export function createTransport() {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  if (provider === 'smtp') {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error('SMTP is selected but SMTP_HOST/SMTP_USER/SMTP_PASS are not fully configured.');
    }

    const secure = getBooleanEnv('SMTP_SECURE', port === 465);

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  // Extend here for other providers (sendgrid, gmail) if needed
  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

/**
 * Send an email using the configured provider.
 */
export async function sendEmail(opts: MailOptions) {
  const from = process.env.EMAIL_FROM || 'no-reply@example.com';
  const transporter = createTransport();

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  return info;
}

/**
 * Convenience helper to send a team invitation email.
 */
export async function sendTeamInviteEmail(params: {
  to: string;
  role: string;
  message?: string;
  inviterName?: string;
  appUrl?: string;
}) {
  const { to, role, message, inviterName, appUrl } = params;
  const subject = `You're invited to join the team${inviterName ? ' by ' + inviterName : ''}`;
  const safeAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.6;">
      <h2>You have been invited to join the team</h2>
      <p>Role: <strong>${role}</strong></p>
      ${message ? `<p style="white-space: pre-wrap;">Message: ${escapeHtml(message)}</p>` : ''}
      <p>Please click the link below to accept:</p>
      <p><a href="${safeAppUrl}" style="color: #4f46e5; text-decoration: none;">Open Synthex</a></p>
      <hr />
      <p style="font-size: 12px; color: #6b7280;">If you did not expect this email, you can ignore it.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `You have been invited to join the team as ${role}. ${message ? `Message: ${message}\n` : ''}Open: ${safeAppUrl}`,
  });
}

function escapeHtml(s?: string) {
  if (!s) return '';
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}
