/**
 * Onboarding API Route
 *
 * @description Handles saving onboarding data and creating resources
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getAuthUser } from '@/lib/supabase-server';
import { webhookHandler } from '@/lib/webhooks';

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingData {
  organizationName: string;
  industry: string;
  teamSize: string;
  connectedPlatforms: string[];
  personaName: string;
  personaTone: string;
  personaTopics: string[];
  skipPersona: boolean;
}

// ============================================================================
// POST - Save Onboarding Data
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Verify authentication
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: OnboardingData = await request.json();

    // Validate required fields
    if (!data.organizationName || !data.industry || !data.teamSize) {
      return NextResponse.json(
        { error: 'Missing required organization fields' },
        { status: 400 }
      );
    }

    // Create or update organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .upsert(
        {
          name: data.organizationName,
          industry: data.industry,
          team_size: data.teamSize,
          owner_id: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'owner_id',
        }
      )
      .select()
      .single();

    if (orgError) {
      console.error('Failed to create organization:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Create persona if not skipped
    let persona = null;
    if (!data.skipPersona && data.personaName && data.personaTone) {
      const { data: personaData, error: personaError } = await supabase
        .from('personas')
        .upsert(
          {
            name: data.personaName,
            tone: data.personaTone,
            topics: data.personaTopics || [],
            organization_id: organization.id,
            user_id: user.id,
            is_default: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'organization_id,is_default',
          }
        )
        .select()
        .single();

      if (personaError) {
        console.error('Failed to create persona:', personaError);
        // Non-fatal - continue without persona
      } else {
        persona = personaData;
      }
    }

    // Update user profile with onboarding completion
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
    }

    // Emit webhook event for onboarding completion
    try {
      await webhookHandler.emit(
        'onboarding.completed' as any,
        {
          organization: {
            name: data.organizationName,
            industry: data.industry,
            teamSize: data.teamSize,
          },
          connectedPlatforms: data.connectedPlatforms,
          hasPersona: !data.skipPersona,
          persona: persona
            ? {
                name: persona.name,
                tone: persona.tone,
              }
            : null,
          timestamp: new Date().toISOString(),
        },
        {
          userId: user.id,
          organizationId: organization.id,
        }
      );
    } catch (webhookError) {
      console.error('Failed to emit onboarding webhook:', webhookError);
      // Non-fatal - continue
    }

    return NextResponse.json({
      success: true,
      organization,
      persona,
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Onboarding Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Verify authentication
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile with onboarding status
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_completed_at')
      .eq('id', user.id)
      .single();

    // Get organization
    const { data: organization } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    // Get default persona
    const { data: persona } = await supabase
      .from('personas')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    // Get connected platforms
    const { data: connections } = await supabase
      .from('platform_connections')
      .select('platform')
      .eq('user_id', user.id)
      .eq('is_active', true);

    return NextResponse.json({
      completed: profile?.onboarding_completed || false,
      completedAt: profile?.onboarding_completed_at || null,
      organization: organization || null,
      persona: persona || null,
      connectedPlatforms: connections?.map((c: { platform: string }) => c.platform) || [],
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
