import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

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
  } catch (error: any) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
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
    const { type, settings } = body;

    // Get current settings
    const { data: currentSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let updatedData = {};

    switch (type) {
      case 'notifications':
        updatedData = {
          notifications: settings,
          updated_at: new Date().toISOString()
        };
        break;
      case 'privacy':
        updatedData = {
          privacy: settings,
          updated_at: new Date().toISOString()
        };
        break;
      case 'theme':
        updatedData = {
          theme: settings,
          updated_at: new Date().toISOString()
        };
        break;
      case 'language':
        updatedData = {
          language: settings,
          updated_at: new Date().toISOString()
        };
        break;
      case 'timezone':
        updatedData = {
          timezone: settings,
          updated_at: new Date().toISOString()
        };
        break;
      default:
        updatedData = {
          ...settings,
          updated_at: new Date().toISOString()
        };
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
  } catch (error: any) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}