import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import AuditService from './audit';

const prisma = new PrismaClient();

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  attachments?: any[];
}

interface NotificationEmailData {
  userId: string;
  type: 'campaign_completed' | 'post_published' | 'post_failed' | 'system_alert' | 'security_alert' | 'welcome' | 'password_reset' | '2fa_enabled';
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
      
      if (emailProvider === 'smtp') {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else if (emailProvider === 'sendgrid') {
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      } else if (emailProvider === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });
      }

      if (this.transporter) {
        // Verify connection
        await this.transporter.verify();
        this.initialized = true;
        console.log('Email service initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.initialized = false;
    }
  }

  /**
   * Send a basic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.initialized || !this.transporter) {
      console.warn('Email service not initialized');
      return false;
    }

    try {
      const mailOptions = {
        from: options.from || process.env.EMAIL_FROM || 'support@synthex.social',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send notification email based on type
   */
  async sendNotificationEmail(emailData: NotificationEmailData): Promise<boolean> {
    try {
      // Get user email and preferences
      const user = await prisma.user.findUnique({
        where: { id: emailData.userId },
        select: {
          email: true,
          name: true,
          preferences: true
        }
      });

      if (!user) {
        console.error('User not found for email notification');
        return false;
      }

      // Check if user has email notifications enabled
      const preferences = user.preferences as any;
      if (preferences?.emailNotifications === false) {
        console.log('Email notifications disabled for user');
        return false;
      }

      const emailContent = this.generateEmailContent(emailData.type, {
        userName: user.name || 'User',
        ...emailData.data
      });

      const success = await this.sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      // Log email attempt
      await AuditService.log({
        userId: emailData.userId,
        action: 'email_sent',
        resource: 'notification',
        details: {
          type: emailData.type,
          priority: emailData.priority,
          success,
          recipient: user.email
        },
        severity: emailData.priority === 'critical' ? 'high' : 'low',
        category: 'system',
        outcome: success ? 'success' : 'failure'
      });

      return success;
    } catch (error) {
      console.error('Error sending notification email:', error);
      return false;
    }
  }

  /**
   * Generate email content based on notification type
   */
  private generateEmailContent(type: NotificationEmailData['type'], data: any) {
    const baseUrl = process.env.FRONTEND_URL || 'https://synthex-a3f0o7y9q-unite-group.vercel.app';
    
    switch (type) {
      case 'welcome':
        return {
          subject: '🎉 Welcome to SYNTHEX - Your AI Marketing Platform',
          html: this.getWelcomeEmailHtml(data, baseUrl),
          text: `Welcome to SYNTHEX, ${data.userName}! Start creating amazing content with AI.`
        };

      case 'campaign_completed':
        return {
          subject: '✅ Campaign Completed - SYNTHEX',
          html: this.getCampaignCompletedHtml(data, baseUrl),
          text: `Your campaign "${data.campaignName}" has completed successfully.`
        };

      case 'post_published':
        return {
          subject: '🚀 Post Published - SYNTHEX',
          html: this.getPostPublishedHtml(data, baseUrl),
          text: `Your post has been published successfully on ${data.platform}.`
        };

      case 'post_failed':
        return {
          subject: '❌ Post Publishing Failed - SYNTHEX',
          html: this.getPostFailedHtml(data, baseUrl),
          text: `Your post failed to publish on ${data.platform}. Error: ${data.error}`
        };

      case 'security_alert':
        return {
          subject: '🔒 Security Alert - SYNTHEX',
          html: this.getSecurityAlertHtml(data, baseUrl),
          text: `Security alert: ${data.message}. Please check your account.`
        };

      case '2fa_enabled':
        return {
          subject: '🔐 Two-Factor Authentication Enabled - SYNTHEX',
          html: this.get2FAEnabledHtml(data, baseUrl),
          text: 'Two-factor authentication has been enabled for your account.'
        };

      case 'password_reset':
        return {
          subject: '🔑 Password Reset - SYNTHEX',
          html: this.getPasswordResetHtml(data, baseUrl),
          text: `Reset your password using this link: ${baseUrl}/reset-password?token=${data.token}`
        };

      case 'system_alert':
        return {
          subject: '⚠️ System Alert - SYNTHEX',
          html: this.getSystemAlertHtml(data, baseUrl),
          text: `System alert: ${data.message}`
        };

      default:
        return {
          subject: '📧 SYNTHEX Notification',
          html: `<p>Hello ${data.userName},</p><p>You have a new notification from SYNTHEX.</p>`,
          text: `Hello ${data.userName}, you have a new notification from SYNTHEX.`
        };
    }
  }

  private getWelcomeEmailHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to SYNTHEX</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: white; padding: 40px 20px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to SYNTHEX</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.userName}!</h2>
            <p>Welcome to SYNTHEX, your AI-powered marketing automation platform! We're excited to have you on board.</p>
            
            <h3>🚀 What you can do with SYNTHEX:</h3>
            <ul>
              <li><strong>AI Content Generation:</strong> Create engaging content with advanced AI</li>
              <li><strong>Multi-Platform Publishing:</strong> Publish to Twitter, LinkedIn, and more</li>
              <li><strong>Performance Analytics:</strong> Track your content performance</li>
              <li><strong>Team Collaboration:</strong> Work together with your team</li>
              <li><strong>Workflow Automation:</strong> Automate your marketing workflows</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${baseUrl}/dashboard" class="button">Get Started Now</a>
            </div>
            
            <p>If you have any questions, our support team is here to help at <a href="mailto:support@synthex.social">support@synthex.social</a></p>
            
            <p>Happy marketing!<br>The SYNTHEX Team</p>
          </div>
          <div class="footer">
            <p>© 2024 SYNTHEX. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getCampaignCompletedHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .success { color: #28a745; font-size: 24px; text-align: center; margin: 20px 0; }
          .stats { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅ Campaign Completed Successfully!</div>
          
          <h2>Hello ${data.userName}!</h2>
          <p>Great news! Your campaign "<strong>${data.campaignName}</strong>" has completed successfully.</p>
          
          <div class="stats">
            <h3>📊 Campaign Results:</h3>
            <ul>
              <li>Posts Published: <strong>${data.postsPublished || 0}</strong></li>
              <li>Total Reach: <strong>${data.totalReach || 'N/A'}</strong></li>
              <li>Engagement Rate: <strong>${data.engagementRate || 'N/A'}</strong></li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${baseUrl}/campaigns/${data.campaignId}" class="button">View Full Report</a>
          </div>
          
          <p>Thanks for using SYNTHEX!</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPostPublishedHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>🚀 Post Published Successfully!</h2>
          <p>Hello ${data.userName}!</p>
          <p>Your post has been published successfully on <strong>${data.platform}</strong>.</p>
          ${data.postUrl ? `<p><a href="${data.postUrl}" target="_blank">View Post</a></p>` : ''}
          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/dashboard" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPostFailedHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc3545;">❌ Post Publishing Failed</h2>
          <p>Hello ${data.userName}!</p>
          <p>Unfortunately, your post failed to publish on <strong>${data.platform}</strong>.</p>
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Error:</strong> ${data.error}
          </div>
          <p>Please check your platform connection and try again.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/schedule" style="display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Retry Publishing</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getSecurityAlertHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ffc107;">🔒 Security Alert</h2>
          <p>Hello ${data.userName}!</p>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Alert:</strong> ${data.message}
          </div>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>IP Address:</strong> ${data.ipAddress || 'Unknown'}</p>
          <p>If this wasn't you, please secure your account immediately.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/profile/security" style="display: inline-block; background: #ffc107; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Review Security</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private get2FAEnabledHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #28a745;">🔐 Two-Factor Authentication Enabled</h2>
          <p>Hello ${data.userName}!</p>
          <p>Two-factor authentication has been successfully enabled for your SYNTHEX account.</p>
          <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>✅ Your account is now more secure!</strong></p>
            <p>You'll need your authenticator app to log in from now on.</p>
          </div>
          <p>Keep your backup codes in a safe place in case you lose access to your authenticator app.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>🔑 Password Reset Request</h2>
          <p>Hello ${data.userName}!</p>
          <p>You requested a password reset for your SYNTHEX account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/reset-password?token=${data.token}" style="display: inline-block; background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">Reset Password</a>
          </div>
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If you didn't request this reset, please ignore this email or contact support.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getSystemAlertHtml(data: any, baseUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ff6b6b;">⚠️ System Alert</h2>
          <p>Hello ${data.userName}!</p>
          <div style="background: #ffebee; border: 1px solid #ffcdd2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>System Alert:</strong> ${data.message}
          </div>
          <p>Please check your dashboard for more details.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${baseUrl}/dashboard" style="display: inline-block; background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailOptions[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      const success = await this.sendEmail(email);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Add small delay to avoid overwhelming the email server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { sent, failed };
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  /**
   * Get email service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      provider: process.env.EMAIL_PROVIDER || 'none',
      configured: !!this.transporter
    };
  }
}

const emailService = new EmailService();
export default emailService;
