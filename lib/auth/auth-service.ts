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
        error: error instanceof Error ? error.message : 'Failed to sign in',
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
        error: error instanceof Error ? error.message : 'Failed to create account',
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
        localStorage.removeItem('synthex-user');
        localStorage.removeItem('synthex-auth-token');
      }
    }
  }

  /**
   * Get current user from API
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
      }

      // Fetch from API
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
   * Sign in with OAuth provider
   */
  async signInWithOAuth(provider: 'google' | 'github'): Promise<void> {
    // OAuth flow typically requires a redirect
    window.location.href = `${this.baseUrl}/oauth/${provider}`;
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
        error: error instanceof Error ? error.message : 'Failed to update profile',
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
        error: error instanceof Error ? error.message : 'Failed to reset password',
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
   */
  async signInDemo(): Promise<AuthResponse> {
    return this.signIn('demo@synthex.com', 'demo123');
  }
}

// Export singleton instance
export const authService = new AuthService();