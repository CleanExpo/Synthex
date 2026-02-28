/**
 * Centralized Authentication Flow Service
 * Single source of truth for ALL authentication methods
 * This ensures consistency across OAuth and email/password flows
 *
 * @module lib/auth/signInFlow
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Secret for JWT token generation (CRITICAL)
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (optional)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key (optional)
 *
 * FAILURE MODE: Returns error if Supabase not configured
 */

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import type { AuthUser, AuthSession, AuthResult, AuthProvider, OAuthProfile } from '@/types/auth';
import { accountService } from './account-service';
import { isOwnerEmail } from './jwt-utils';
import { AuthMonitor } from './monitoring';
import prisma from '@/lib/prisma';

// Supabase admin client for profiles table operations (bypasses RLS)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Re-export for backward compatibility
export type { AuthUser, AuthSession, AuthResult } from '@/types/auth';

// Environment configuration with fallbacks
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// JWT_SECRET must be set in production - no fallback allowed
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret && IS_PRODUCTION) {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  // Only allow fallback in development/test for local development convenience
  return secret || 'dev-secret-change-in-production';
})();

// Initialize Supabase client once
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** OAuth user data from provider */
interface OAuthUserData {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/** Decoded JWT payload */
interface JWTPayload {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
}

/**
 * Central authentication flow - ALL auth methods MUST use this
 */
export class SignInFlow {
  private static instance: SignInFlow;
  
  private constructor() {}
  
  static getInstance(): SignInFlow {
    if (!SignInFlow.instance) {
      SignInFlow.instance = new SignInFlow();
    }
    return SignInFlow.instance;
  }

  /**
   * Main authentication entry point
   */
  async authenticate(
    method: 'email' | 'oauth',
    credentials: {
      email?: string;
      password?: string;
      provider?: 'google' | 'github';
      oauthToken?: string;
      oauthUser?: OAuthUserData;
    }
  ): Promise<AuthResult> {
    try {
      // Log authentication attempt (for monitoring)
      await this.logAuthAttempt(method, credentials.email || 'unknown');

      let authResult: AuthResult;

      switch (method) {
        case 'email':
          authResult = await this.handleEmailAuth(credentials.email!, credentials.password!);
          break;
        case 'oauth':
          authResult = await this.handleOAuthAuth(credentials.provider!, credentials.oauthUser);
          break;
        default:
          throw new Error('Invalid authentication method');
      }

      // If successful, create session
      if (authResult.success && authResult.session) {
        await this.createSession(authResult.session);
        await this.logAuthSuccess(method, authResult.session.user.email);
      } else {
        await this.logAuthFailure(method, credentials.email || 'unknown', authResult.error);
      }

      return authResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logAuthError(method, credentials.email || 'unknown', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Handle email/password authentication
   */
  private async handleEmailAuth(email: string, password: string): Promise<AuthResult> {
    // Check if Supabase is configured
    if (!this.isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Authentication service not configured. Please contact support.'
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Check if the user registered with a different auth provider (e.g. Google OAuth),
        // so we can return a specific recovery hint instead of a generic error.
        try {
          const prismaUser = await prisma.user.findUnique({
            where: { email },
            select: { authProvider: true },
          });
          if (
            prismaUser?.authProvider &&
            prismaUser.authProvider !== 'local' &&
            prismaUser.authProvider !== 'email'
          ) {
            const provider = prismaUser.authProvider as AuthProvider;
            return {
              success: false,
              error: `This account uses ${provider === 'google' ? 'Google' : provider} sign-in. Please use the button below.`,
              existingProvider: provider,
            };
          }
        } catch {
          // Ignore DB lookup failure — fall through to generic error
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Ensure profiles row exists for onboarding redirect check
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          await admin.from('profiles').upsert(
            {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.name || null,
              onboarding_completed: false,
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        }
      } catch (profileErr) {
        console.warn('[SignInFlow] Failed to ensure profile exists:', profileErr);
        // Non-fatal — user can still authenticate
      }

      // Auto-fix DB flags for owner on login (fire-and-forget)
      if (isOwnerEmail(data.user.email)) {
        prisma.user.updateMany({
          where: { email: data.user.email! },
          data: { onboardingComplete: true, apiKeyConfigured: true },
        }).catch(() => { /* non-fatal */ });
      }

      // Create unified session
      // IMPORTANT: Always use our own JWT (signed with JWT_SECRET) for the accessToken.
      // Supabase's access_token is signed with Supabase's JWT secret, which doesn't
      // match our JWT_SECRET used by jwt-utils.ts for verification.
      const session: AuthSession = {
        user: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name,
          avatar: data.user.user_metadata?.avatar_url,
          provider: 'email',
          emailVerified: !!data.user.confirmed_at
        },
        accessToken: this.generateJWT(data.user.id, data.user.email),
        refreshToken: data.session?.refresh_token,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
      };

      return {
        success: true,
        session,
        requiresVerification: !data.user.confirmed_at
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Handle OAuth authentication (Google/GitHub)
   * Now uses AccountService for proper multi-provider support
   */
  private async handleOAuthAuth(provider: 'google' | 'github', oauthUser: OAuthUserData | undefined): Promise<AuthResult> {
    try {
      if (!oauthUser || !oauthUser.email) {
        return {
          success: false,
          error: 'Invalid OAuth response'
        };
      }

      // Use AccountService to handle OAuth login
      return this.handleOAuthLogin(provider, {
        id: oauthUser.id,
        email: oauthUser.email,
        name: oauthUser.name ?? undefined,
        avatar: oauthUser.image ?? undefined,
        emailVerified: true,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      };
    }
  }

  /**
   * Handle OAuth login with account lookup and linking logic
   * This is the main entry point for OAuth authentication
   */
  async handleOAuthLogin(
    provider: AuthProvider,
    profile: OAuthProfile
  ): Promise<AuthResult> {
    try {
      // 1. Check if this OAuth account is already linked
      const existingByProvider = await accountService.findUserByProviderAccount(
        provider,
        profile.id
      );

      if (existingByProvider) {
        // Existing OAuth user - create session
        const user = await prisma.user.findUnique({
          where: { id: existingByProvider.userId },
        });

        if (!user) {
          return { success: false, error: 'User not found' };
        }

        // Update last login + auto-fix owner DB flags
        const ownerBypass = isOwnerEmail(user.email);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            ...(ownerBypass ? { onboardingComplete: true, apiKeyConfigured: true } : {}),
          },
        });

        const session: AuthSession = {
          user: {
            id: user.id,
            email: user.email,
            name: user.name || undefined,
            avatar: user.avatar || profile.avatar,
            provider,
            // Convert Date|null from database to boolean for session
            emailVerified: !!user.emailVerified,
          },
          accessToken: this.generateJWT(user.id, user.email),
          expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
        };

        return { success: true, session };
      }

      // 2. Check if user exists by email (potential linking scenario)
      const existingByEmail = await accountService.findUserByEmail(profile.email);

      if (existingByEmail) {
        // User exists with this email - check providers
        const existingProviders = existingByEmail.providers;

        if (existingProviders.length > 0) {
          // User has other auth methods - return info for linking prompt
          return {
            success: false,
            error: 'An account with this email already exists',
            existingProvider: existingProviders[0],
            existingEmail: existingByEmail.email,
          };
        }
      }

      // 3. New user - create account (password is null for OAuth-only users)
      const newUser = await prisma.user.create({
        data: {
          email: profile.email,
          password: null, // OAuth-only user - no password
          name: profile.name || profile.email.split('@')[0],
          avatar: profile.avatar,
          googleId: provider === 'google' ? profile.id : null,
          authProvider: provider,
          // Database expects Boolean for emailVerified
          emailVerified: (profile.emailVerified ?? true) ? true : false,
        },
      });

      // Create Account record
      await accountService.createAccount(newUser.id, provider, profile);

      // Ensure profiles row exists for onboarding redirect check
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          await admin.from('profiles').upsert(
            {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name || null,
              avatar_url: profile.avatar || null,
              onboarding_completed: false,
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        }
      } catch (profileErr) {
        console.warn('[SignInFlow] Failed to ensure profile exists for OAuth user:', profileErr);
      }

      const session: AuthSession = {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name || undefined,
          avatar: newUser.avatar || undefined,
          provider,
          // Convert Date|null from database to boolean for session
          emailVerified: !!newUser.emailVerified,
        },
        accessToken: this.generateJWT(newUser.id, newUser.email),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
      };

      return { success: true, session };
    } catch (error) {
      console.error('[SignInFlow] OAuth login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed',
      };
    }
  }

  /**
   * Link an OAuth provider to an existing authenticated user
   */
  async linkOAuthProvider(
    userId: string,
    provider: AuthProvider,
    profile: OAuthProfile
  ): Promise<AuthResult> {
    try {
      const result = await accountService.linkAccount(userId, provider, profile);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to link account',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link account',
      };
    }
  }

  /**
   * Create and persist session
   */
  private async createSession(session: AuthSession): Promise<void> {
    // Store session in database for token revocation support
    try {
      await prisma.session.create({
        data: {
          token: session.accessToken,
          userId: session.user.id,
          expiresAt: new Date(session.expiresAt),
        },
      });
    } catch (error) {
      console.error('Failed to persist session:', error);
      // Continue even if session persistence fails — JWT auth still works
    }
  }

  /**
   * Validate existing session
   */
  async validateSession(accessToken: string): Promise<AuthResult> {
    try {
      // Verify JWT — this is the primary auth check
      const decoded = jwt.verify(accessToken, JWT_SECRET) as JWTPayload;

      if (!decoded || decoded.exp * 1000 <= Date.now()) {
        return { success: false, error: 'Session expired' };
      }

      // JWT is valid — return decoded token data
      return {
        success: true,
        session: {
          user: {
            id: decoded.sub,
            email: decoded.email || 'unknown',
            provider: 'email'
          },
          accessToken,
          expiresAt: decoded.exp * 1000
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid session'
      };
    }
  }

  /**
   * Sign out and destroy session
   */
  async signOut(accessToken: string): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: { token: accessToken },
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Generate JWT token.
   * Includes email and owner bypass flags (onboardingComplete, apiKeyConfigured)
   * so middleware gates work correctly for platform owners.
   */
  private generateJWT(userId: string, email?: string): string {
    const ownerBypass = isOwnerEmail(email);

    const payload: Record<string, unknown> = {
      sub: userId,
      userId, // include both for jwt-utils compatibility
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    if (email) payload.email = email;

    // Owner bypass: force full access flags in JWT
    if (ownerBypass) {
      payload.onboardingComplete = true;
      payload.apiKeyConfigured = true;
    }

    return jwt.sign(payload, JWT_SECRET);
  }

  /**
   * Check if Supabase is properly configured
   */
  private isSupabaseConfigured(): boolean {
    return SUPABASE_URL !== 'https://placeholder.supabase.co' && 
           SUPABASE_ANON_KEY !== 'placeholder-key';
  }

  /**
   * Logging methods for monitoring — delegates to AuthMonitor (Sentry + webhooks)
   */
  private async logAuthAttempt(method: string, email: string): Promise<void> {
    const monitor = AuthMonitor.getInstance();
    await monitor.logEvent({ type: 'attempt', method: method as 'email' | 'oauth' | 'demo', email });
  }

  private async logAuthSuccess(method: string, email: string): Promise<void> {
    const monitor = AuthMonitor.getInstance();
    await monitor.logEvent({ type: 'success', method: method as 'email' | 'oauth' | 'demo', email });
  }

  private async logAuthFailure(method: string, email: string, error?: string): Promise<void> {
    console.error(`[AUTH] Failure: ${method} - ${email} - ${error} - ${new Date().toISOString()}`);
    const monitor = AuthMonitor.getInstance();
    await monitor.logEvent({ type: 'failure', method: method as 'email' | 'oauth' | 'demo', email, error });
  }

  private async logAuthError(method: string, email: string, error: string): Promise<void> {
    console.error(`[AUTH] Error: ${method} - ${email} - ${error} - ${new Date().toISOString()}`);
    const monitor = AuthMonitor.getInstance();
    await monitor.logEvent({ type: 'error', method: method as 'email' | 'oauth' | 'demo', email, error });
  }
}

// Export singleton instance
export const signInFlow = SignInFlow.getInstance();