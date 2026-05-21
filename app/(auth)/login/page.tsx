'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Lock,
  Chrome,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
} from '@/components/icons';
import { SynthexLogo } from '@/components/landing/synthex-logo';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HelpVideo } from '@/components/ui/HelpVideo';

/** Map provider keys to human-readable display names */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  email: 'Email/Password',
  google: 'Google',
  github: 'GitHub',
};

function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] || provider;
}

function LoginContent() {
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
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
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
      setRateLimitSeconds(prev => {
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
    if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    setFormError(null);

    try {
      const response = await fetch('/api/auth/unified-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          method: 'email',
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let seconds = 60;
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!Number.isNaN(parsed) && parsed > 0) seconds = parsed;
        } else if (data.retryAfter) {
          const resetTime = new Date(data.retryAfter).getTime();
          const remaining = Math.ceil((resetTime - Date.now()) / 1000);
          if (remaining > 0) seconds = remaining;
        }
        setRateLimitSeconds(seconds);
        return;
      }

      if (!response.ok || !data.success) {
        if (data.existingProvider) {
          setOauthHint(data.existingProvider as string);
        } else {
          const errorMessage = data.error || 'Invalid email or password';
          setFormError(errorMessage);
          toast.error(errorMessage);
        }
        return;
      }

      if (data.user && typeof window !== 'undefined') {
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || data.user.email.split('@')[0],
            avatar: data.user.avatar,
          })
        );
      }

      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch {
      const msg = 'Login failed. Please check your connection and try again.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    try {
      const response = await fetch('/api/auth/oauth/google', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error?.includes('not configured')) {
          toast.error(
            'Google login is not configured. Please contact support.'
          );
          return;
        }
        throw new Error(data.error || 'Failed to initiate Google login');
      }
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to connect with Google'
      );
      setOauthLoading(false);
    }
  };

  const dismissAccountExistsError = () => {
    setAccountExistsError(null);
    router.replace('/login');
  };

  const isSubmitDisabled = isLoading || rateLimitSeconds > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] px-4 relative overflow-hidden">
      {/* Subtle dot grid */}
      <div
        className="fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* Ambient glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <SynthexLogo className="w-9 h-9 opacity-90" />
          <span className="text-[10px] font-light tracking-[0.3em] text-white/70 uppercase">
            Synthex
          </span>
        </div>

        <div className="bg-[#0a0a12] border-[0.5px] border-white/[0.06] rounded-sm p-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-light text-white">Welcome back</h1>
            <HelpVideo videoId="how-to-sign-in" />
          </div>
          <p className="text-xs text-white/70 mb-6">
            Sign in to your account to continue
          </p>

          {/* Account exists error */}
          {accountExistsError && (
            <div className="mb-5 p-3.5 bg-amber-500/[0.04] border-[0.5px] border-amber-500/20 rounded-sm">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500/70 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-white/70 font-medium">
                    Account already exists
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong className="text-white/60">
                      {accountExistsError.email}
                    </strong>{' '}
                    is registered via{' '}
                    {getProviderDisplayName(
                      accountExistsError.existingProvider
                    )}
                    . Sign in with that provider, then link others from
                    settings.
                  </p>
                  <button
                    onClick={dismissAccountExistsError}
                    className="text-[10px] text-amber-500/60 hover:text-amber-500/80 transition-colors uppercase tracking-[0.1em]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rate limit banner */}
          {rateLimitSeconds > 0 && (
            <div className="mb-5 p-3.5 bg-red-500/[0.04] border-[0.5px] border-red-500/20 rounded-sm">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs text-white/70 font-medium">
                    Too many attempts
                  </p>
                  <p className="text-xs text-white/70">
                    Wait{' '}
                    <span className="font-mono text-white/60">
                      {formatCountdown(rateLimitSeconds)}
                    </span>{' '}
                    before trying again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* aria-live error */}
          {formError && (
            <p role="alert" aria-live="assertive" className="sr-only">
              {formError}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[10px] uppercase tracking-[0.1em] text-white/70"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={e => {
                    setFormData({ ...formData, email: e.target.value });
                    setFormError(null);
                  }}
                  className={cn(
                    'w-full pl-9 pr-3 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/90 placeholder:text-white/55 rounded-sm',
                    'focus:outline-none focus:border-amber-500/30 transition-colors',
                    formError ? 'border-red-500/30' : 'border-white/[0.06]'
                  )}
                  aria-required="true"
                  aria-invalid={!!formError}
                  required
                  disabled={isSubmitDisabled}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-[10px] uppercase tracking-[0.1em] text-white/70"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] text-amber-300 hover:text-amber-200 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => {
                    setFormData({ ...formData, password: e.target.value });
                    setFormError(null);
                  }}
                  className={cn(
                    'w-full pl-9 pr-10 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/90 placeholder:text-white/55 rounded-sm',
                    'focus:outline-none focus:border-amber-500/30 transition-colors',
                    formError ? 'border-red-500/30' : 'border-white/[0.06]'
                  )}
                  required
                  disabled={isSubmitDisabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/60 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              {formError && (
                <p className="text-[10px] text-red-400/70 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {formError}
                </p>
              )}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-3 h-3 rounded-sm border-[0.5px] border-white/[0.15] bg-white/[0.02] text-amber-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-[10px] text-white/70 group-hover:text-white/85 transition-colors">
                Remember me
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={cn(
                'w-full py-2.5 text-xs font-medium rounded-sm transition-all',
                'bg-amber-500 hover:bg-amber-400 text-[#050508]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Signing in…
                </>
              ) : rateLimitSeconds > 0 ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  Wait {formatCountdown(rateLimitSeconds)}
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* OAuth hint banner */}
          {oauthHint && (
            <div className="mt-4 p-3.5 bg-amber-500/[0.04] border-[0.5px] border-amber-500/20 rounded-sm">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500/70 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xs text-white/70 font-medium">
                      This email is linked to{' '}
                      {getProviderDisplayName(oauthHint)}
                    </p>
                    <p className="text-[10px] text-white/70 mt-0.5 leading-relaxed">
                      You signed up with {getProviderDisplayName(oauthHint)}{' '}
                      instead of a password. Use the button below to sign in.
                    </p>
                  </div>
                  {oauthHint === 'google' && (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={oauthLoading}
                      className="flex items-center gap-2 px-3 py-2 text-[10px] tracking-wide rounded-sm transition-colors bg-white/[0.03] border-[0.5px] border-white/[0.08] text-white/60 hover:text-white/80 hover:border-white/[0.15] disabled:opacity-50"
                    >
                      {oauthLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Chrome className="w-3 h-3" />
                      )}
                      Sign in with Google instead
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0a0a12] px-3 text-[10px] uppercase tracking-[0.15em] text-white/70">
                or
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || oauthLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 text-xs text-white/60 hover:text-white/80 bg-white/[0.02] hover:bg-white/[0.04] border-[0.5px] border-white/[0.06] hover:border-white/[0.12] rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {oauthLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Chrome className="w-3.5 h-3.5" />
            )}
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/60 mt-5">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-amber-500/70 hover:text-amber-500/90 transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-6 animate-pulse">
          {/* Logo placeholder */}
          <div className="flex justify-center mb-6">
            <div className="h-10 w-32 rounded-lg bg-white/10" />
          </div>
          {/* Heading placeholder */}
          <div className="space-y-2">
            <div className="h-7 w-3/4 mx-auto rounded bg-white/10" />
            <div className="h-4 w-1/2 mx-auto rounded bg-white/10" />
          </div>
          {/* Email field */}
          <div className="space-y-2">
            <div className="h-4 w-16 rounded bg-white/10" />
            <div className="h-11 w-full rounded-lg bg-white/10" />
          </div>
          {/* Password field */}
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-white/10" />
            <div className="h-11 w-full rounded-lg bg-white/10" />
          </div>
          {/* Button */}
          <div className="h-11 w-full rounded-lg bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}
