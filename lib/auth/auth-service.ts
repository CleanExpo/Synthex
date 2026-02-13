/**
 * Authentication Service
 * Centralized auth service that uses our API routes instead of direct Supabase
 */

import type { AuthUser, AuthResponse } from '@/types/auth';

// Re-export for backward compatibility
export type { AuthUser, AuthResponse } from '@/types/auth';

class AuthService {
  private baseUrl = '/api/auth';
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/unified-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          method: 'email',
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        this.currentUser = data.user;
        this.notifyListeners(data.user);
        
        // Store in localStorage for persistence
        if (typeof window !== 'undefined') {
          localStorage.setItem('synthex-user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to sign in',
      };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        // Don't auto-login after signup - require email verification
        return {
          ...data,
          requiresVerification: true,
        };
      }

      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to create account',
      };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Clear local state regardless of API response
      this.currentUser = null;
      this.notifyListeners(null);

      if (typeof window !== 'undefined') {
        // Only clear user profile data from localStorage
        // Auth tokens are managed via httpOnly cookies (cleared by server on logout)
        localStorage.removeItem('synthex-user');
        // Note: Auth tokens are now exclusively in httpOnly cookies (security fix UNI-523)
        // No token data is stored in localStorage to prevent XSS attacks
      }
    }
  }

  /**
   * Get current user from API
   * Checks: in-memory cache → localStorage → user-info cookie → /api/auth/user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      // Check cache first
      if (this.currentUser) {
        return this.currentUser;
      }

      // Check localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('synthex-user');
        if (stored) {
          try {
            this.currentUser = JSON.parse(stored);
            return this.currentUser;
          } catch (e) {
            localStorage.removeItem('synthex-user');
          }
        }

        // Check user-info cookie (set by OAuth callback, non-httpOnly so JS can read it)
        // This bridges the gap between OAuth login (which sets cookies) and
        // the auth service (which reads localStorage). Without this, Google OAuth
        // users appear logged out until the /api/auth/user fetch completes.
        const userInfoCookie = this.getUserInfoFromCookie();
        if (userInfoCookie) {
          this.currentUser = userInfoCookie;
          // Persist to localStorage for future loads
          localStorage.setItem('synthex-user', JSON.stringify(userInfoCookie));
          return this.currentUser;
        }
      }

      // Fetch from API (sends httpOnly auth-token cookie automatically)
      const response = await fetch(`${this.baseUrl}/user`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        // If unauthorized, clear any stored data
        if (response.status === 401) {
          this.currentUser = null;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('synthex-user');
          }
        }
        return null;
      }

      const data = await response.json();

      if (data.authenticated && data.user) {
        this.currentUser = data.user;

        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('synthex-user', JSON.stringify(data.user));
        }

        return data.user;
      }

      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Read user info from the non-httpOnly cookie set by OAuth callback
   */
  private getUserInfoFromCookie(): AuthUser | null {
    if (typeof document === 'undefined') return null;

    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name === 'user-info') {
          const value = decodeURIComponent(valueParts.join('='));
          const parsed = JSON.parse(value);
          if (parsed && parsed.id && parsed.email) {
            return {
              id: parsed.id,
              email: parsed.email,
              name: parsed.name || parsed.email.split('@')[0],
              avatar: parsed.avatar,
            };
          }
        }
      }
    } catch {
      // Cookie parsing failed — not critical
    }

    return null;
  }

  /**
   * Sign in with OAuth provider using PKCE flow
   */
  async signInWithOAuth(provider: 'google' | 'github'): Promise<void> {
    // Fetch the authorization URL from our API (which generates PKCE challenge)
    // The API returns JSON with { authorizationUrl } — we must NOT navigate directly
    // to the API route (it returns JSON, not a redirect).
    const response = await fetch(`${this.baseUrl}/oauth/${provider}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `Failed to initiate ${provider} login`);
    }

    const data = await response.json();

    if (data.authorizationUrl) {
      window.location.href = data.authorizationUrl;
    } else {
      throw new Error('No authorization URL received from server');
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: { name?: string; avatar?: string }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success && data.user) {
        this.currentUser = data.user;
        this.notifyListeners(data.user);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('synthex-user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to update profile',
      };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      return await response.json();
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Failed to reset password',
      };
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback);
    
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(user: AuthUser | null) {
    this.listeners.forEach(callback => callback(user));
  }

  /**
   * Demo sign in for development/testing
   * SECURITY: Uses the 'demo' authentication method which is controlled
   * by the DEMO_MODE_ENABLED environment variable on the server side.
   * No hardcoded credentials are used - the server validates demo mode availability.
   */
  async signInDemo(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/unified-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          method: 'demo',
        }),
      });

      const data = await response.json();

      if (data.success && data.user) {
        this.currentUser = data.user;
        this.notifyListeners(data.user);

        if (typeof window !== 'undefined') {
          localStorage.setItem('synthex-user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Demo sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Demo mode is not available',
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();