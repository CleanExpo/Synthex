/**
 * Centralized Authentication Flow Service
 * Single source of truth for ALL authentication methods
 * This ensures consistency across OAuth and email/password flows
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import type { AuthUser, AuthSession, AuthResult } from '@/types/auth';

// Re-export for backward compatibility
export type { AuthUser, AuthSession, AuthResult } from '@/types/auth';

// Environment configuration with fallbacks
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Initialize Supabase client once
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    method: 'email' | 'oauth' | 'demo',
    credentials: {
      email?: string;
      password?: string;
      provider?: 'google' | 'github';
      oauthToken?: string;
      oauthUser?: any;
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
        case 'demo':
          authResult = await this.handleDemoAuth();
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
    // Always check for demo credentials first
    if (email === 'demo@synthex.com' && password === 'demo123') {
      return this.handleDemoAuth();
    }

    // Check if Supabase is configured
    if (!this.isSupabaseConfigured()) {
      return {
        success: false,
        error: 'Authentication service not configured. Use demo@synthex.com / demo123'
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Create unified session
      const session: AuthSession = {
        user: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name,
          avatar: data.user.user_metadata?.avatar_url,
          provider: 'email',
          emailVerified: !!data.user.confirmed_at
        },
        accessToken: data.session?.access_token || this.generateJWT(data.user.id),
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
   */
  private async handleOAuthAuth(provider: 'google' | 'github', oauthUser: any): Promise<AuthResult> {
    if (!this.isSupabaseConfigured()) {
      return {
        success: false,
        error: `${provider} authentication not configured. Please use email/password or demo mode.`
      };
    }

    try {
      // For OAuth, we typically get the user data from the provider callback
      // This assumes NextAuth or similar has already validated the OAuth token
      
      if (!oauthUser || !oauthUser.email) {
        return {
          success: false,
          error: 'Invalid OAuth response'
        };
      }

      // Check if user exists in database
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', oauthUser.email)
        .single();

      let userId = existingUser?.id;

      // Create user if doesn't exist
      if (!existingUser) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: oauthUser.email,
            name: oauthUser.name,
            avatar_url: oauthUser.image,
            provider: provider,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        userId = newUser.id;
      }

      // Create session
      const session: AuthSession = {
        user: {
          id: userId || oauthUser.id,
          email: oauthUser.email,
          name: oauthUser.name,
          avatar: oauthUser.image,
          provider: provider,
          emailVerified: true // OAuth users are pre-verified
        },
        accessToken: this.generateJWT(userId || oauthUser.id),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
      };

      return {
        success: true,
        session
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      };
    }
  }

  /**
   * Handle demo authentication
   */
  private async handleDemoAuth(): Promise<AuthResult> {
    const demoUser: AuthUser = {
      id: 'demo-user-001',
      email: 'demo@synthex.com',
      name: 'Demo User',
      provider: 'demo',
      emailVerified: true
    };

    const session: AuthSession = {
      user: demoUser,
      accessToken: this.generateJWT(demoUser.id),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 1 day for demo
    };

    return {
      success: true,
      session
    };
  }

  /**
   * Create and persist session
   */
  private async createSession(session: AuthSession): Promise<void> {
    // Store session in database for persistence across environments
    if (this.isSupabaseConfigured()) {
      try {
        await supabase.from('sessions').upsert({
          user_id: session.user.id,
          access_token: session.accessToken,
          refresh_token: session.refreshToken,
          expires_at: new Date(session.expiresAt).toISOString(),
          user_data: session.user,
          created_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to persist session:', error);
        // Continue even if session persistence fails
      }
    }
  }

  /**
   * Validate existing session
   */
  async validateSession(accessToken: string): Promise<AuthResult> {
    try {
      // Verify JWT
      const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
      
      // Check if session exists in database
      if (this.isSupabaseConfigured()) {
        const { data: session } = await supabase
          .from('sessions')
          .select('*')
          .eq('access_token', accessToken)
          .single();

        if (session && new Date(session.expires_at) > new Date()) {
          return {
            success: true,
            session: {
              user: session.user_data,
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              expiresAt: new Date(session.expires_at).getTime()
            }
          };
        }
      }

      // For demo tokens, just validate JWT
      if (decoded && decoded.exp * 1000 > Date.now()) {
        return {
          success: true,
          session: {
            user: {
              id: decoded.sub,
              email: decoded.email || 'demo@synthex.com',
              provider: 'demo'
            },
            accessToken,
            expiresAt: decoded.exp * 1000
          }
        };
      }

      return {
        success: false,
        error: 'Session expired'
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
    if (this.isSupabaseConfigured()) {
      try {
        await supabase
          .from('sessions')
          .delete()
          .eq('access_token', accessToken);
        
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
  }

  /**
   * Generate JWT token
   */
  private generateJWT(userId: string): string {
    return jwt.sign(
      {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      },
      JWT_SECRET
    );
  }

  /**
   * Check if Supabase is properly configured
   */
  private isSupabaseConfigured(): boolean {
    return SUPABASE_URL !== 'https://placeholder.supabase.co' && 
           SUPABASE_ANON_KEY !== 'placeholder-key';
  }

  /**
   * Logging methods for monitoring
   */
  private async logAuthAttempt(method: string, email: string): Promise<void> {
    console.log(`[AUTH] Attempt: ${method} - ${email} - ${new Date().toISOString()}`);
    // TODO: Send to monitoring service (Sentry/Datadog)
  }

  private async logAuthSuccess(method: string, email: string): Promise<void> {
    console.log(`[AUTH] Success: ${method} - ${email} - ${new Date().toISOString()}`);
    // TODO: Send to monitoring service
  }

  private async logAuthFailure(method: string, email: string, error?: string): Promise<void> {
    console.error(`[AUTH] Failure: ${method} - ${email} - ${error} - ${new Date().toISOString()}`);
    // TODO: Send to monitoring service
  }

  private async logAuthError(method: string, email: string, error: string): Promise<void> {
    console.error(`[AUTH] Error: ${method} - ${email} - ${error} - ${new Date().toISOString()}`);
    // TODO: Send to monitoring service
  }
}

// Export singleton instance
export const signInFlow = SignInFlow.getInstance();