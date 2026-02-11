import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email-service';
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'isomorphic-dompurify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, template, variables, type } = body;

    // Validate request
    if (!to) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!emailService.validateEmail(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Send email based on type
    let success = false;
    
    switch (type) {
      case 'welcome':
        success = await emailService.sendWelcomeEmail(to, variables?.name);
        break;
      
      case 'passwordReset':
        success = await emailService.sendPasswordResetEmail(
          to,
          variables?.resetUrl || '',
          variables?.code
        );
        break;
      
      case 'notification':
        success = await emailService.sendNotification(to, {
          type: variables?.notificationType || 'info',
          title: variables?.title || subject,
          message: variables?.message || '',
          actionUrl: variables?.actionUrl
        });
        break;
      
      case 'weeklyReport':
        success = await emailService.sendWeeklyReport(to, variables);
        break;
      
      default:
        // Send custom email with sanitized HTML to prevent XSS
        success = await emailService.send({
          to,
          subject: subject || 'SYNTHEX Notification',
          template,
          variables,
          html: variables?.html ? DOMPurify.sanitize(variables.html) : undefined,
          text: variables?.text
        });
    }

    // Log email send attempt
    try {
      await supabase.from('email_logs').insert({
        to,
        subject,
        type: type || 'custom',
        status: success ? 'sent' : 'failed',
        metadata: { template, variables }
      });
    } catch (err) {
      console.error('Failed to log email:', err);
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully'
      });
    } else {
      throw new Error('Failed to send email');
    }

  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error },
      { status: 500 }
    );
  }
}

// GET endpoint to check email service status
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'operational',
    provider: 'internal',
    features: [
      'welcome',
      'passwordReset',
      'notification',
      'weeklyReport',
      'custom'
    ]
  });
}