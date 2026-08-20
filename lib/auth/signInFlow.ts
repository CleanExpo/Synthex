/**
 * Centralized Authentication Flow Service
 * Single source of truth for ALL authentication methods
 * This ensures consistency across OAuth and email/password flows
 *
 * @module lib/auth/signInFlow
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Secret for JWT token generation (CRITICAL)
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type {
  AuthUser,
  AuthSession,
  AuthResult,
  AuthProvider,
  OAuthProfile,
} from '@/types/auth';
import { accountService } from './account-service';
import { isOwnerEmail } from './jwt-utils';
import { syncMasterAdminPair } from './master-admin-mirror';
import { isInviteOnlyMode, hasInviteEvidence } from './invite-gate';
import { authMonitor } from './monitoring';
import prisma from '@/lib/prisma';

// Re-export for backward compatibility
export type { AuthUser, AuthSession, AuthResult } from '@/types/auth';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// JWT_SECRET must be set in production - no fallback allowed
// SYN-962/SYN-953: lazy-evaluated (like the Supabase client below) so importing
// this module never throws at build time — the guard runs at request time instead.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && IS_PRODUCTION) {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  // Only allow fallback in development/test for local development convenience
  return secret || 'dev-secret-change-in-production';
}

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
          authResult = await this.handleEmailAuth(
            credentials.email!,
            credentials.password!
          );
          break;
        case 'oauth':
          authResult = await this.handleOAuthAuth(
            credentials.provider!,
            credentials.oauthUser
          );
          break;
        default:
          throw new Error('Invalid authentication method');
      }

      // If successful, create session
      if (authResult.success && authResult.session) {
        await this.createSession(authResult.session);
        await this.logAuthSuccess(method, authResult.session.user.email);
      } else {
        await this.logAuthFailure(
          method,
          credentials.email || 'unknown',
          authResult.error
        );
      }

      return authResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.logAuthError(
        method,
        credentials.email || 'unknown',
        errorMessage
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle email/password authentication
   */
  private async handleEmailAuth(
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const prismaUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          avatar: true,
          authProvider: true,
          emailVerified: true,
          onboardingComplete: true,
          apiKeyConfigured: true,
        },
      });

      if (!prismaUser) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      if (
        prismaUser.authProvider &&
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

      if (!prismaUser.password) {
        return { success: false, error: 'Invalid credentials' };
      }

      const passwordMatches = await bcrypt.compare(
        password,
        prismaUser.password
      );
      if (!passwordMatches) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Auto-fix DB flags for owner on login (fire-and-forget)
      if (isOwnerEmail(prismaUser.email)) {
        prisma.user
          .updateMany({
            where: { email: prismaUser.email },
            data: { onboardingComplete: true, apiKeyConfigured: true },
          })
          .catch(() => {
            /* non-fatal */
          });
      }
      // Reconcile the master-admin pair on login (fire-and-forget, no-op unless configured)
      void syncMasterAdminPair(prismaUser.email);

      // Create unified session
      const session: AuthSession = {
        user: {
          id: prismaUser.id,
          email: prismaUser.email,
          name: prismaUser.name || undefined,
          avatar: prismaUser.avatar || undefined,
          provider: 'email',
          emailVerified: !!prismaUser.emailVerified,
          onboardingComplete: isOwnerEmail(prismaUser.email)
            ? true
            : prismaUser.onboardingComplete,
        },
        accessToken: this.generateJWT(prismaUser.id, prismaUser.email, {
          onboardingComplete: prismaUser.onboardingComplete,
          apiKeyConfigured: prismaUser.apiKeyConfigured,
        }),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      return {
        success: true,
        session,
        requiresVerification: !prismaUser.emailVerified,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Handle OAuth authentication (Google/GitHub)
   * Now uses AccountService for proper multi-provider support
   */
  private async handleOAuthAuth(
    provider: 'google' | 'github',
    oauthUser: OAuthUserData | undefined
  ): Promise<AuthResult> {
    try {
      if (!oauthUser || !oauthUser.email) {
        return {
          success: false,
          error: 'Invalid OAuth response',
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
        error:
          error instanceof Error
            ? error.message
            : 'OAuth authentication failed',
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
            ...(ownerBypass
              ? { onboardingComplete: true, apiKeyConfigured: true }
              : {}),
          },
        });
        // Reconcile the master-admin pair on login (fire-and-forget, no-op unless configured)
        void syncMasterAdminPair(user.email);

        const session: AuthSession = {
          user: {
            id: user.id,
            email: user.email,
            name: user.name || undefined,
            avatar: user.avatar || profile.avatar,
            provider,
            // Convert Date|null from database to boolean for session
            emailVerified: !!user.emailVerified,
            onboardingComplete: ownerBypass ? true : user.onboardingComplete,
          },
          accessToken: this.generateJWT(user.id, user.email, {
            onboardingComplete: user.onboardingComplete,
            apiKeyConfigured: user.apiKeyConfigured,
          }),
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        };

        return { success: true, session };
      }

      // 2. Check if user exists by email (potential linking scenario)
      const existingByEmail = await accountService.findUserByEmail(
        profile.email
      );

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

      // 3. New user — invite-only market gate (fail closed): OAuth
      // first-login must not create an account for an uninvited email.
      if (isInviteOnlyMode() && !(await hasInviteEvidence(profile.email))) {
        return {
          success: false,
          error: 'Signups are invite-only during early access.',
        };
      }

      // New user - create account (password is null for OAuth-only users)
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

      const session: AuthSession = {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name || undefined,
          avatar: newUser.avatar || undefined,
          provider,
          // Convert Date|null from database to boolean for session
          emailVerified: !!newUser.emailVerified,
          onboardingComplete: false,
        },
        accessToken: this.generateJWT(newUser.id, newUser.email, {
          onboardingComplete: false,
          apiKeyConfigured: false,
        }),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      return { success: true, session };
    } catch (error) {
      console.error('[SignInFlow] OAuth login error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'OAuth authentication failed',
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
      const result = await accountService.linkAccount(
        userId,
        provider,
        profile
      );

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
        error:
          error instanceof Error ? error.message : 'Failed to link account',
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
      const decoded = jwt.verify(accessToken, getJwtSecret()) as JWTPayload;

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
            provider: 'email',
          },
          accessToken,
          expiresAt: decoded.exp * 1000,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid session',
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
   * Always stamps onboardingComplete / apiKeyConfigured so the Edge proxy
   * can keep incomplete users on /onboarding. Owner emails still force both
   * flags true.
   */
  private generateJWT(
    userId: string,
    email?: string,
    flags?: { onboardingComplete: boolean; apiKeyConfigured: boolean }
  ): string {
    const ownerBypass = isOwnerEmail(email);

    const payload: Record<string, unknown> = {
      sub: userId,
      userId, // include both for jwt-utils compatibility
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    };

    if (email) payload.email = email;

    if (ownerBypass) {
      payload.onboardingComplete = true;
      payload.apiKeyConfigured = true;
    } else {
      payload.onboardingComplete = flags?.onboardingComplete ?? false;
      payload.apiKeyConfigured = flags?.apiKeyConfigured ?? false;
    }

    return jwt.sign(payload, getJwtSecret());
  }

  /**
   * Logging methods for monitoring — delegates to AuthMonitor for Sentry/alerting
   */
  private async logAuthAttempt(method: string, email: string): Promise<void> {
    authMonitor.trackEvent({ type: 'attempt', method, metadata: { email } });
  }

  private async logAuthSuccess(method: string, email: string): Promise<void> {
    authMonitor.trackEvent({ type: 'success', method, metadata: { email } });
  }

  private async logAuthFailure(
    method: string,
    email: string,
    error?: string
  ): Promise<void> {
    console.error(
      `[AUTH] Failure: ${method} - ${email} - ${error} - ${new Date().toISOString()}`
    );
    authMonitor.trackEvent({
      type: 'failure',
      method,
      metadata: { email, error },
    });
  }

  private async logAuthError(
    method: string,
    email: string,
    error: string
  ): Promise<void> {
    console.error(
      `[AUTH] Error: ${method} - ${email} - ${error} - ${new Date().toISOString()}`
    );
    authMonitor.trackEvent({
      type: 'error',
      method,
      metadata: { email, error },
    });
  }
}

// Export singleton instance
export const signInFlow = SignInFlow.getInstance();
