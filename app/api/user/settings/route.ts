/**
 * User Settings API Route
 * GET /api/user/settings - Get user settings
 * PUT /api/user/settings - Update user settings
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * DB: Uses Prisma `User.settings` Json field (migrated from Supabase
 * `user_settings` table to fix FK constraint violations for OAuth users — UNI-839).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Default settings returned when no settings are stored
const DEFAULT_SETTINGS = {
  notifications: {
    email: true,
    push: false,
    sms: false,
    weeklyReport: true,
    viralAlert: true,
    systemUpdates: false,
  },
  privacy: {
    profilePublic: false,
    showAnalytics: true,
    allowDataCollection: true,
  },
  theme: 'dark',
  language: 'en',
  timezone: 'UTC',
};

// Validation schemas for different setting types
const notificationSettingsSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),
  viralAlert: z.boolean().optional(),
  systemUpdates: z.boolean().optional(),
});

const privacySettingsSchema = z.object({
  profilePublic: z.boolean().optional(),
  showAnalytics: z.boolean().optional(),
  allowDataCollection: z.boolean().optional(),
});

const settingsUpdateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('notifications'),
    settings: notificationSettingsSchema,
  }),
  z.object({
    type: z.literal('privacy'),
    settings: privacySettingsSchema,
  }),
  z.object({
    type: z.literal('theme'),
    settings: z.enum(['light', 'dark', 'system']),
  }),
  z.object({
    type: z.literal('language'),
    settings: z.string().min(2).max(10),
  }),
  z.object({
    type: z.literal('timezone'),
    settings: z.string().max(50),
  }),
]);

type StoredSettings = typeof DEFAULT_SETTINGS;

// GET user settings
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user settings from Prisma
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user || !user.settings) {
      // No settings stored yet — return defaults
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    // Merge stored settings with defaults (in case new fields were added)
    const stored = user.settings as Partial<StoredSettings>;
    const merged = {
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications || {}) },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...(stored.privacy || {}) },
      theme: stored.theme || DEFAULT_SETTINGS.theme,
      language: stored.language || DEFAULT_SETTINGS.language,
      timezone: stored.timezone || DEFAULT_SETTINGS.timezone,
    };

    return NextResponse.json({ settings: merged });
  } catch (error: unknown) {
    logger.error('Settings fetch error:', error);
    // Return defaults instead of 500 — settings are non-critical
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

// UPDATE user settings
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validationResult = settingsUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
          message: 'Valid types: notifications, privacy, theme, language, timezone'
        },
        { status: 400 }
      );
    }

    const { type, settings: newValue } = validationResult.data;

    // Read current settings (or use defaults)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const currentSettings = (user?.settings as Partial<StoredSettings>) || {};

    // Merge the updated section into current settings
    const updatedSettings: Record<string, unknown> = {
      ...DEFAULT_SETTINGS,
      ...currentSettings,
    };

    switch (type) {
      case 'notifications':
        updatedSettings.notifications = {
          ...DEFAULT_SETTINGS.notifications,
          ...(currentSettings.notifications || {}),
          ...newValue,
        };
        break;
      case 'privacy':
        updatedSettings.privacy = {
          ...DEFAULT_SETTINGS.privacy,
          ...(currentSettings.privacy || {}),
          ...newValue,
        };
        break;
      case 'theme':
        updatedSettings.theme = newValue;
        break;
      case 'language':
        updatedSettings.language = newValue;
        break;
      case 'timezone':
        updatedSettings.timezone = newValue;
        break;
    }

    // Save to Prisma
    await prisma.user.update({
      where: { id: userId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      message: 'Settings updated successfully'
    });
  } catch (error: unknown) {
    logger.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
