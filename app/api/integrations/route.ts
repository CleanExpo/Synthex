import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

// GET user integrations
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

    // Get user integrations from database
    const { data: integrations, error } = await supabase
      .from('social_integrations')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    // Format integrations for frontend
    const formattedIntegrations = {
      twitter: false,
      linkedin: false,
      instagram: false,
      facebook: false,
      tiktok: false,
    };

    integrations?.forEach(integration => {
      if (integration.platform && integration.is_active) {
        const platform = integration.platform.toLowerCase() as keyof typeof formattedIntegrations;
        if (platform in formattedIntegrations) {
          formattedIntegrations[platform] = true;
        }
      }
    });

    return NextResponse.json({ integrations: formattedIntegrations, raw: integrations });
  } catch (error) {
    console.error('Integrations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST - Connect a new integration
export async function POST(request: NextRequest) {
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
    const { platform, accessToken, refreshToken, profile } = body;

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Check if integration already exists
    const { data: existing } = await supabase
      .from('social_integrations')
      .select('*')
      .eq('user_id', user.id)
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
          user_id: user.id,
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from('social_integrations')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
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