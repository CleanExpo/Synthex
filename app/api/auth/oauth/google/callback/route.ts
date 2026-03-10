/**
 * Google OAuth Callback Route
 *
 * Handles the OAuth 2.0 callback from Google, exchanges the authorization
 * code for tokens, and creates/links user accounts.
 *
 * @route GET /api/auth/oauth/google/callback
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - GOOGLE_CLIENT_ID: Google OAuth client ID (CRITICAL)
 * - GOOGLE_CLIENT_SECRET: Google OAuth client secret (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application base URL
 * - JWT_SECRET: Secret for JWT token generation (CRITICAL)
 *
 * FAILURE MODE: Redirects to /login with error message
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { generateToken, isOwnerEmail } from '@/lib/auth/jwt-utils';
import { retrievePKCEState } from '@/lib/auth/pkce';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = ReturnType<typeof createClient<any>>;

// Create Supabase admin client (bypasses RLS, uses REST API instead of connection pooler)
function getSupabaseAdmin(): SupabaseAdmin {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Google OAuth configuration
const GOOGLE_CONFIG = {
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
};

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  // Require NEXT_PUBLIC_APP_URL in production
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL must be configured' },
      { status: 500 }
    );
  }
  const effectiveBaseUrl = baseUrl || 'http://localhost:3000';

  try {
    // Parse callback parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      logger.error('[Google OAuth] Error from Google:', error, errorDescription);
      return redirectWithError(effectiveBaseUrl, errorDescription || error);
    }

    // Validate required parameters
    if (!code || !state) {
      return redirectWithError(effectiveBaseUrl, 'Missing authorization code or state');
    }

    // Retrieve and verify PKCE state
    const pkceState = await retrievePKCEState(state.split('|')[0]); // Handle state|returnTo format

    if (!pkceState) {
      return redirectWithError(effectiveBaseUrl, 'Invalid or expired state. Please try again.');
    }

    // Validate Google OAuth is configured
    if (!GOOGLE_CONFIG.clientId || !GOOGLE_CONFIG.clientSecret) {
      return redirectWithError(effectiveBaseUrl, 'Google OAuth not configured');
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      pkceState.codeVerifier,
      pkceState.redirectUri
    );

    if (!tokens) {
      return redirectWithError(effectiveBaseUrl, 'Failed to exchange authorization code');
    }

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.accessToken);

    if (!googleUser) {
      return redirectWithError(effectiveBaseUrl, 'Failed to get user information from Google');
    }

    // Create Supabase admin client for database operations (uses REST API, not connection pooler)
    const supabaseAdmin = getSupabaseAdmin();

    // Check if this is an account linking flow
    if (pkceState.linkToUserId) {
      // Link Google to existing user using legacy google_id field
      try {
        const { error: linkError } = await supabaseAdmin
          .from('users')
          .update({
            google_id: googleUser.id,
            avatar: googleUser.picture || null,
            auth_provider: 'google',
            email_verified: googleUser.verified_email ? true : false,
          })
          .eq('id', pkceState.linkToUserId);

        if (linkError) throw linkError;
      } catch (error) {
        logger.error('[Google OAuth] Link error:', error);
        return redirectWithError(effectiveBaseUrl, 'Failed to link Google account');
      }

      // Redirect to account settings with success
      return NextResponse.redirect(
        `${effectiveBaseUrl}/dashboard/settings/accounts?linked=google`
      );
    }

    // Regular login/signup flow
    // Check if user exists by Google ID (legacy field on User table)
    const { data: existingByGoogleId } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('google_id', googleUser.id)
      .maybeSingle();

    if (existingByGoogleId) {
      // Existing Google user - login
      // Ensure profiles row exists (may be missing for users created before onboarding migration)
      await ensureProfileExists(supabaseAdmin, existingByGoogleId.id, existingByGoogleId.email, googleUser.name, googleUser.picture);
      const session = await createSessionForUser(supabaseAdmin, existingByGoogleId.id, googleUser, tokens);
      return redirectWithSession(effectiveBaseUrl, session);
    }

    // Check if user exists by email
    const { data: existingByEmail } = await supabaseAdmin
      .from('users')
      .select('id, email, password, google_id')
      .eq('email', googleUser.email)
      .maybeSingle();

    if (existingByEmail) {
      // User exists with this email
      if (existingByEmail.password && !existingByEmail.google_id) {
        // User has password but no Google linked - offer to link accounts
        const params = new URLSearchParams({
          error: 'account_exists',
          email: googleUser.email,
          existingProvider: 'email',
          newProvider: 'google',
        });
        return NextResponse.redirect(`${effectiveBaseUrl}/login?${params.toString()}`);
      }

      // No password or already has Google - auto-link Google and login
      await supabaseAdmin
        .from('users')
        .update({
          google_id: googleUser.id,
          avatar: googleUser.picture || null,
          auth_provider: 'google',
          email_verified: googleUser.verified_email ? true : false,
        })
        .eq('id', existingByEmail.id);

      // Login the existing user — ensure profile exists
      await ensureProfileExists(supabaseAdmin, existingByEmail.id, existingByEmail.email, googleUser.name, googleUser.picture);
      const session = await createSessionForUser(supabaseAdmin, existingByEmail.id, googleUser, tokens);
      return redirectWithSession(effectiveBaseUrl, session);
    }

    // New user - create account
    const newUser = await createNewGoogleUser(supabaseAdmin, googleUser);
    // Create profiles row with onboarding_completed = false (triggers onboarding flow)
    await ensureProfileExists(supabaseAdmin, newUser.id, googleUser.email, googleUser.name, googleUser.picture);
    const session = await createSessionForUser(supabaseAdmin, newUser.id, googleUser, tokens);

    return redirectWithSession(effectiveBaseUrl, session);
  } catch (error) {
    logger.error('[Google OAuth] Callback error:', error);
    return redirectWithError(
      effectiveBaseUrl,
      error instanceof Error ? error.message : 'Authentication failed'
    );
  }
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Ensure a profiles row exists for the user (required for onboarding redirect).
 * Uses upsert semantics — safe to call on every login (idempotent).
 */
async function ensureProfileExists(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  email: string,
  name?: string,
  avatar?: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          name: name || null,
          avatar_url: avatar || null,
          // Only set onboarding_completed = false for NEW rows (ON CONFLICT DO NOTHING for this field)
          onboarding_completed: false,
        },
        {
          onConflict: 'id',
          ignoreDuplicates: true, // Don't overwrite existing profiles (preserves onboarding_completed)
        }
      );

    if (error) {
      logger.warn('[Google OAuth] Failed to ensure profile exists:', error.message);
      // Non-fatal — user can still log in, onboarding check will be skipped
    }
  } catch (err) {
    logger.warn('[Google OAuth] Error ensuring profile:', err);
  }
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
} | null> {
  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: GOOGLE_CONFIG.clientId!,
      client_secret: GOOGLE_CONFIG.clientSecret!,
      code_verifier: codeVerifier,
    });

    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Google OAuth] Token exchange failed:', errorText);
      return null;
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : undefined,
      tokenType: data.token_type,
      scope: data.scope,
      idToken: data.id_token,
    };
  } catch (error) {
    logger.error('[Google OAuth] Token exchange error:', error);
    return null;
  }
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(GOOGLE_CONFIG.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.error('[Google OAuth] User info request failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error('[Google OAuth] User info error:', error);
    return null;
  }
}

async function createNewGoogleUser(
  supabaseAdmin: SupabaseAdmin,
  googleUser: GoogleUserInfo,
): Promise<{ id: string }> {
  // Create user (password is null for OAuth-only users)
  const userId = randomUUID();
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      id: userId,
      email: googleUser.email,
      password: null,
      name: googleUser.name || googleUser.email.split('@')[0],
      avatar: googleUser.picture,
      google_id: googleUser.id,
      auth_provider: 'google',
      email_verified: googleUser.verified_email ? true : false,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[Google OAuth] Create user error:', error);
    throw new Error('Failed to create user account');
  }

  return { id: data.id };
}

async function createSessionForUser(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  googleUser: GoogleUserInfo,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }
): Promise<{
  accessToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  };
}> {
  // Owner bypass: auto-fix DB flags so owner never gets gated
  const ownerBypass = isOwnerEmail(googleUser.email);

  // Update last login (and fix owner flags if applicable)
  await supabaseAdmin
    .from('users')
    .update({
      last_login: new Date().toISOString(),
      ...(ownerBypass ? { onboarding_complete: true, api_key_configured: true } : {}),
    })
    .eq('id', userId);

  // Generate JWT token directly (bypass signInFlow to avoid Account table)
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  const accessToken = generateToken({
    userId,
    email: googleUser.email,
    // Owner bypass: force full-access flags in JWT
    ...(ownerBypass ? { onboardingComplete: true, apiKeyConfigured: true } : {}),
  });

  return {
    accessToken,
    expiresAt,
    user: {
      id: userId,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
    },
  };
}

function redirectWithSession(
  effectiveBaseUrl: string,
  session: {
    accessToken: string;
    expiresAt: number;
    user: { id: string; email: string; name?: string; avatar?: string };
  }
): NextResponse {
  // Create redirect response
  const redirectUrl = new URL('/dashboard', effectiveBaseUrl);

  // Add success indicator
  redirectUrl.searchParams.set('auth', 'success');

  const response = NextResponse.redirect(redirectUrl);

  // Set auth cookie
  response.cookies.set('auth-token', session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  // Set user info cookie (non-sensitive, for client-side)
  response.cookies.set(
    'user-info',
    JSON.stringify({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatar: session.user.avatar,
    }),
    {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    }
  );

  return response;
}

function redirectWithError(effectiveBaseUrl: string, error: string): NextResponse {
  // Use /login — the active login page with our custom PKCE Google flow
  // lives at app/(auth)/login/page.tsx which resolves to /login
  const redirectUrl = new URL('/login', effectiveBaseUrl);
  // URLSearchParams.set() already encodes — no manual encodeURIComponent needed
  redirectUrl.searchParams.set('error', error);
  return NextResponse.redirect(redirectUrl);
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
