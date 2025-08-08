/**
 * Email Service Library
 * Handles email sending with templates and queuing
 */

import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Email templates
const EMAIL_TEMPLATES = {
  welcome: {
    subject: '🚀 Welcome to Synthex - Your Marketing Automation Journey Begins!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; border-radius: 15px 15px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 2.5rem;">Welcome to Synthex!</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 1.2rem; margin: 10px 0 0 0;">Your AI-powered marketing automation platform</p>
        </div>
        
        <div style="background: white; padding: 40px 20px; border-radius: 0 0 15px 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-bottom: 20px;">Get started in 3 simple steps:</h2>
          
          <div style="margin-bottom: 30px;">
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
              <h3 style="color: #6366f1; margin: 0 0 10px 0;">1. 📝 Create Your First Content</h3>
              <p style="margin: 0; color: #64748b;">Use our AI-powered optimizers for Instagram, Facebook, Twitter, and more!</p>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
              <h3 style="color: #6366f1; margin: 0 0 10px 0;">2. 🎯 Optimize for Each Platform</h3>
              <p style="margin: 0; color: #64748b;">Get platform-specific suggestions, hashtags, and best posting times.</p>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px;">
              <h3 style="color: #6366f1; margin: 0 0 10px 0;">3. 📈 Track Your Performance</h3>
              <p style="margin: 0; color: #64748b;">Monitor your content's success with built-in analytics.</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="{{dashboardUrl}}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block;">
              Start Creating Content 🚀
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 30px;">
            <h3 style="color: #1f2937; margin-bottom: 15px;">What you get with Synthex:</h3>
            <ul style="color: #64748b; line-height: 1.8;">
              <li>✨ AI-powered content optimization</li>
              <li>📱 Support for 8+ social media platforms</li>
              <li>🎯 Smart hashtag generation</li>
              <li>⏰ Best posting time recommendations</li>
              <li>📊 Performance analytics</li>
              <li>🚀 Campaign management tools</li>
            </ul>
          </div>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-top: 30px; border-radius: 0 10px 10px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Pro tip:</strong> Start with our Instagram optimizer - it's our most popular feature!</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 0.9rem;">
          <p>Need help? Reply to this email or visit our <a href="{{supportUrl}}" style="color: #6366f1;">help center</a></p>
          <p style="margin-top: 20px;">Happy creating!<br/>The Synthex Team</p>
        </div>
      </div>
    `
  },

  passwordReset: {
    subject: '🔒 Reset Your Synthex Password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1f2937; padding: 40px 20px; border-radius: 15px 15px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 2rem;">Password Reset Request</h1>
        </div>
        
        <div style="background: white; padding: 40px 20px; border-radius: 0 0 15px 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <p style="color: #374151; font-size: 1.1rem; margin-bottom: 30px;">Hi {{userName}},</p>
          
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 30px;">
            We received a request to reset your password for your Synthex account. If you made this request, click the button below to reset your password:
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="{{resetUrl}}" style="background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block;">
              Reset Password 🔒
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 20px;">
            Or copy and paste this link into your browser:<br/>
            <a href="{{resetUrl}}" style="color: #6366f1; word-break: break-all;">{{resetUrl}}</a>
          </p>
          
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin-top: 30px; border-radius: 0 10px 10px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 0.9rem;">
              <strong>Important:</strong> This link expires in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 0.9rem;">
          <p>Questions? Contact us at <a href="mailto:support@synthex.social" style="color: #6366f1;">support@synthex.social</a></p>
          <p>Synthex Team</p>
        </div>
      </div>
    `
  },

  notification: {
    subject: '🔔 {{title}}',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 30px 20px; border-radius: 15px 15px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 1.8rem;">{{title}}</h1>
        </div>
        
        <div style="background: white; padding: 40px 20px; border-radius: 0 0 15px 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <p style="color: #374151; font-size: 1.1rem; margin-bottom: 20px;">Hi {{userName}},</p>
          
          <div style="color: #6b7280; line-height: 1.6;">
            {{content}}
          </div>
          
          {{#if actionUrl}}
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{actionUrl}}" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              {{actionText}}
            </a>
          </div>
          {{/if}}
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 0.9rem;">
          <p>Synthex Team</p>
        </div>
      </div>
    `
  }
};

// Email service class
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.queue = [];
    this.isProcessing = false;
    this.init();
  }

  // Initialize the email service
  async init() {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('Email service not configured - missing SMTP credentials');
      return;
    }

    try {
      this.transporter = nodemailer.createTransporter({
        ...EMAIL_CONFIG,
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      });

      // Verify connection
      await this.transporter.verify();
      this.isConfigured = true;
      console.log('Email service initialized successfully');

      // Start processing queue
      this.processQueue();
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  // Send welcome email
  async sendWelcomeEmail(userEmail, userName, dashboardUrl = 'https://synthex.social/dashboard') {
    const template = EMAIL_TEMPLATES.welcome;
    const html = template.html
      .replace('{{dashboardUrl}}', dashboardUrl)
      .replace('{{supportUrl}}', 'https://synthex.social/support')
      .replace('{{userName}}', userName);

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html,
      template: 'welcome'
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(userEmail, userName, resetUrl, expiresIn = '1 hour') {
    const template = EMAIL_TEMPLATES.passwordReset;
    const html = template.html
      .replace(/{{userName}}/g, userName)
      .replace(/{{resetUrl}}/g, resetUrl)
      .replace('{{expiresIn}}', expiresIn);

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html,
      template: 'passwordReset',
      priority: 'high'
    });
  }

  // Send notification email
  async sendNotificationEmail(userEmail, userName, title, content, actionUrl = null, actionText = 'View Details') {
    const template = EMAIL_TEMPLATES.notification;
    let html = template.html
      .replace(/{{userName}}/g, userName)
      .replace(/{{title}}/g, title)
      .replace('{{content}}', content);

    if (actionUrl) {
      html = html.replace('{{#if actionUrl}}', '');
      html = html.replace('{{/if}}', '');
      html = html.replace('{{actionUrl}}', actionUrl);
      html = html.replace('{{actionText}}', actionText);
    } else {
      // Remove conditional block
      html = html.replace(/{{#if actionUrl}}[\s\S]*?{{\/if}}/g, '');
    }

    const subject = template.subject.replace('{{title}}', title);

    return this.sendEmail({
      to: userEmail,
      subject,
      html,
      template: 'notification'
    });
  }

  // Send raw email
  async sendEmail(emailOptions) {
    if (!this.isConfigured) {
      console.warn('Email service not configured, adding to queue');
      this.queue.push(emailOptions);
      return { success: false, message: 'Email queued - service not configured' };
    }

    try {
      const mailOptions = {
        from: {
          name: 'Synthex Marketing',
          address: EMAIL_CONFIG.auth.user
        },
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        priority: emailOptions.priority || 'normal',
        headers: {
          'X-Mailer': 'Synthex Marketing Platform',
          'X-Template': emailOptions.template || 'custom'
        }
      };

      // Add text version if not provided
      if (!emailOptions.text && emailOptions.html) {
        mailOptions.text = this.htmlToText(emailOptions.html);
      }

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', result.messageId);
      return { 
        success: true, 
        messageId: result.messageId,
        response: result.response 
      };

    } catch (error) {
      console.error('Failed to send email:', error);
      
      // Add to queue for retry
      if (emailOptions.retries === undefined) {
        emailOptions.retries = 0;
      }
      
      if (emailOptions.retries < 3) {
        emailOptions.retries++;
        this.queue.push(emailOptions);
      }

      return { 
        success: false, 
        error: error.message,
        retry: emailOptions.retries < 3
      };
    }
  }

  // Process email queue
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const emailOptions = this.queue.shift();
      
      try {
        await this.sendEmail(emailOptions);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }

    this.isProcessing = false;
  }

  // Convert HTML to plain text (simple version)
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isConfigured: this.isConfigured
    };
  }

  // Test email configuration
  async testConnection() {
    if (!this.isConfigured) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email service connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Create singleton instance
export const emailService = new EmailService();

// Export individual functions for convenience
export const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  sendEmail,
  testConnection,
  getQueueStatus
} = emailService;

export default emailService;