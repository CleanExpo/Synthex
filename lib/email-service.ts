/**
 * Email Notification Service
 * Handles all email communications
 */

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

interface EmailOptions {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  variables?: Record<string, unknown>;
}

/** Welcome email template variables */
interface WelcomeTemplateVariables {
  name?: string;
  dashboardUrl?: string;
}

/** Password reset template variables */
interface PasswordResetTemplateVariables {
  name?: string;
  resetUrl: string;
  code?: string;
}

/** Notification template variables */
interface NotificationTemplateVariables {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  subject?: string;
  message: string;
  actionUrl?: string;
}

/** Weekly report template variables */
interface WeeklyReportTemplateVariables {
  weekOf: string;
  postsPublished?: number;
  totalReach?: number;
  engagement?: number;
  topPosts?: Array<{ title: string; engagement: number }>;
  dashboardUrl?: string;
}

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

class EmailService {
  private defaultFrom = 'SYNTHEX <noreply@synthex.ai>';
  
  /**
   * Email templates
   */
  private templates = {
    welcome: (variables: WelcomeTemplateVariables): EmailTemplate => ({
      subject: 'Welcome to SYNTHEX! 🚀',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to SYNTHEX, ${escapeHtml(variables.name || 'Friend')}! 🎉</h1>
              </div>
              <div class="content">
                <p>We're excited to have you on board!</p>
                <p>SYNTHEX is your AI-powered marketing platform that helps you create, schedule, and optimize content across all social media platforms.</p>
                <h3>Get Started:</h3>
                <ul>
                  <li>Connect your social media accounts</li>
                  <li>Create your first AI-generated post</li>
                  <li>Schedule content for the week</li>
                  <li>Track your performance</li>
                </ul>
                <a href="${variables.dashboardUrl || 'https://synthex.ai/dashboard'}" class="button">Go to Dashboard</a>
                <p>If you have any questions, feel free to reach out to our support team.</p>
                <p>Best regards,<br>The SYNTHEX Team</p>
              </div>
              <div class="footer">
                <p>© 2025 SYNTHEX. All rights reserved.</p>
                <p>You received this email because you signed up for SYNTHEX.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Welcome to SYNTHEX, ${variables.name || 'Friend'}! We're excited to have you on board.`
    }),

    passwordReset: (variables: PasswordResetTemplateVariables): EmailTemplate => ({
      subject: 'Reset Your SYNTHEX Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1a1a1a; color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .code { background: #e1e1e1; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 18px; letter-spacing: 2px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hi ${escapeHtml(variables.name || 'there')},</p>
                <p>We received a request to reset your SYNTHEX password. Click the button below to create a new password:</p>
                <a href="${variables.resetUrl}" class="button">Reset Password</a>
                <p>Or use this code:</p>
                <div class="code">${variables.code || 'XXXXXX'}</div>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>Best regards,<br>The SYNTHEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Reset your SYNTHEX password using this link: ${variables.resetUrl}`
    }),

    notification: (variables: NotificationTemplateVariables): EmailTemplate => ({
      subject: variables.subject || 'SYNTHEX Notification',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .alert { padding: 15px; border-radius: 5px; margin: 20px 0; }
              .alert-info { background: #e3f2fd; color: #1976d2; border-left: 4px solid #1976d2; }
              .alert-success { background: #e8f5e9; color: #388e3c; border-left: 4px solid #388e3c; }
              .alert-warning { background: #fff3e0; color: #f57c00; border-left: 4px solid #f57c00; }
              .alert-error { background: #ffebee; color: #c62828; border-left: 4px solid #c62828; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="alert alert-${variables.type || 'info'}">
                <h3>${variables.title || 'Notification'}</h3>
                <p>${variables.message}</p>
              </div>
              ${variables.actionUrl ? `<a href="${variables.actionUrl}" style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">View Details</a>` : ''}
            </div>
          </body>
        </html>
      `,
      text: `${variables.title || 'Notification'}: ${variables.message}`
    }),

    weeklyReport: (variables: WeeklyReportTemplateVariables): EmailTemplate => ({
      subject: `Your SYNTHEX Weekly Report - ${variables.weekOf}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
              .stats { display: flex; justify-content: space-around; margin: 30px 0; }
              .stat { text-align: center; }
              .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
              .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Your Weekly Performance</h1>
                <p>Week of ${variables.weekOf}</p>
              </div>
              <div class="stats">
                <div class="stat">
                  <div class="stat-value">${variables.postsPublished || 0}</div>
                  <div class="stat-label">Posts Published</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${variables.totalReach || 0}</div>
                  <div class="stat-label">Total Reach</div>
                </div>
                <div class="stat">
                  <div class="stat-value">${variables.engagement || 0}%</div>
                  <div class="stat-label">Engagement Rate</div>
                </div>
              </div>
              <h3>Top Performing Posts:</h3>
              <ul>
                ${(variables.topPosts || []).map((post) => `<li>${post.title} - ${post.engagement} engagements</li>`).join('')}
              </ul>
              <p><a href="${variables.dashboardUrl || 'https://synthex.ai/dashboard'}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px;">View Full Report</a></p>
            </div>
          </body>
        </html>
      `,
      text: `Your weekly SYNTHEX report for ${variables.weekOf}`
    })
  };

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<boolean> {
    try {
      // Get template if specified
      let emailContent: EmailTemplate;
      
      if (options.template && options.variables) {
        const templateFn = this.templates[options.template as keyof typeof this.templates];
        if (templateFn) {
          // Type assertion needed as variables come from user input
          emailContent = (templateFn as (vars: Record<string, unknown>) => EmailTemplate)(options.variables);
        } else {
          emailContent = {
            subject: options.subject,
            html: options.html || '',
            text: options.text
          };
        }
      } else {
        emailContent = {
          subject: options.subject,
          html: options.html || '',
          text: options.text
        };
      }

      // In production, integrate with email service (SendGrid, AWS SES, etc.)
      const emailData = {
        to: options.to,
        from: options.from || this.defaultFrom,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text || this.extractText(emailContent.html)
      };

      // Email queued for delivery

      // In production:
      // await sendgrid.send(emailData);
      // or
      // await ses.sendEmail(emailData);

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    return this.send({
      to: email,
      template: 'welcome',
      subject: 'Welcome to SYNTHEX!',
      variables: {
        name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      }
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetUrl: string, code?: string): Promise<boolean> {
    return this.send({
      to: email,
      template: 'passwordReset',
      subject: 'Reset Your Password',
      variables: {
        resetUrl,
        code
      }
    });
  }

  /**
   * Send notification email
   */
  async sendNotification(email: string, notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    actionUrl?: string;
  }): Promise<boolean> {
    return this.send({
      to: email,
      template: 'notification',
      subject: notification.title,
      variables: notification
    });
  }

  /**
   * Send weekly report
   */
  async sendWeeklyReport(email: string, reportData: WeeklyReportTemplateVariables): Promise<boolean> {
    return this.send({
      to: email,
      template: 'weeklyReport',
      subject: `Your SYNTHEX Weekly Report`,
      variables: reportData as unknown as Record<string, unknown>
    });
  }

  /**
   * Extract plain text from HTML
   */
  private extractText(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Batch send emails
   */
  async sendBatch(emails: EmailOptions[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      const success = await this.send(email);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { sent, failed };
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export types
export type { EmailOptions, EmailTemplate };