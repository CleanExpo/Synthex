import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, message } = await request.json();

    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message' },
        { status: 400 }
      );
    }

    // Check environment variables
    const emailConfig = {
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      gmail: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      sendgrid: {
        key: process.env.SENDGRID_API_KEY,
      },
      from: process.env.EMAIL_FROM || 'support@synthex.social',
    };

    // Create transporter based on provider
    let transporter;
    
    if (emailConfig.provider === 'gmail' && emailConfig.gmail.user && emailConfig.gmail.pass) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailConfig.gmail.user,
          pass: emailConfig.gmail.pass,
        },
      });
    } else if (emailConfig.provider === 'sendgrid' && emailConfig.sendgrid.key) {
      transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: emailConfig.sendgrid.key,
        },
      });
    } else if (emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.pass) {
      transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: parseInt(emailConfig.smtp.port || '587'),
        secure: emailConfig.smtp.port === '465',
        auth: {
          user: emailConfig.smtp.user,
          pass: emailConfig.smtp.pass,
        },
      });
    } else {
      return NextResponse.json(
        { 
          error: 'Email service not configured properly',
          config: {
            provider: emailConfig.provider,
            hasSmtpHost: !!emailConfig.smtp.host,
            hasSmtpUser: !!emailConfig.smtp.user,
            hasSmtpPass: !!emailConfig.smtp.pass,
            hasGmailUser: !!emailConfig.gmail.user,
            hasGmailPass: !!emailConfig.gmail.pass,
            hasSendgridKey: !!emailConfig.sendgrid.key,
          }
        },
        { status: 500 }
      );
    }

    // Send email
    const mailOptions = {
      from: emailConfig.from,
      to: to,
      subject: `[SYNTHEX TEST] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00bcd4;">SYNTHEX Email Test</h2>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is a test email from SYNTHEX platform.<br>
            Sent from: ${emailConfig.from}
          </p>
        </div>
      `,
      text: `SYNTHEX Email Test\n\nMessage: ${message}\n\nThis is a test email from SYNTHEX platform.`,
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      from: emailConfig.from,
      to: to,
    });

  } catch (error: any) {
    console.error('Email test error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return configuration status
  const config = {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    hasSmtpConfig: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    hasGmailConfig: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    hasSendgridConfig: !!process.env.SENDGRID_API_KEY,
    emailFrom: process.env.EMAIL_FROM || 'support@synthex.social',
  };

  return NextResponse.json({
    status: 'Email test endpoint ready',
    configuration: config,
    instructions: 'Send a POST request with { to, subject, message } to test email sending',
  });
}