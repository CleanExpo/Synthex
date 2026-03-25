/**
 * User Account API Route
 * GET /api/user/account - Get account status
 * DELETE /api/user/account - Delete user account
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin auth deletion (SECRET)
 *
 * SECURITY: Requires authentication via Supabase token
 * DELETE requires confirmation body: { "confirmation": "DELETE_MY_ACCOUNT" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { logAuditEvent } from '@/lib/audit/audit-logger';

// Validation schema for account deletion
const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT', {
    error: () => ({ message: 'Must confirm with "DELETE_MY_ACCOUNT"' }),
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    logger.error('Account fetch error:', error);
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Audit: record that deletion was requested before any data is removed
    await logAuditEvent({
      event: 'account.deletion_requested',
      userId: user.id,
      metadata: { provider: user.app_metadata?.provider ?? 'unknown' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    // Delete all user data — collect errors before touching the auth record.
    // GDPR Art. 17: auth deletion must not proceed if any DB deletion fails,
    // as that would leave orphaned rows with no way to re-attempt erasure.
    const dbErrors: string[] = [];

    // Delete user profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      dbErrors.push(`profiles: ${profileError.message}`);
    }

    // Delete platform connections
    const { error: connectionsError } = await supabase
      .from('platform_connections')
      .delete()
      .eq('user_id', user.id);

    if (connectionsError) {
      dbErrors.push(`platform_connections: ${connectionsError.message}`);
    }

    // Delete campaigns and related data
    const { error: campaignsError } = await supabase
      .from('campaigns')
      .delete()
      .eq('user_id', user.id);

    if (campaignsError) {
      dbErrors.push(`campaigns: ${campaignsError.message}`);
    }

    // Gate auth deletion — if any DB deletion failed, stop here so the user
    // record is preserved and the operation can be retried / investigated.
    if (dbErrors.length > 0) {
      logger.error('Account data deletion failed:', dbErrors);
      return NextResponse.json(
        {
          error:
            'Account deletion failed. Please try again or contact support.',
        },
        { status: 500 }
      );
    }

    // All DB data deleted — now remove auth record (GDPR Art. 17 right to erasure)
    const adminClient = createServerClient();
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(
      user.id
    );
    if (authDeleteError) {
      logger.error('Auth record deletion failed:', authDeleteError);
      return NextResponse.json(
        {
          error:
            'Account data deleted but authentication record removal failed. Contact support.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully.',
    });
  } catch (error) {
    logger.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
