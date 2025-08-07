import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { apiResponse } from '../utils/apiResponse';
import EmailService from '../services/emailService';
import AuditService from '../services/audit';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/v1/email/status
 * @desc    Get email service status
 * @access  Private
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = EmailService.getStatus();
    
    return apiResponse.success(res, {
      status,
      testConnection: status.configured ? await EmailService.testConnection() : false
    }, 'Email service status retrieved');

  } catch (error) {
    console.error('Get email status error:', error);
    return apiResponse.error(res, 'Failed to get email status');
  }
});

/**
 * @route   POST /api/v1/email/test
 * @desc    Send test email
 * @access  Private (Admin only)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    if ((req.user as any)?.role !== 'admin' && (req.user as any)?.role !== 'superadmin') {
      return apiResponse.error(res, 'Access denied. Admin role required.', 403);
    }

    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return apiResponse.error(res, 'Missing required fields: to, subject, message', 400);
    }

    const success = await EmailService.sendEmail({
      to,
      subject: `[TEST] ${subject}`,
      html: `
        <h2>SYNTHEX Email Test</h2>
        <p><strong>From:</strong> ${req.user.name} (${req.user.email})</p>
        <p><strong>Message:</strong> ${message}</p>
        <hr>
        <p><small>This is a test email from SYNTHEX email service.</small></p>
      `,
      text: `SYNTHEX Email Test\nFrom: ${req.user.name} (${req.user.email})\nMessage: ${message}`
    });

    // Log test email
    await AuditService.log({
      userId: req.user.id,
      action: 'email_test_sent',
      resource: 'email',
      details: {
        to,
        subject,
        success
      },
      severity: 'low',
      category: 'system',
      outcome: success ? 'success' : 'failure'
    });

    return apiResponse.success(res, { success }, 
      success ? 'Test email sent successfully' : 'Failed to send test email'
    );

  } catch (error) {
    console.error('Send test email error:', error);
    return apiResponse.error(res, 'Failed to send test email');
  }
});

/**
 * @route   POST /api/v1/email/send-notification
 * @desc    Send notification email to user
 * @access  Private
 */
router.post('/send-notification', async (req: Request, res: Response) => {
  try {
    const { userId, type, data, priority } = req.body;

    if (!userId || !type) {
      return apiResponse.error(res, 'Missing required fields: userId, type', 400);
    }

    // Verify user can send notifications (admin or sending to self)
    if ((req.user as any)?.role !== 'admin' && (req.user as any)?.role !== 'superadmin' && req.user?.id !== userId) {
      return apiResponse.error(res, 'Access denied. Can only send notifications to yourself or admin role required.', 403);
    }

    const success = await EmailService.sendNotificationEmail({
      userId,
      type,
      data: data || {},
      priority: priority || 'medium'
    });

    return apiResponse.success(res, { success }, 
      success ? 'Notification email sent successfully' : 'Failed to send notification email'
    );

  } catch (error) {
    console.error('Send notification email error:', error);
    return apiResponse.error(res, 'Failed to send notification email');
  }
});

/**
 * @route   POST /api/v1/email/bulk-send
 * @desc    Send bulk emails
 * @access  Private (Admin only)
 */
router.post('/bulk-send', async (req: Request, res: Response) => {
  try {
    if ((req.user as any)?.role !== 'admin' && (req.user as any)?.role !== 'superadmin') {
      return apiResponse.error(res, 'Access denied. Admin role required.', 403);
    }

    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return apiResponse.error(res, 'emails must be a non-empty array', 400);
    }

    // Validate email structure
    for (const email of emails) {
      if (!email.to || !email.subject || !email.html) {
        return apiResponse.error(res, 'Each email must have to, subject, and html fields', 400);
      }
    }

    if (emails.length > 100) {
      return apiResponse.error(res, 'Maximum 100 emails allowed per bulk send', 400);
    }

    const result = await EmailService.sendBulkEmails(emails);

    // Log bulk email send
    await AuditService.log({
      userId: req.user.id,
      action: 'bulk_email_sent',
      resource: 'email',
      details: {
        totalEmails: emails.length,
        sent: result.sent,
        failed: result.failed
      },
      severity: 'medium',
      category: 'system',
      outcome: result.sent > 0 ? 'success' : 'failure'
    });

    return apiResponse.success(res, result, 
      `Bulk email completed: ${result.sent} sent, ${result.failed} failed`
    );

  } catch (error) {
    console.error('Bulk send email error:', error);
    return apiResponse.error(res, 'Failed to send bulk emails');
  }
});

/**
 * @route   POST /api/v1/email/welcome
 * @desc    Send welcome email to new user
 * @access  Private (System/Admin)
 */
router.post('/welcome', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return apiResponse.error(res, 'userId is required', 400);
    }

    // Only allow admin or system to send welcome emails
    if ((req.user as any)?.role !== 'admin' && (req.user as any)?.role !== 'superadmin') {
      return apiResponse.error(res, 'Access denied. Admin role required.', 403);
    }

    const success = await EmailService.sendNotificationEmail({
      userId,
      type: 'welcome',
      data: {},
      priority: 'medium'
    });

    return apiResponse.success(res, { success }, 
      success ? 'Welcome email sent successfully' : 'Failed to send welcome email'
    );

  } catch (error) {
    console.error('Send welcome email error:', error);
    return apiResponse.error(res, 'Failed to send welcome email');
  }
});

/**
 * @route   GET /api/v1/email/templates
 * @desc    Get available email templates
 * @access  Private (Admin only)
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    if ((req.user as any)?.role !== 'admin' && (req.user as any)?.role !== 'superadmin') {
      return apiResponse.error(res, 'Access denied. Admin role required.', 403);
    }

    const templates = [
      {
        type: 'welcome',
        name: 'Welcome Email',
        description: 'Sent to new users when they sign up',
        variables: ['userName']
      },
      {
        type: 'campaign_completed',
        name: 'Campaign Completed',
        description: 'Sent when a marketing campaign completes',
        variables: ['userName', 'campaignName', 'postsPublished', 'totalReach', 'engagementRate', 'campaignId']
      },
      {
        type: 'post_published',
        name: 'Post Published',
        description: 'Sent when a post is successfully published',
        variables: ['userName', 'platform', 'postUrl']
      },
      {
        type: 'post_failed',
        name: 'Post Failed',
        description: 'Sent when a post fails to publish',
        variables: ['userName', 'platform', 'error']
      },
      {
        type: 'security_alert',
        name: 'Security Alert',
        description: 'Sent for security-related events',
        variables: ['userName', 'message', 'ipAddress']
      },
      {
        type: '2fa_enabled',
        name: '2FA Enabled',
        description: 'Sent when two-factor authentication is enabled',
        variables: ['userName']
      },
      {
        type: 'password_reset',
        name: 'Password Reset',
        description: 'Sent for password reset requests',
        variables: ['userName', 'token']
      },
      {
        type: 'system_alert',
        name: 'System Alert',
        description: 'Sent for system-wide alerts',
        variables: ['userName', 'message']
      }
    ];

    return apiResponse.success(res, { templates }, 'Email templates retrieved successfully');

  } catch (error) {
    console.error('Get email templates error:', error);
    return apiResponse.error(res, 'Failed to get email templates');
  }
});

export default router;
