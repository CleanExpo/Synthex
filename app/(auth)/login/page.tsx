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
import { SynthexWordmark } from '@/components/landing/premium/synthex-mark';
import { Button } from '@/components/ui/button';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sx-bg-primary px-4 py-10">
      <div
        className="landing-hero-dot-grid absolute inset-0 opacity-60"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,122,24,0.08),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,var(--sx-bg-primary)_0%,var(--sx-bg-secondary)_100%)] opacity-90"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Synthex home"
          >
            <SynthexWordmark markId="login" />
          </Link>
        </div>

        <div className="rounded-card border border-white/[0.1] bg-sx-bg-elevated/95 p-8 shadow-[var(--sx-shadow-elevated)] backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-sx-text-primary">
              Welcome back
            </h1>
            <HelpVideo videoId="how-to-sign-in" />
          </div>
          <p className="mb-6 text-sm leading-7 text-sx-text-secondary">
            Sign in to your account to continue
          </p>

          {/* Account exists error */}
          {accountExistsError && (
            <div className="mb-5 rounded-card border border-sx-accent/20 bg-sx-accent/[0.06] p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sx-accent" />
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-sx-text-primary">
                    Account already exists
                  </p>
                  <p className="text-xs leading-relaxed text-sx-text-secondary">
                    <strong className="text-sx-text-primary">
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
                    type="button"
                    onClick={dismissAccountExistsError}
                    className="text-[11px] uppercase tracking-[0.1em] text-sx-accent/80 transition-colors hover:text-sx-accent"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {rateLimitSeconds > 0 && (
            <div className="mb-5 rounded-card border border-red-500/20 bg-red-500/[0.06] p-3.5">
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-sx-text-primary">
                    Too many attempts
                  </p>
                  <p className="text-xs text-sx-text-secondary">
                    Wait{' '}
                    <span className="font-mono text-sx-text-primary">
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
                className="text-[11px] uppercase tracking-[0.1em] text-sx-text-muted"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sx-text-muted" />
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
                    'w-full rounded-input border bg-sx-bg-panel/80 py-2.5 pl-9 pr-3 text-sm text-sx-text-primary placeholder:text-sx-text-muted',
                    'focus:border-sx-accent/40 focus:outline-none focus:ring-1 focus:ring-sx-accent/20',
                    formError ? 'border-red-500/40' : 'border-white/[0.08]'
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
                  className="text-[11px] uppercase tracking-[0.1em] text-sx-text-muted"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-sx-accent transition-colors hover:text-sx-accent-hover"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sx-text-muted" />
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
                    'w-full rounded-input border bg-sx-bg-panel/80 py-2.5 pl-9 pr-10 text-sm text-sx-text-primary placeholder:text-sx-text-muted',
                    'focus:border-sx-accent/40 focus:outline-none focus:ring-1 focus:ring-sx-accent/20',
                    formError ? 'border-red-500/40' : 'border-white/[0.08]'
                  )}
                  required
                  disabled={isSubmitDisabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sx-text-muted transition-colors hover:text-sx-text-primary"
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
                <p className="flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {formError}
                </p>
              )}
            </div>

            <label className="group flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded-sm border border-white/[0.15] bg-sx-bg-panel/80 text-sx-accent focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-[11px] text-sx-text-muted transition-colors group-hover:text-sx-text-secondary">
                Remember me
              </span>
            </label>

            <Button
              type="submit"
              variant="premium-primary"
              size="lg"
              disabled={isSubmitDisabled}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : rateLimitSeconds > 0 ? (
                <>
                  <Clock className="h-4 w-4" />
                  Wait {formatCountdown(rateLimitSeconds)}
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {oauthHint && (
            <div className="mt-4 rounded-card border border-sx-accent/20 bg-sx-accent/[0.06] p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sx-accent" />
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-sx-text-primary">
                      This email is linked to{' '}
                      {getProviderDisplayName(oauthHint)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-sx-text-secondary">
                      You signed up with {getProviderDisplayName(oauthHint)}{' '}
                      instead of a password. Use the button below to sign in.
                    </p>
                  </div>
                  {oauthHint === 'google' && (
                    <Button
                      type="button"
                      variant="glass-secondary"
                      size="sm"
                      onClick={handleGoogleLogin}
                      disabled={oauthLoading}
                    >
                      {oauthLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Chrome className="h-3 w-3" />
                      )}
                      Sign in with Google instead
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-sx-bg-elevated px-3 text-[11px] uppercase tracking-[0.15em] text-sx-text-muted">
                or
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="glass-secondary"
            size="lg"
            onClick={handleGoogleLogin}
            disabled={isLoading || oauthLoading}
            className="w-full"
          >
            {oauthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Chrome className="h-4 w-4" />
            )}
            Continue with Google
          </Button>
        </div>

        <p className="mt-5 text-center text-[11px] text-sx-text-muted">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-sx-accent transition-colors hover:text-sx-accent-hover"
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
    <div className="flex min-h-screen items-center justify-center bg-sx-bg-primary px-4">
      <div className="w-full max-w-md animate-pulse space-y-6 rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-8">
        <div className="mx-auto h-10 w-32 rounded-lg bg-white/10" />
        <div className="space-y-2">
          <div className="mx-auto h-7 w-3/4 rounded bg-white/10" />
          <div className="mx-auto h-4 w-1/2 rounded bg-white/10" />
        </div>
        <div className="h-11 w-full rounded-input bg-white/10" />
        <div className="h-11 w-full rounded-input bg-white/10" />
        <div className="h-11 w-full rounded-btn bg-white/10" />
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
