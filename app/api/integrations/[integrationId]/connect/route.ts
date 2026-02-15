import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { IntegrationService, IntegrationPlatform } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const connectCredentialsSchema = z.object({
  accountName: z.string().optional(),
}).passthrough();

// Initialize Supabase client for auth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    const body = await request.json();
    const bodyValidation = connectCredentialsSchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: bodyValidation.error.issues },
        { status: 400 }
      );
    }

    // Get user from session
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Integration service not configured' },
        { status: 503 }
      );
    }
    
    // Initialize Supabase client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate integration platform
    const validPlatforms: IntegrationPlatform[] = [
      'twitter', 'linkedin', 'instagram', 'facebook', 'tiktok',
      'youtube', 'pinterest', 'threads'
    ];
    
    if (!validPlatforms.includes(integrationId as IntegrationPlatform)) {
      return NextResponse.json(
        { error: 'Invalid integration platform' },
        { status: 400 }
      );
    }
    
    // Validate credentials
    const validation = IntegrationService.validateCredentials(
      integrationId as IntegrationPlatform,
      body
    );
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Missing required credentials',
          missing: validation.missing 
        },
        { status: 400 }
      );
    }
    
    // Connect the integration
    const integration = await IntegrationService.connectIntegration(
      user.id,
      integrationId as IntegrationPlatform,
      body,
      body.accountName || `@${integrationId}_user`
    );
    
    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: integration.platform,
        connected: true,
        accountName: integration.account_name,
        connectedAt: integration.connected_at,
        status: integration.status
      }
    });
  } catch (error: unknown) {
    console.error('Error connecting integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) || 'Failed to connect integration' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    
    // Get user from session
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Integration service not configured' },
        { status: 503 }
      );
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get user's integrations
    const integrations = await IntegrationService.getUserIntegrations(user.id);
    const integration = integrations.find(i => i.platform === integrationId);
    
    if (!integration) {
      return NextResponse.json({
        id: integrationId,
        connected: false
      });
    }
    
    return NextResponse.json({
      id: integration.id,
      platform: integration.platform,
      connected: integration.status === 'active',
      accountName: integration.account_name,
      connectedAt: integration.connected_at,
      status: integration.status,
      lastUsed: integration.last_used
    });
  } catch (error: unknown) {
    console.error('Error getting integration status:', error);
    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    
    // Get user from session
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Integration service not configured' },
        { status: 503 }
      );
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Disconnect the integration
    await IntegrationService.disconnectIntegration(
      user.id,
      integrationId as IntegrationPlatform
    );
    
    return NextResponse.json({
      success: true,
      message: 'Integration disconnected successfully'
    });
  } catch (error: unknown) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}