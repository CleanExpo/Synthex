/**
 * Email API Endpoint
 * Handles sending various types of emails through the email service
 */

import { emailService } from '../src/lib/email.js';
import { authService } from '../src/lib/auth.js';
import { db } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'POST':
        return await handleSendEmail(req, res);
      case 'GET':
        return await handleEmailStatus(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Email API error:', error);
    res.status(500).json({
      error: 'Email service failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Handle sending emails
async function handleSendEmail(req, res) {
  const { type, ...params } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Email type is required' });
  }

  let result;

  switch (type) {
    case 'welcome':
      result = await handleWelcomeEmail(params);
      break;
    case 'password-reset':
      result = await handlePasswordResetEmail(params);
      break;
    case 'notification':
      result = await handleNotificationEmail(params);
      break;
    case 'custom':
      result = await handleCustomEmail(params);
      break;
    default:
      return res.status(400).json({ error: 'Invalid email type' });
  }

  if (result.success) {
    // Track email sending
    await trackEmailUsage(type, params.userEmail);
    
    return res.json({
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    });
  } else {
    return res.status(500).json({
      success: false,
      error: result.error,
      retry: result.retry
    });
  }
}

// Handle email status/queue info
async function handleEmailStatus(req, res) {
  const status = emailService.getQueueStatus();
  const connectionTest = await emailService.testConnection();
  
  res.json({
    service: {
      configured: status.isConfigured,
      connection: connectionTest.success,
      queue: {
        length: status.queueLength,
        processing: status.isProcessing
      }
    },
    stats: await getEmailStats()
  });
}

// Email type handlers
async function handleWelcomeEmail(params) {
  const { userEmail, userName, dashboardUrl } = params;

  if (!userEmail || !userName) {
    throw new Error('User email and name are required for welcome email');
  }

  return await emailService.sendWelcomeEmail(
    userEmail, 
    userName, 
    dashboardUrl || 'https://synthex.social/dashboard'
  );
}

async function handlePasswordResetEmail(params) {
  const { userEmail, userName, resetToken, expiresIn } = params;

  if (!userEmail || !userName || !resetToken) {
    throw new Error('User email, name, and reset token are required');
  }

  const resetUrl = `https://synthex.social/reset-password?token=${resetToken}`;

  return await emailService.sendPasswordResetEmail(
    userEmail,
    userName,
    resetUrl,
    expiresIn || '1 hour'
  );
}

async function handleNotificationEmail(params) {
  const { userEmail, userName, title, content, actionUrl, actionText } = params;

  if (!userEmail || !userName || !title || !content) {
    throw new Error('User email, name, title, and content are required for notification email');
  }

  return await emailService.sendNotificationEmail(
    userEmail,
    userName,
    title,
    content,
    actionUrl,
    actionText
  );
}

async function handleCustomEmail(params) {
  const { to, subject, html, text, priority } = params;

  if (!to || !subject || (!html && !text)) {
    throw new Error('Recipient, subject, and content (html or text) are required');
  }

  return await emailService.sendEmail({
    to,
    subject,
    html,
    text,
    priority: priority || 'normal',
    template: 'custom'
  });
}

// Track email usage for analytics
async function trackEmailUsage(emailType, userEmail) {
  try {
    // Try to get user ID from email
    const { data: user } = await db.supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (user?.id) {
      // Track in analytics
      await db.analytics.trackOptimization(user.id, 'email', 0);
      
      // Update feature usage
      await db.features?.updateUsage?.(user.id, `email_${emailType}`, 'email');
    }

    // Log email sending
    console.log(`Email sent: ${emailType} to ${userEmail}`);

  } catch (error) {
    console.error('Failed to track email usage:', error);
    // Don't throw error for tracking failures
  }
}

// Get email statistics
async function getEmailStats() {
  try {
    // Get email sending stats from analytics
    const { data: emailStats } = await db.supabase
      .from('analytics')
      .select('*')
      .eq('platform', 'email')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });

    return {
      last24Hours: emailStats?.length || 0,
      totalSent: 0, // Would need separate tracking for total
      queueStatus: emailService.getQueueStatus()
    };

  } catch (error) {
    console.error('Failed to get email stats:', error);
    return {
      last24Hours: 0,
      totalSent: 0,
      queueStatus: emailService.getQueueStatus()
    };
  }
}