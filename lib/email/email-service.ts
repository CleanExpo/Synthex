/**
 * Email Service for SYNTHEX Platform
 * Handles email verification and password reset emails
 */

import prisma from '@/lib/prisma';
import crypto from 'crypto';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private readonly baseUrl: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@synthex.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SYNTHEX';
  }

  /**
   * Generate verification code
   */
  generateVerificationCode(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate 6-digit OTP
   */
  generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(userId: string, email: string, name?: string): Promise<void> {
    try {
      // Generate verification code
      const verificationCode = this.generateVerificationCode();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save verification code to database
      await prisma.user.update({
        where: { id: userId },
        data: {
          verificationCode,
          verificationExpires
        }
      });

      // Create verification URL
      const verificationUrl = `${this.baseUrl}/auth/verify-email?code=${verificationCode}`;

      // Email template
      const template: EmailTemplate = {
        to: email,
        subject: 'Verify your SYNTHEX account',
        html: this.getVerificationEmailTemplate(name || 'User', verificationUrl),
        text: `Welcome to SYNTHEX! Please verify your email by clicking this link: ${verificationUrl}`
      };

      // Send email (in production, integrate with email service)
      await this.sendEmail(template);

    } catch (error) {
      console.error('[EMAIL] Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userId: string, email: string, name?: string): Promise<void> {
    try {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetCode = this.generateOTP();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token to database
      await prisma.user.update({
        where: { id: userId },
        data: {
          resetToken,
          resetCode,
          resetTokenExpires: resetExpires,
          resetCodeExpires: resetExpires
        }
      });

      // Create reset URL
      const resetUrl = `${this.baseUrl}/auth/reset-password?token=${resetToken}`;

      // Email template
      const template: EmailTemplate = {
        to: email,
        subject: 'Reset your SYNTHEX password',
        html: this.getPasswordResetEmailTemplate(name || 'User', resetUrl, resetCode),
        text: `Reset your SYNTHEX password using this link: ${resetUrl} or use code: ${resetCode}`
      };

      // Send email
      await this.sendEmail(template);

    } catch (error) {
      console.error('[EMAIL] Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<void> {
    try {
      const template: EmailTemplate = {
        to: email,
        subject: 'Welcome to SYNTHEX - Your AI Marketing Platform',
        html: this.getWelcomeEmailTemplate(name || 'User'),
        text: 'Welcome to SYNTHEX! Start creating viral content with AI.'
      };

      await this.sendEmail(template);
    } catch (error) {
      console.error('[EMAIL] Error sending welcome email:', error);
    }
  }

  /**
   * Send referral invite email
   * Non-blocking — caller should wrap in try/catch so referral still works if email fails
   */
  async sendReferralInviteEmail(
    email: string,
    referralCode: string,
    referrerName?: string
  ): Promise<void> {
    try {
      const signupUrl = `${this.baseUrl}/signup?ref=${referralCode}`;
      const template: EmailTemplate = {
        to: email,
        subject: `${referrerName || 'Someone'} invited you to SYNTHEX`,
        html: this.getReferralInviteEmailTemplate(
          referrerName || 'A SYNTHEX user',
          referralCode,
          signupUrl
        ),
        text: `You've been invited to join SYNTHEX by ${referrerName || 'a friend'}! Sign up with this link to get 500 bonus AI credits: ${signupUrl}`,
      };

      await this.sendEmail(template);
    } catch (error) {
      console.error('[EMAIL] Error sending referral invite email:', error);
      // Non-blocking — don't throw so referral creation still succeeds
    }
  }

  /**
   * Send email (mock implementation)
   * In production, integrate with SendGrid, AWS SES, or similar
   */
  private async sendEmail(template: EmailTemplate): Promise<void> {
    // Check if email service is configured
    const emailProvider = process.env.EMAIL_PROVIDER;
    
    if (emailProvider === 'sendgrid') {
      // SendGrid integration
      await this.sendViaSendGrid(template);
    } else if (emailProvider === 'ses') {
      // AWS SES integration
      await this.sendViaAWSSES(template);
    } else if (emailProvider === 'resend') {
      // Resend integration
      await this.sendViaResend(template);
    } else {
      // Log email for development
      
      // In development, save to database for testing
      if (process.env.NODE_ENV === 'development') {
        await this.saveEmailToDatabase(template);
      }
    }
  }

  /**
   * SendGrid integration
   */
  private async sendViaSendGrid(template: EmailTemplate): Promise<void> {
    // Only attempt to use SendGrid if API key is configured
    if (!process.env.SENDGRID_API_KEY) {
      await this.saveEmailToDatabase(template);
      return;
    }

    // For now, just use mock email since SendGrid is not installed
    // To enable SendGrid:
    // 1. Run: npm install @sendgrid/mail
    // 2. Set SENDGRID_API_KEY in environment variables
    // 3. Uncomment the implementation below
    
    await this.saveEmailToDatabase(template);
    
    /* 
    // Uncomment after installing @sendgrid/mail:
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: template.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: template.subject,
        text: template.text || '',
        html: template.html
      };

      await sgMail.send(msg);
    } catch (error) {
      console.error('[EMAIL] SendGrid error:', error);
      await this.saveEmailToDatabase(template);
    }
    */
  }

  /**
   * AWS SES integration
   */
  private async sendViaAWSSES(template: EmailTemplate): Promise<void> {
    // AWS SES implementation
  }

  /**
   * Resend integration
   */
  private async sendViaResend(template: EmailTemplate): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      throw new Error('Resend not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: template.to,
        subject: template.subject,
        html: template.html,
        text: template.text
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send email via Resend');
    }
  }

  /**
   * Save email to database for development testing
   */
  private async saveEmailToDatabase(template: EmailTemplate): Promise<void> {
    // Store in notifications table for testing
    const user = await prisma.user.findFirst({
      where: { email: template.to }
    });

    if (user) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'info',
          title: template.subject,
          message: template.text || 'Email sent',
          data: {
            html: template.html,
            timestamp: new Date()
          }
        }
      });
    }
  }

  /**
   * Verification email template
   */
  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify your email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to SYNTHEX!</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Thanks for signing up for SYNTHEX - your AI-powered marketing platform!</p>
              <p>Please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">
                ${verificationUrl}
              </p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account with SYNTHEX, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2024 SYNTHEX. All rights reserved.</p>
              <p>AI-Powered Marketing Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Password reset email template
   */
  private getPasswordResetEmailTemplate(name: string, resetUrl: string, resetCode: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset your password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .code-box { background: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>We received a request to reset your SYNTHEX account password.</p>
              <p>You can reset your password using one of these methods:</p>
              
              <h3>Option 1: Click the button</h3>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <h3>Option 2: Use this code</h3>
              <div class="code-box">
                <p>Enter this code on the password reset page:</p>
                <div class="code">${resetCode}</div>
              </div>
              
              <p>This link and code will expire in 1 hour.</p>
              <p>If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
              
              <p style="margin-top: 30px;"><strong>Security tip:</strong> Never share your password or reset code with anyone.</p>
            </div>
            <div class="footer">
              <p>© 2024 SYNTHEX. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Welcome email template
   */
  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to SYNTHEX</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Welcome to SYNTHEX!</h1>
              <p>Your AI-Powered Marketing Journey Starts Here</p>
            </div>
            <div class="content">
              <h2>Hi ${name}! 👋</h2>
              <p>Congratulations on joining SYNTHEX! You're now part of a community that's revolutionizing social media marketing with AI.</p>
              
              <h3>Here's what you can do with SYNTHEX:</h3>
              
              <div class="feature">
                <strong>🤖 AI Content Generation</strong>
                <p>Create viral-worthy content for any platform in seconds</p>
              </div>
              
              <div class="feature">
                <strong>📱 Multi-Platform Posting</strong>
                <p>Post to Twitter, LinkedIn, Instagram, Facebook, and TikTok from one place</p>
              </div>
              
              <div class="feature">
                <strong>📊 Analytics Dashboard</strong>
                <p>Track engagement, growth, and performance across all platforms</p>
              </div>
              
              <div class="feature">
                <strong>🎯 Smart Optimization</strong>
                <p>Get AI-powered recommendations to improve your content strategy</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${this.baseUrl}/dashboard" class="button">Get Started</a>
              </div>
              
              <h3>Quick Start Guide:</h3>
              <ol>
                <li>Complete your profile setup</li>
                <li>Connect your social media accounts</li>
                <li>Generate your first AI content</li>
                <li>Schedule or post immediately</li>
                <li>Track performance in analytics</li>
              </ol>
              
              <p>Need help? Check out our <a href="${this.baseUrl}/help">Help Center</a> or reply to this email.</p>
              
              <p>Welcome aboard! 🎉</p>
              <p>The SYNTHEX Team</p>
            </div>
            <div class="footer">
              <p>© 2024 SYNTHEX. All rights reserved.</p>
              <p>Follow us: <a href="#">Twitter</a> | <a href="#">LinkedIn</a> | <a href="#">Instagram</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getReferralInviteEmailTemplate(
    referrerName: string,
    referralCode: string,
    signupUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>You're Invited to SYNTHEX</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .highlight { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; text-align: center; border: 2px dashed #667eea; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎁 You're Invited!</h1>
              <p>Join SYNTHEX and get 500 bonus AI credits</p>
            </div>
            <div class="content">
              <h2>Hi there! 👋</h2>
              <p><strong>${referrerName}</strong> thinks you'd love SYNTHEX — the AI-powered marketing platform that helps you create, schedule, and optimise content across all your social channels.</p>

              <div class="highlight">
                <p style="font-size: 14px; color: #666; margin: 0;">Your referral code</p>
                <p style="font-size: 24px; font-weight: bold; color: #667eea; margin: 5px 0;">${referralCode}</p>
                <p style="font-size: 14px; color: #666; margin: 0;">500 bonus AI credits when you sign up</p>
              </div>

              <div style="text-align: center;">
                <a href="${signupUrl}" class="button">Accept Invitation</a>
              </div>

              <p style="text-align: center; color: #666; font-size: 14px;">
                Or copy this link: ${signupUrl}
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SYNTHEX. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Verify email with code
   */
  async verifyEmail(code: string): Promise<{ success: boolean; userId?: string; message: string }> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          verificationCode: code,
          verificationExpires: {
            gt: new Date()
          }
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification code'
        };
      }

      // Update user as verified
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // Database expects Boolean for emailVerified
          emailVerified: true,
          verificationCode: null,
          verificationExpires: null
        }
      });

      // Send welcome email
      await this.sendWelcomeEmail(user.email, user.name || undefined);

      return {
        success: true,
        userId: user.id,
        message: 'Email verified successfully'
      };
    } catch (error) {
      console.error('[EMAIL] Error verifying email:', error);
      return {
        success: false,
        message: 'Failed to verify email'
      };
    }
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: {
            gt: new Date()
          }
        }
      });

      if (!user) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: user.id
      };
    } catch (error) {
      console.error('[EMAIL] Error validating reset token:', error);
      return { valid: false };
    }
  }

  /**
   * Reset password with token
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const validation = await this.validateResetToken(token);
      
      if (!validation.valid || !validation.userId) {
        return {
          success: false,
          message: 'Invalid or expired reset token'
        };
      }

      // Hash the new password
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await prisma.user.update({
        where: { id: validation.userId },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
          resetCode: null,
          resetCodeExpires: null
        }
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      console.error('[EMAIL] Error resetting password:', error);
      return {
        success: false,
        message: 'Failed to reset password'
      };
    }
  }

  /**
   * Reset password with OTP code
   */
  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          email,
          resetCode: code,
          resetCodeExpires: {
            gt: new Date()
          }
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired reset code'
        };
      }

      // Hash the new password
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
          resetCode: null,
          resetCodeExpires: null
        }
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      console.error('[EMAIL] Error resetting password with code:', error);
      return {
        success: false,
        message: 'Failed to reset password'
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
