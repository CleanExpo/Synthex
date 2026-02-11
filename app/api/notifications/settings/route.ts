/**
 * Notification Settings API
 *
 * @description Manage user notification preferences
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for notification settings
const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  mentionAlerts: z.boolean().optional(),
  campaignUpdates: z.boolean().optional(),
});

/**
 * GET /api/notifications/settings
 * Get current user's notification settings
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    const userId = security.context.userId;

    // Fetch user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    // Extract notification settings from preferences
    const preferences = (user?.preferences as Record<string, unknown>) || {};
    const notificationSettings = {
      emailNotifications: preferences.emailNotifications ?? true,
      pushNotifications: preferences.pushNotifications ?? true,
      marketingEmails: preferences.marketingEmails ?? false,
      weeklyDigest: preferences.weeklyDigest ?? true,
      mentionAlerts: preferences.mentionAlerts ?? true,
      campaignUpdates: preferences.campaignUpdates ?? true,
    };

    return APISecurityChecker.createSecureResponse(
      { success: true, data: notificationSettings },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch notification settings' },
      500,
      security.context
    );
  }
}

/**
 * PUT /api/notifications/settings
 * Update current user's notification settings
 */
export async function PUT(request: NextRequest) {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    const userId = security.context.userId;
    const body = await request.json();

    // Validate input
    const validation = notificationSettingsSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation failed', details: validation.error.errors },
        400,
        security.context
      );
    }

    const settingsUpdate = validation.data;

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const currentPreferences = (user?.preferences as Record<string, unknown>) || {};

    // Merge new settings with current preferences
    const updatedPreferences = {
      ...currentPreferences,
      ...settingsUpdate,
    };

    // Update user preferences
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      },
    });

    return APISecurityChecker.createSecureResponse(
      { success: true, data: settingsUpdate },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update notification settings' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

