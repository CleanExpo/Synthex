'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, type AuthUser } from '@/lib/auth/auth-service';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Only run auth checks on client side
    if (typeof window === 'undefined') return;
    
    // Check initial session
    checkUser();

    // Listen for auth changes
    const unsubscribe = authService.onAuthStateChange((authUser) => {
      setUser(authUser);
      // Don't auto-redirect on auth state changes to avoid unexpected navigation
    });

    return () => {
      unsubscribe();
    };
  }, []);

  async function checkUser() {
    try {
      // Skip auth check during SSG/SSR
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }
      
      // Add small delay to ensure localStorage is available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error checking user:', error);
      // Don't treat auth errors as fatal - user may just not be logged in
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      setLoading(true);
      const response = await authService.signIn(email, password);
      
      if (response.success && response.user) {
        setUser(response.user);
        toast.success('Welcome back!');
        router.push('/dashboard');
      } else {
        throw new Error(response.error || 'Failed to sign in');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, name?: string) {
    try {
      setLoading(true);
      const response = await authService.signUp(email, password, name);
      
      if (response.success) {
        if (response.requiresVerification) {
          toast.success('Account created! Please check your email to verify.');
        } else {
          toast.success('Account created successfully!');
        }
        router.push('/login');
      } else {
        throw new Error(response.error || 'Failed to create account');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      await authService.signOut();
      setUser(null);
      toast.success('Signed out successfully');
      router.push('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    try {
      setLoading(true);
      await authService.signInWithOAuth('google');
      // The redirect will be handled by OAuth flow
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGithub() {
    try {
      setLoading(true);
      await authService.signInWithOAuth('github');
      // The redirect will be handled by OAuth flow
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in with GitHub');
    } finally {
      setLoading(false);
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithGithub,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  // During SSR/SSG, return a safe default
  if (typeof window === 'undefined') {
    return {
      user: null,
      loading: true,
      signIn: async () => {},
      signUp: async () => {},
      signOut: async () => {},
      signInWithGoogle: async () => {},
      signInWithGithub: async () => {},
    } as AuthContextType;
  }
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}