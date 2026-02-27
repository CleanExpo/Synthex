import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

interface EmailData {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export class SendGridService {
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@synthex.social';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SYNTHEX';
  }

  /**
   * Send an email using SendGrid
   */
  async sendEmail(data: EmailData): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return false;
    }

    try {
      const msg = {
        to: data.to,
        from: {
          email: data.from || this.fromEmail,
          name: this.fromName
        },
        subject: data.subject,
        html: data.html,
        text: data.text || this.stripHtml(data.html),
      };

      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error('SendGrid error:', error);
      return false;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const subject = 'Welcome to SYNTHEX - Your AI Social Media Agency is Ready! 🚀';
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SYNTHEX</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background: linear-gradient(135deg, #1a0033 0%, #0a0a0a 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(6, 182, 212, 0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 20px 30px; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);">
              <div style="display: inline-block;">
                <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: -1px;">
                  ✨ SYNTHEX
                </h1>
                <p style="margin: 5px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">
                  Your AI Social Media Agency
                </p>
              </div>
            </td>
          </tr>

          <!-- Welcome Message -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 28px; font-weight: bold; text-align: center;">
                Welcome aboard, ${userName}! 🎉
              </h2>
              <p style="margin: 0 0 25px; color: #a3a3a3; font-size: 16px; line-height: 1.6; text-align: center;">
                You've just joined <strong style="color: #ffffff;">1000+ businesses</strong> who are saving 
                <strong style="color: #10b981;">$140,000+ per year</strong> while getting better results than traditional agencies.
              </p>
            </td>
          </tr>

          <!-- Your AI Team -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: rgba(6, 182, 212, 0.1); border-radius: 12px; padding: 30px; border: 1px solid rgba(6, 182, 212, 0.2);">
                <h3 style="margin: 0 0 20px; color: #ffffff; font-size: 20px; font-weight: bold;">
                  Your AI Team is Ready to Work 24/7
                </h3>
                
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="50%" style="padding: 0 10px 15px 0;">
                      <div style="display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 10px;">🧠</span>
                        <div>
                          <strong style="color: #ffffff; font-size: 14px;">AI Strategy Analyst</strong>
                          <p style="margin: 2px 0 0; color: #a3a3a3; font-size: 12px;">Viral pattern recognition</p>
                        </div>
                      </div>
                    </td>
                    <td width="50%" style="padding: 0 0 15px 10px;">
                      <div style="display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 10px;">✨</span>
                        <div>
                          <strong style="color: #ffffff; font-size: 14px;">AI Content Creator</strong>
                          <p style="margin: 2px 0 0; color: #a3a3a3; font-size: 12px;">Brand voice learning</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding: 0 10px 15px 0;">
                      <div style="display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 10px;">📅</span>
                        <div>
                          <strong style="color: #ffffff; font-size: 14px;">AI Campaign Manager</strong>
                          <p style="margin: 2px 0 0; color: #a3a3a3; font-size: 12px;">Optimal scheduling</p>
                        </div>
                      </div>
                    </td>
                    <td width="50%" style="padding: 0 0 15px 10px;">
                      <div style="display: flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 10px;">📊</span>
                        <div>
                          <strong style="color: #ffffff; font-size: 14px;">AI Analytics Expert</strong>
                          <p style="margin: 2px 0 0; color: #a3a3a3; font-size: 12px;">Real-time insights</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Quick Start Guide -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="margin: 0 0 20px; color: #ffffff; font-size: 20px; font-weight: bold;">
                🚀 Get Started in 3 Simple Steps
              </h3>
              
              <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                  <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">1</div>
                  <div>
                    <strong style="color: #ffffff; font-size: 16px;">Connect Your Social Accounts</strong>
                    <p style="margin: 5px 0 0; color: #a3a3a3; font-size: 14px; line-height: 1.5;">Link Twitter, LinkedIn, Instagram, and more in seconds.</p>
                  </div>
                </div>
                
                <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                  <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">2</div>
                  <div>
                    <strong style="color: #ffffff; font-size: 16px;">Train Your AI on Your Brand</strong>
                    <p style="margin: 5px 0 0; color: #a3a3a3; font-size: 14px; line-height: 1.5;">Upload past content so AI learns your unique voice.</p>
                  </div>
                </div>
                
                <div style="display: flex; align-items: flex-start;">
                  <div style="background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">3</div>
                  <div>
                    <strong style="color: #ffffff; font-size: 16px;">Launch Your First Campaign</strong>
                    <p style="margin: 5px 0 0; color: #a3a3a3; font-size: 14px; line-height: 1.5;">Generate viral content and schedule across all platforms.</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 40px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 10px 20px rgba(6, 182, 212, 0.3);">
                Go to Your Dashboard →
              </a>
            </td>
          </tr>

          <!-- Resources -->
          <tr>
            <td style="padding: 20px 40px 30px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <h4 style="margin: 0 0 15px; color: #ffffff; font-size: 16px; font-weight: bold;">
                📚 Helpful Resources
              </h4>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="50%" style="padding-right: 10px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/docs" style="color: #06b6d4; text-decoration: none; font-size: 14px;">
                      📖 Documentation
                    </a>
                  </td>
                  <td width="50%" style="padding-left: 10px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/academy" style="color: #06b6d4; text-decoration: none; font-size: 14px;">
                      🎓 SYNTHEX Academy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 10px 10px 0 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/best-practices" style="color: #06b6d4; text-decoration: none; font-size: 14px;">
                      💡 Best Practices Guide
                    </a>
                  </td>
                  <td width="50%" style="padding: 10px 0 0 10px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/support" style="color: #06b6d4; text-decoration: none; font-size: 14px;">
                      💬 24/7 Support
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; text-align: center;">
              <p style="margin: 0 0 10px; color: #a3a3a3; font-size: 12px;">
                You're receiving this because you signed up for SYNTHEX.
              </p>
              <p style="margin: 0 0 15px; color: #a3a3a3; font-size: 12px;">
                © 2025 SYNTHEX. All rights reserved.
              </p>
              <div style="margin-top: 20px;">
                <a href="https://twitter.com/synthexai" style="color: #06b6d4; text-decoration: none; font-size: 12px; margin: 0 10px;">Twitter</a>
                <a href="https://linkedin.com/company/synthex" style="color: #06b6d4; text-decoration: none; font-size: 12px; margin: 0 10px;">LinkedIn</a>
                <a href="mailto:support@synthex.social" style="color: #06b6d4; text-decoration: none; font-size: 12px; margin: 0 10px;">Support</a>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  /**
   * Send cancellation/goodbye email
   */
  async sendCancellationEmail(userEmail: string, userName: string): Promise<boolean> {
    const subject = 'We\'re Sorry to See You Go 😢';
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sorry to See You Go - SYNTHEX</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background: linear-gradient(135deg, #1a0033 0%, #0a0a0a 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(6, 182, 212, 0.1);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 20px 30px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
              <div style="display: inline-block;">
                <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: -1px;">
                  ✨ SYNTHEX
                </h1>
                <p style="margin: 5px 0 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">
                  We're sorry to see you go
                </p>
              </div>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: bold; text-align: center;">
                Goodbye, ${userName} 👋
              </h2>
              <p style="margin: 0 0 25px; color: #a3a3a3; font-size: 16px; line-height: 1.6; text-align: center;">
                Your SYNTHEX account has been successfully cancelled. We're sad to see you leave our community of 
                <strong style="color: #ffffff;">1000+ businesses</strong> transforming their social media presence.
              </p>
            </td>
          </tr>

          <!-- What You'll Miss -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 25px; border: 1px solid rgba(239, 68, 68, 0.2);">
                <h3 style="margin: 0 0 15px; color: #ffffff; font-size: 18px; font-weight: bold;">
                  What You'll Be Missing:
                </h3>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #a3a3a3; font-size: 14px; line-height: 1.8;">
                  <li><strong style="color: #ffffff;">$140,436/year savings</strong> vs traditional agencies</li>
                  <li><strong style="color: #ffffff;">2.2x engagement boost</strong> with AI optimization</li>
                  <li><strong style="color: #ffffff;">24/7 AI team</strong> working on your social media</li>
                  <li><strong style="color: #ffffff;">Viral pattern analysis</strong> for your content</li>
                  <li><strong style="color: #ffffff;">All platforms</strong> managed from one dashboard</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Feedback Request -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: rgba(6, 182, 212, 0.1); border-radius: 12px; padding: 25px; border: 1px solid rgba(6, 182, 212, 0.2);">
                <h3 style="margin: 0 0 15px; color: #ffffff; font-size: 18px; font-weight: bold;">
                  💭 Help Us Improve
                </h3>
                <p style="margin: 0 0 15px; color: #a3a3a3; font-size: 14px; line-height: 1.6;">
                  Your feedback is invaluable. Would you mind sharing why you decided to leave? 
                  It'll help us serve our community better.
                </p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/feedback" style="display: inline-block; background: rgba(6, 182, 212, 0.2); color: #06b6d4; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; border: 1px solid rgba(6, 182, 212, 0.3);">
                  Share Feedback
                </a>
              </div>
            </td>
          </tr>

          <!-- Special Offer -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%); border-radius: 12px; padding: 25px; border: 1px solid rgba(16, 185, 129, 0.2); text-align: center;">
                <h3 style="margin: 0 0 10px; color: #10b981; font-size: 20px; font-weight: bold;">
                  🎁 Special Comeback Offer
                </h3>
                <p style="margin: 0 0 15px; color: #a3a3a3; font-size: 14px; line-height: 1.6;">
                  Changed your mind? Come back within 30 days and get
                </p>
                <p style="margin: 0 0 20px; color: #ffffff; font-size: 24px; font-weight: bold;">
                  50% OFF for 3 Months
                </p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/reactivate" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Reactivate Account
                </a>
              </div>
            </td>
          </tr>

          <!-- Important Info -->
          <tr>
            <td style="padding: 20px 40px 30px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <h4 style="margin: 0 0 15px; color: #ffffff; font-size: 16px; font-weight: bold;">
                ⚠️ Important Information
              </h4>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #a3a3a3; font-size: 13px; line-height: 1.8;">
                <li>Your data will be retained for 30 days</li>
                <li>You can reactivate anytime within this period</li>
                <li>After 30 days, all data will be permanently deleted</li>
                <li>Any remaining subscription time has been refunded</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; text-align: center;">
              <p style="margin: 0 0 10px; color: #a3a3a3; font-size: 12px;">
                Thank you for being part of the SYNTHEX community.
              </p>
              <p style="margin: 0 0 10px; color: #a3a3a3; font-size: 12px;">
                If you have any questions, our support team is here to help.
              </p>
              <p style="margin: 20px 0 15px;">
                <a href="mailto:support@synthex.social" style="color: #06b6d4; text-decoration: none; font-size: 14px; font-weight: bold;">
                  support@synthex.social
                </a>
              </p>
              <p style="margin: 0; color: #666666; font-size: 11px;">
                © 2025 SYNTHEX. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const sendGridService = new SendGridService();
