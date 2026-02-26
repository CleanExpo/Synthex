/**
 * Integrations API Route
 * GET /api/integrations - Get user integrations
 * POST /api/integrations - Connect a new integration
 * DELETE /api/integrations - Disconnect an integration
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * DB: Uses Supabase service-role client to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { z } from 'zod';

const connectIntegrationSchema = z.object({
  platform: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  profile: z.record(z.unknown()).optional(),
});

// GET user integrations
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get user integrations from database
    const { data: integrations, error } = await supabase
      .from('social_integrations')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      // Table might not exist — return empty integrations
      console.error('Integrations fetch error:', error);
      return NextResponse.json({
        integrations: {
          twitter: false,
          linkedin: false,
          instagram: false,
          facebook: false,
          tiktok: false,
        },
        raw: [],
      });
    }

    // Format integrations for frontend
    const formattedIntegrations: Record<string, boolean> = {
      twitter: false,
      linkedin: false,
      instagram: false,
      facebook: false,
      tiktok: false,
    };

    integrations?.forEach(integration => {
      if (integration.platform && integration.is_active) {
        const platform = integration.platform.toLowerCase();
        if (platform in formattedIntegrations) {
          formattedIntegrations[platform] = true;
        }
      }
    });

    return NextResponse.json({ integrations: formattedIntegrations, raw: integrations });
  } catch (error) {
    console.error('Integrations fetch error:', error);
    // Return empty integrations instead of 500 — non-critical feature
    return NextResponse.json({
      integrations: {
        twitter: false,
        linkedin: false,
        instagram: false,
        facebook: false,
        tiktok: false,
      },
      raw: [],
    });
  }
}

// POST - Connect a new integration
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = connectIntegrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { platform, accessToken, refreshToken, profile } = validation.data;

    const supabase = createServerClient();

    // Check if integration already exists
    const { data: existing } = await supabase
      .from('social_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    let result;
    if (existing) {
      // Update existing integration
      const { data, error } = await supabase
        .from('social_integrations')
        .update({
          access_token: accessToken || existing.access_token,
          refresh_token: refreshToken || existing.refresh_token,
          profile_data: profile || existing.profile_data,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new integration
      const { data, error } = await supabase
        .from('social_integrations')
        .insert([{
          user_id: userId,
          platform,
          access_token: accessToken,
          refresh_token: refreshToken,
          profile_data: profile,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      integration: result,
      message: `Connected to ${platform} successfully`
    });
  } catch (error) {
    console.error('Integration connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect integration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect an integration
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from('social_integrations')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', platform);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${platform} successfully`
    });
  } catch (error) {
    console.error('Integration disconnection error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
