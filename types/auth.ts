/**
 * Shared Authentication Types
 *
 * Canonical definitions for auth-related interfaces used across
 * both client-side (auth-service) and server-side (signInFlow) code.
 *
 * @module types/auth
 */

// ==========================================
// Core Auth Types
// ==========================================

export type AuthProvider = 'email' | 'google' | 'github' | 'demo';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider?: AuthProvider;
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
  /** Indicates an account exists with a different provider */
  existingProvider?: AuthProvider;
  /** Email of the existing account (for linking flow) */
  existingEmail?: string;
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
  existingProvider?: AuthProvider;
}

// ==========================================
// OAuth Types
// ==========================================

export interface OAuthProfile {
  id: string;          // Provider's unique ID (Google ID, GitHub ID, etc.)
  email: string;
  name?: string;
  avatar?: string;
  emailVerified?: boolean;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;   // Unix timestamp
  tokenType?: string;
  scope?: string;
  idToken?: string;
}

export interface OAuthCallbackData {
  code: string;
  state: string;
  codeVerifier?: string;  // For PKCE
}

export interface OAuthInitiateResponse {
  authorizationUrl: string;
  state: string;
}

// ==========================================
// Account Linking Types
// ==========================================

export interface LinkedAccount {
  id: string;
  provider: AuthProvider;
  providerAccountId: string;
  createdAt: Date;
  /** Whether this is the primary/current auth method */
  isPrimary?: boolean;
}

export interface AccountLinkResult {
  success: boolean;
  account?: LinkedAccount;
  error?: string;
  /** If account exists with different user */
  conflictEmail?: string;
}

export interface AccountUnlinkResult {
  success: boolean;
  error?: string;
  /** Remaining auth methods after unlink */
  remainingMethods?: AuthProvider[];
}

export interface CanUnlinkResult {
  canUnlink: boolean;
  reason?: string;
  /** Auth methods that would remain after unlinking */
  remainingMethods?: AuthProvider[];
}

// ==========================================
// PKCE Types
// ==========================================

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface PKCEState {
  state: string;
  codeVerifier: string;
  provider: AuthProvider;
  redirectUri: string;
  /** Optional: link to existing user instead of creating new */
  linkToUserId?: string;
  createdAt: number;
  expiresAt: number;
}
