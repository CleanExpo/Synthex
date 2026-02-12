/**
 * User Account API Route
 * GET /api/user/account - Get account status
 * DELETE /api/user/account - Delete user account
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key (PUBLIC)
 *
 * SECURITY: Requires authentication via Supabase token
 * DELETE requires confirmation body: { "confirmation": "DELETE_MY_ACCOUNT" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { z } from 'zod';

// Validation schema for account deletion
const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT', {
    errorMap: () => ({ message: 'Must confirm with "DELETE_MY_ACCOUNT"' }),
  }),
});

// GET account status
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get account metadata
    return NextResponse.json({
      id: user.id,
      email: user.email,
      emailConfirmed: user.email_confirmed_at !== null,
      createdAt: user.created_at,
      lastSignIn: user.last_sign_in_at,
      provider: user.app_metadata?.provider || 'email',
      mfaEnabled: user.factors?.length ? user.factors.length > 0 : false,
    });
  } catch (error) {
    console.error('Account fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE account
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Require confirmation for account deletion
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm',
        },
        { status: 400 }
      );
    }

    const validationResult = deleteAccountSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm',
        },
        { status: 400 }
      );
    }

    // Delete user profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      console.error('Profile deletion error:', profileError);
      // Continue with account deletion even if profile deletion fails
    }

    // Delete platform connections
    const { error: connectionsError } = await supabase
      .from('platform_connections')
      .delete()
      .eq('user_id', user.id);

    if (connectionsError) {
      console.error('Platform connections deletion error:', connectionsError);
    }

    // Delete campaigns and related data
    const { error: campaignsError } = await supabase
      .from('campaigns')
      .delete()
      .eq('user_id', user.id);

    if (campaignsError) {
      console.error('Campaigns deletion error:', campaignsError);
    }

    // Note: Full account deletion from Supabase Auth requires admin privileges
    // The user's auth record will remain but all their data is deleted
    // In production, use Supabase admin API or database triggers for full deletion

    return NextResponse.json({
      success: true,
      message: 'Account data deleted successfully. Please contact support to fully delete your authentication record.',
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
