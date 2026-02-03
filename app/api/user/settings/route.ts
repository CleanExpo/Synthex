/**
 * User Settings API Route
 * GET /api/user/settings - Get user settings
 * PUT /api/user/settings - Update user settings
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key (PUBLIC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

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

// GET user settings
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user settings from database
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no settings exist, create default ones
    if (!settings) {
      const defaultSettings = {
        user_id: user.id,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdSettings, error: createError } = await supabase
        .from('user_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (createError) {
        console.error('Error creating settings:', createError);
      }

      return NextResponse.json({ settings: createdSettings || defaultSettings });
    }

    return NextResponse.json({ settings });
  } catch (error: unknown) {
    console.error('Settings fetch error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: message },
      { status: 500 }
    );
  }
}

// UPDATE user settings
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
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

    const { type, settings } = validationResult.data;

    // Get current settings
    const { data: currentSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Build update data based on validated type
    let updatedData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    switch (type) {
      case 'notifications':
        updatedData.notifications = settings;
        break;
      case 'privacy':
        updatedData.privacy = settings;
        break;
      case 'theme':
        updatedData.theme = settings;
        break;
      case 'language':
        updatedData.language = settings;
        break;
      case 'timezone':
        updatedData.timezone = settings;
        break;
    }

    // Update or create settings
    let result;
    if (currentSettings) {
      const { data, error } = await supabase
        .from('user_settings')
        .update(updatedData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('user_settings')
        .insert([{
          user_id: user.id,
          ...updatedData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      settings: result,
      message: 'Settings updated successfully'
    });
  } catch (error: unknown) {
    console.error('Settings update error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update settings', details: message },
      { status: 500 }
    );
  }
}
