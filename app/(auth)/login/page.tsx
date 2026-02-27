'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, Chrome, Loader2, AlertCircle, Eye, EyeOff, Clock } from '@/components/icons';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';
import { toast } from 'sonner';

/** Map provider keys to human-readable display names */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  email: 'Email/Password',
  google: 'Google',
  github: 'GitHub',
};

function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] || provider;
}

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
  const [oauthHint, setOauthHint] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for rate limit cooldown
  useEffect(() => {
    if (rateLimitSeconds <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    countdownRef.current = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [rateLimitSeconds > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  }, []);

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

    if (rateLimitSeconds > 0) return;

    setIsLoading(true);
    setOauthHint(null);

    try {
      // Use unified auth endpoint
      const response = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          method: 'email',
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let seconds = 60; // sensible default

        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            seconds = parsed;
          }
        } else if (data.retryAfter) {
          // Fallback: parse ISO timestamp from response body
          const resetTime = new Date(data.retryAfter).getTime();
          const remaining = Math.ceil((resetTime - Date.now()) / 1000);
          if (remaining > 0) {
            seconds = remaining;
          }
        }

        setRateLimitSeconds(seconds);
        toast.error(`Too many login attempts. Please wait ${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) !== 1 ? 's' : ''} before trying again.`);
        return;
      }

      if (!response.ok || !data.success) {
        // UNI-630: When an OAuth provider hint is returned, show the inline
        // banner instead of a generic/misleading toast. The banner provides
        // a direct "Sign in with <Provider>" action.
        if (data.existingProvider) {
          setOauthHint(data.existingProvider as string);
          // No toast — the inline OAuth hint banner is more helpful
        } else {
          toast.error(data.error || 'Invalid email or password');
        }
        return;
      }

      // Store user profile data in localStorage for UI components (non-sensitive)
      // Auth tokens are now stored in httpOnly cookies (security fix UNI-523)
      if (data.user && typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || data.user.email.split('@')[0],
          avatar: data.user.avatar
        }));
      }

      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch {
      toast.error('Login failed. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    try {
      // Use our new OAuth route with PKCE
      const response = await fetch('/api/auth/oauth/google', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        // Handle configuration issues gracefully
        if (data.error?.includes('not configured')) {
          toast.error('Google login is not configured. Please contact support.');
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

  const isSubmitDisabled = isLoading || rateLimitSeconds > 0;

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
          {/* Rate limit cooldown banner */}
          {rateLimitSeconds > 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-300 font-medium">
                    Too many attempts
                  </p>
                  <p className="text-xs text-red-200/80 mt-1">
                    Please wait{' '}
                    <span className="font-mono font-semibold text-red-300">
                      {formatCountdown(rateLimitSeconds)}
                    </span>
                    {' '}before trying again.
                  </p>
                </div>
              </div>
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
                  disabled={isSubmitDisabled}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  required
                  disabled={isSubmitDisabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitDisabled}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : rateLimitSeconds > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Wait {formatCountdown(rateLimitSeconds)}
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* UNI-630: Provider-specific OAuth hint banner
              Shown when a user who signed up with an OAuth provider (e.g. Google)
              attempts to log in with email/password. Replaces the misleading
              "Invalid email or password" toast with actionable guidance. */}
          {oauthHint && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-200 font-medium">
                    This email is linked to a {getProviderDisplayName(oauthHint)} account
                  </p>
                  <p className="text-xs text-blue-200/70 mt-1">
                    You signed up with {getProviderDisplayName(oauthHint)} instead of a password.
                    Use the button below to sign in.
                  </p>
                  {oauthHint === 'google' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGoogleLogin}
                      disabled={oauthLoading}
                      className="mt-2 bg-blue-500/20 border border-blue-500/30 text-blue-200 hover:bg-blue-500/30 hover:text-white text-xs"
                    >
                      {oauthLoading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Chrome className="mr-1.5 h-3 w-3" />
                          Sign in with Google instead
                        </>
                      )}
                    </Button>
                  )}
                  {oauthHint !== 'google' && (
                    <p className="text-xs text-blue-300 mt-2">
                      Please use the {getProviderDisplayName(oauthHint)} sign-in option.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

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
