/**
 * Shared Authentication Types
 *
 * Canonical definitions for auth-related interfaces used across
 * both client-side (auth-service) and server-side (signInFlow) code.
 *
 * @module types/auth
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider?: 'email' | 'google' | 'github' | 'demo';
  emailVerified?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
  requiresVerification?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  session?: {
    accessToken: string;
    expiresAt: number;
  };
  error?: string;
  demoMode?: boolean;
  requiresVerification?: boolean;
}
