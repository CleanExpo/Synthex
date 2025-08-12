'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { auth } from '@/lib/supabase-client';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Only run auth checks on client side
    if (typeof window === 'undefined') return;
    
    // Check initial session
    checkUser();

    // Listen for auth changes
    const { data: listener } = auth.onAuthStateChange(async (event: any, session: any) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        router.push('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/login');
      } else if (event === 'USER_UPDATED') {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  async function checkUser() {
    try {
      // Skip auth check during SSG/SSR
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }
      
      // Add small delay to ensure localStorage is available
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const user = await auth.getCurrentUser();
      setUser(user);
      
      // If user exists but was not set, try to refresh the session
      if (!user) {
        const storedToken = localStorage.getItem('synthex-auth-token');
        if (storedToken) {
          try {
            // Try to recover session from stored token
            const { data } = JSON.parse(storedToken);
            if (data?.session?.user) {
              setUser(data.session.user);
            }
          } catch (e) {
            // Token might be invalid, clear it
            localStorage.removeItem('synthex-auth-token');
          }
        }
      }
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
      const { user } = await auth.signIn(email, password);
      setUser(user);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, name?: string) {
    try {
      setLoading(true);
      const { user } = await auth.signUp(email, password, name);
      if (user) {
        toast.success('Account created! Please check your email to verify.');
        router.push('/login');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      await auth.signOut();
      setUser(null);
      toast.success('Signed out successfully');
      router.push('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    try {
      setLoading(true);
      await auth.signInWithGoogle();
      // The redirect will be handled by Supabase OAuth
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGithub() {
    try {
      setLoading(true);
      await auth.signInWithGithub();
      // The redirect will be handled by Supabase OAuth
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in with GitHub');
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}