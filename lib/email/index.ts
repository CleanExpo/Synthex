/**
 * Unified Email Service for SYNTHEX Platform
 *
 * @description Production-ready email service with:
 * - Multiple provider support (SendGrid, Resend)
 * - Async queue processing with BullMQ
 * - Automatic retries with exponential backoff
 * - Bounce/complaint handling via webhooks
 * - Delivery tracking
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - EMAIL_PROVIDER: 'sendgrid' | 'resend' (default: 'sendgrid')
 * - SENDGRID_API_KEY: SendGrid API key (SECRET)
 * - RESEND_API_KEY: Resend API key (SECRET)
 * - REDIS_URL: Redis connection URL for queue (optional, falls back to in-memory)
 * - EMAIL_FROM: Sender email address
 * - EMAIL_FROM_NAME: Sender display name
 * - NEXT_PUBLIC_APP_URL: App URL for email links
 *
 * FAILURE MODE: Falls back to in-memory queue if Redis unavailable
 */

import { emailQueue, EmailJob, EmailType } from './queue';
import prisma from '@/lib/prisma';
import * as crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const EMAIL_CONFIG = {
  provider: (process.env.EMAIL_PROVIDER || 'sendgrid') as 'sendgrid' | 'resend',
  from: process.env.EMAIL_FROM || 'noreply@synthex.social',
  fromName: process.env.EMAIL_FROM_NAME || 'SYNTHEX',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

// ============================================================================
// EMAIL SERVICE CLASS
// ============================================================================

class UnifiedEmailService {
  /**
   * Send email via queue (recommended for production)
   */
  async send(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    type?: EmailType;
    userId?: string;
    replyTo?: string;
  }): Promise<string> {
    return emailQueue.enqueue({
      to: options.to,
      from: EMAIL_CONFIG.from,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      metadata: {
        userId: options.userId,
        type: options.type || 'transactional',
      },
    });
  }

  /**
   * Send email immediately (bypasses queue)
   */
  async sendImmediate(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    type?: EmailType;
    userId?: string;
  }): Promise<string> {
    return emailQueue.sendImmediate({
      to: options.to,
      from: EMAIL_CONFIG.from,
      subject: options.subject,
      html: options.html,
      text: options.text,
      metadata: {
        userId: options.userId,
        type: options.type || 'transactional',
      },
    });
  }

  // ============================================================================
  // VERIFICATION EMAILS
  // ============================================================================

  /**
   * Send email verification email
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
    name?: string
  ): Promise<string> {
    // Generate verification code
    const verificationCode = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save to database
    await prisma.user.update({
      where: { id: userId },
      data: {
        verificationCode,
        verificationExpires,
      },
    });

    const verificationUrl = `${EMAIL_CONFIG.appUrl}/auth/verify-email?code=${verificationCode}`;

    return this.send({
      to: email,
      subject: 'Verify your SYNTHEX account',
      html: this.getVerificationTemplate(name || 'there', verificationUrl),
      type: 'verification',
      userId,
    });
  }

  /**
   * Verify email with code
   */
  async verifyEmail(
    code: string
  ): Promise<{ success: boolean; userId?: string; message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        verificationCode: code,
        verificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return { success: false, message: 'Invalid or expired verification code' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Database expects Boolean for emailVerified
        emailVerified: true,
        verificationCode: null,
        verificationExpires: null,
      },
    });

    // Send welcome email
    await this.sendWelcomeEmail(user.email, user.name || undefined);

    return { success: true, userId: user.id, message: 'Email verified successfully' };
  }

  // ============================================================================
  // PASSWORD RESET EMAILS
  // ============================================================================

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    userId: string,
    email: string,
    name?: string
  ): Promise<string> {
    // Generate reset token and OTP
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save to database
    await prisma.user.update({
      where: { id: userId },
      data: {
        resetToken,
        resetCode,
        resetTokenExpires: resetExpires,
        resetCodeExpires: resetExpires,
      },
    });

    const resetUrl = `${EMAIL_CONFIG.appUrl}/auth/reset-password?token=${resetToken}`;

    return this.send({
      to: email,
      subject: 'Reset your SYNTHEX password',
      html: this.getPasswordResetTemplate(name || 'there', resetUrl, resetCode),
      type: 'password_reset',
      userId,
    });
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    return user ? { valid: true, userId: user.id } : { valid: false };
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateResetToken(token);

    if (!validation.valid || !validation.userId) {
      return { success: false, message: 'Invalid or expired reset token' };
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: validation.userId },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
        resetCode: null,
        resetCodeExpires: null,
      },
    });

    return { success: true, message: 'Password reset successfully' };
  }

  // ============================================================================
  // WELCOME & NOTIFICATION EMAILS
  // ============================================================================

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<string> {
    return this.send({
      to: email,
      subject: 'Welcome to SYNTHEX - Your AI Marketing Platform',
      html: this.getWelcomeTemplate(name || 'there'),
      type: 'welcome',
    });
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    email: string,
    subject: string,
    message: string,
    userId?: string
  ): Promise<string> {
    return this.send({
      to: email,
      subject,
      html: this.getNotificationTemplate(subject, message),
      type: 'notification',
      userId,
    });
  }

  // ============================================================================
  // STATUS & UTILITIES
  // ============================================================================

  /**
   * Get email delivery status
   */
  async getDeliveryStatus(emailId: string) {
    return emailQueue.getStatus(emailId);
  }

  /**
   * Retry failed email
   */
  async retryEmail(emailId: string): Promise<boolean> {
    return emailQueue.retry(emailId);
  }

  /**
   * Check if user's email is valid for sending
   */
  async canSendTo(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { preferences: true },
    });

    if (!user) return true; // Unknown email, allow

    const prefs = user.preferences as Record<string, unknown> | null;
    const emailStatus = prefs?.emailStatus as Record<string, unknown> | undefined;

    if (!emailStatus) return true;

    const status = emailStatus.status as string;
    return !['invalid', 'unsubscribed'].includes(status);
  }

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  private getVerificationTemplate(name: string, url: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%); border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px;">✨ SYNTHEX</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Verify Your Email</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">Hi ${name}!</h2>
              <p style="margin: 0 0 30px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                Thanks for signing up for SYNTHEX! Please verify your email address by clicking the button below.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Verify Email Address
                </a>
              </div>
              <p style="margin: 30px 0 10px; color: #666666; font-size: 14px;">Or copy this link:</p>
              <p style="margin: 0; background: #1a1a1a; padding: 15px; border-radius: 8px; word-break: break-all; color: #06b6d4; font-size: 13px;">
                ${url}
              </p>
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px;">
                This link expires in 24 hours. If you didn't create an account, ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #000000; padding: 30px; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">© 2026 SYNTHEX. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getPasswordResetTemplate(name: string, url: string, code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%); border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px;">🔐 SYNTHEX</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Password Reset Request</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">Hi ${name}!</h2>
              <p style="margin: 0 0 30px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Use one of the options below:
              </p>

              <h3 style="margin: 0 0 15px; color: #ffffff; font-size: 18px;">Option 1: Click the button</h3>
              <div style="text-align: center; margin: 20px 0 30px;">
                <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Reset Password
                </a>
              </div>

              <h3 style="margin: 0 0 15px; color: #ffffff; font-size: 18px;">Option 2: Use this code</h3>
              <div style="background: #1a1a1a; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">Your reset code:</p>
                <p style="margin: 0; color: #06b6d4; font-size: 36px; font-weight: bold; letter-spacing: 8px;">${code}</p>
              </div>

              <p style="margin: 30px 0 0; color: #666666; font-size: 14px;">
                This link and code expire in 1 hour. If you didn't request a password reset, ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #000000; padding: 30px; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">© 2026 SYNTHEX. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getWelcomeTemplate(name: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SYNTHEX</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%); border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 50px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 36px;">🚀 Welcome to SYNTHEX!</h1>
              <p style="margin: 12px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your AI-Powered Marketing Platform</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">Hi ${name}! 👋</h2>
              <p style="margin: 0 0 30px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                Welcome aboard! You've joined 1000+ businesses saving <strong style="color: #10b981;">$140,000+ per year</strong> while getting better results than traditional agencies.
              </p>

              <!-- Features -->
              <div style="margin: 30px 0;">
                <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 12px; padding: 20px; margin-bottom: 15px;">
                  <p style="margin: 0; color: #ffffff;"><strong>🤖 AI Content Generation</strong></p>
                  <p style="margin: 8px 0 0; color: #a3a3a3; font-size: 14px;">Create viral content for any platform in seconds</p>
                </div>
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 20px; margin-bottom: 15px;">
                  <p style="margin: 0; color: #ffffff;"><strong>📱 Multi-Platform Posting</strong></p>
                  <p style="margin: 8px 0 0; color: #a3a3a3; font-size: 14px;">Post to all social platforms from one dashboard</p>
                </div>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 20px;">
                  <p style="margin: 0; color: #ffffff;"><strong>📊 Real-Time Analytics</strong></p>
                  <p style="margin: 8px 0 0; color: #a3a3a3; font-size: 14px;">Track engagement and performance instantly</p>
                </div>
              </div>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${EMAIL_CONFIG.appUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; padding: 18px 50px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 18px;">
                  Go to Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #000000; padding: 30px; text-align: center;">
              <p style="margin: 0 0 15px; color: #666666; font-size: 12px;">Need help? Contact support@synthex.social</p>
              <p style="margin: 0; color: #666666; font-size: 12px;">© 2026 SYNTHEX. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getNotificationTemplate(title: string, message: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%); border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">✨ SYNTHEX</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 22px;">${title}</h2>
              <div style="color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                ${message}
              </div>
              <div style="text-align: center; margin: 40px 0 0;">
                <a href="${EMAIL_CONFIG.appUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  View Dashboard
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #000000; padding: 25px; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">© 2026 SYNTHEX. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const email = new UnifiedEmailService();
export { emailQueue } from './queue';
export type { EmailJob, EmailType, EmailDeliveryStatus } from './queue';
