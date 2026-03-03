/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: internal email delivery service; called server-side by auth flows, notifications, and cron jobs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { emailService } from '@/lib/email-service';
import { createClient } from '@supabase/supabase-js';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().optional(),
  template: z.string().optional(),
  variables: z.record(z.any()).optional(),
  type: z.string().optional(),
});

/**
 * Simple HTML sanitization for email content
 * Strips script tags, event handlers, and dangerous attributes
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="#"')
    .replace(/src\s*=\s*["']?\s*data:text\/html/gi, 'src="#"')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = sendEmailSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { to, subject, template, variables, type } = validation.data;

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
        success = await emailService.sendWeeklyReport(to, variables as any);
        break;

      default:
        // Send custom email with sanitized HTML to prevent XSS
        success = await emailService.send({
          to,
          subject: subject || 'SYNTHEX Notification',
          template,
          variables,
          html: variables?.html ? sanitizeHtml(variables.html) : undefined,
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
      { error: 'Failed to send email', message: sanitizeErrorForResponse(error, 'Email delivery failed') },
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
