'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, Chrome, Loader2, AlertCircle } from '@/components/icons';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [accountExistsError, setAccountExistsError] = useState<{
    email: string;
    existingProvider: string;
    newProvider: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Handle URL parameters (errors from OAuth callback)
  useEffect(() => {
    const error = searchParams.get('error');
    const email = searchParams.get('email');
    const existingProvider = searchParams.get('existingProvider');
    const newProvider = searchParams.get('newProvider');

    if (error === 'account_exists' && email && existingProvider) {
      setAccountExistsError({
        email,
        existingProvider,
        newProvider: newProvider || 'google',
      });
    } else if (error) {
      toast.error(decodeURIComponent(error));
    }

    // Handle successful auth redirect
    if (searchParams.get('auth') === 'success') {
      toast.success('Welcome back!');
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Use unified auth endpoint
      const response = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: formData.email === 'demo@synthex.com' ? 'demo' : 'email',
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Store user data in localStorage for the sidebar and other components
      if (data.user && typeof window !== 'undefined') {
        localStorage.setItem('authToken', data.session?.accessToken || 'authenticated');
        localStorage.setItem('user', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || data.user.email.split('@')[0],
          avatar: data.user.avatar
        }));
      }

      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    try {
      // Use our new OAuth route with PKCE
      const response = await fetch('/api/auth/oauth/google');
      const data = await response.json();

      if (!response.ok) {
        // Handle demo mode gracefully
        if (data.error?.includes('not configured')) {
          toast.error('Google login is not configured. Please use demo credentials: demo@synthex.com / demo123');
          return;
        }
        throw new Error(data.error || 'Failed to initiate Google login');
      }

      if (data.authorizationUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect with Google');
      setOauthLoading(false);
    }
  };

  const dismissAccountExistsError = () => {
    setAccountExistsError(null);
    // Clear URL params
    router.replace('/login');
  };

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      email: 'Email/Password',
      google: 'Google',
      github: 'GitHub',
    };
    return names[provider] || provider;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1628] px-4 relative overflow-hidden">
      {/* Deep Navy Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#0a1628]" />

      {/* Subtle Grid Pattern */}
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Glow Effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Card Container */}
      <Card className="relative z-10 w-full max-w-md bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 shadow-2xl shadow-cyan-500/5">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <SynthexLogo className="w-12 h-12" />
          </div>
          <CardTitle className="text-2xl text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Enter your credentials to access your dashboard
          </CardDescription>
          {/* Account exists error message */}
          {accountExistsError && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-300 font-medium">
                    Account already exists
                  </p>
                  <p className="text-xs text-amber-200/80 mt-1">
                    An account with <strong>{accountExistsError.email}</strong> already exists
                    using {getProviderDisplayName(accountExistsError.existingProvider)}.
                  </p>
                  <p className="text-xs text-amber-200/80 mt-1">
                    Sign in with {getProviderDisplayName(accountExistsError.existingProvider)} first,
                    then link {getProviderDisplayName(accountExistsError.newProvider)} from your account settings.
                  </p>
                  <button
                    onClick={dismissAccountExistsError}
                    className="text-xs text-amber-400 hover:text-amber-300 mt-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Demo credentials notice */}
          {!accountExistsError && (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_SUPABASE_URL) && (
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-xs text-cyan-300 text-center">
                Demo Mode: Use <strong>demo@synthex.com</strong> / <strong>demo123</strong>
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  aria-label="Email address"
                  aria-required="true"
                  aria-describedby="email-error"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" className="rounded border-gray-600 bg-white/5 text-cyan-500 focus:ring-cyan-500/20" />
                <span className="text-gray-400">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-cyan-500/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0f172a] px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="w-full">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white/5 border-cyan-500/20 text-white hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all"
              onClick={handleGoogleLogin}
              disabled={isLoading || oauthLoading}
            >
              {oauthLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-4 w-4" />
                  Continue with Google
                </>
              )}
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-gray-400 w-full">
            Don't have an account?{' '}
            <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
