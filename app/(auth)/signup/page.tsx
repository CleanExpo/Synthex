'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  User,
  Chrome,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  RefreshCw,
  Key,
} from '@/components/icons';
import { SynthexLogo } from '@/components/landing/synthex-logo';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HelpVideo } from '@/components/ui/HelpVideo';

/** Shape of per-field validation details returned by the signup API */
interface ValidationDetail {
  field: string;
  message: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const inviteOnly = process.env.NEXT_PUBLIC_INVITE_ONLY_MODE === 'true';
  const [formData, setFormData] = useState({
    inviteCode: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null
  );
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>(
    'idle'
  );

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

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (rateLimitSeconds > 0) return;

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    if (passwordStrength < 2) {
      setFieldErrors({
        password:
          'Password is too weak. Use uppercase letters, numbers, or symbols.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...(inviteOnly &&
            formData.inviteCode && { inviteCode: formData.inviteCode }),
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
        toast.error(
          `Too many attempts. Please wait ${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) !== 1 ? 's' : ''} before trying again.`
        );
        return;
      }

      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          const errors: Record<string, string> = {};
          for (const issue of data.details as ValidationDetail[]) {
            if (issue.field) errors[issue.field] = issue.message;
          }
          if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
          } else {
            toast.error(data.error || 'Registration failed. Please try again.');
          }
        } else {
          toast.error(data.error || 'Registration failed. Please try again.');
        }
        return;
      }

      if (data.requiresVerification) {
        setVerificationEmail(formData.email);
      } else {
        toast.success('Account created successfully!');
        router.push('/onboarding');
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/oauth/google', {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error?.includes('not configured')) {
          toast.error(
            'Google signup is not configured. Please contact support.'
          );
          return;
        }
        throw new Error(data.error || 'Failed to initiate Google signup');
      }
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Signup error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendStatus('idle');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });
      setResendStatus(response.ok ? 'sent' : 'error');
    } catch {
      setResendStatus('error');
    } finally {
      setResendLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-red-500/60';
    if (passwordStrength === 2) return 'bg-amber-500/60';
    if (passwordStrength === 3) return 'bg-amber-400/80';
    return 'bg-emerald-500/60';
  };

  const getStrengthLabel = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength === 1) return 'Weak';
    if (passwordStrength === 2) return 'Fair';
    if (passwordStrength === 3) return 'Good';
    return 'Strong';
  };

  const isSubmitDisabled = isLoading || rateLimitSeconds > 0;

  // ── Email verification state ──────────────────────────────────────────────
  if (verificationEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508] px-4 relative overflow-hidden">
        <div
          className="fixed inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <SynthexLogo className="w-9 h-9 opacity-90" />
            <span className="text-[10px] font-light tracking-[0.3em] text-white/50 uppercase">
              Synthex
            </span>
          </div>

          <div className="bg-[#0a0a12] border-[0.5px] border-white/[0.06] rounded-sm p-8">
            {/* Mail icon */}
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 flex items-center justify-center border-[0.5px] border-amber-500/20 bg-amber-500/[0.04] rounded-sm">
                <Mail className="w-5 h-5 text-amber-500/70" />
              </div>
            </div>
            <h1 className="text-lg font-light text-white mb-1 text-center">
              You&apos;re in!
            </h1>
            <p className="text-xs text-white/40 text-center mb-1">
              Account created. We&apos;ve sent a verification link to:
            </p>
            <p className="text-xs text-amber-500/80 text-center font-medium mb-6">
              {verificationEmail}
            </p>
            <p className="text-[10px] text-white/60 text-center mb-6 leading-relaxed">
              Click the link in the email to verify your account. Check your
              spam folder if you don&apos;t see it.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-sm bg-amber-500 hover:bg-amber-400 text-[#050508] transition-colors"
              >
                Continue to Synthex
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-white/40 text-center mt-3 leading-relaxed">
              Your account is ready — you can verify your email later from
              account settings.
            </p>

            <div className="border-t-[0.5px] border-white/[0.06] mt-4 pt-4">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading || resendStatus === 'sent'}
                className="w-full flex items-center justify-center gap-2 py-2 text-[11px] text-white/40 hover:text-white/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : resendStatus === 'sent' ? (
                  <CheckCircle className="w-3 h-3 text-amber-500/70" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {resendStatus === 'sent'
                  ? 'Verification email sent'
                  : 'Resend verification email'}
              </button>
              {resendStatus === 'error' && (
                <p className="text-[10px] text-red-400/70 text-center mt-2">
                  Failed to resend. Please try again.
                </p>
              )}
            </div>
          </div>

          <p className="text-center text-[10px] text-white/60 mt-5">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => setVerificationEmail(null)}
              className="text-amber-500/70 hover:text-amber-500/90 transition-colors"
            >
              Go back
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Sign up form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] px-4 py-10 relative overflow-hidden">
      {/* Subtle dot grid */}
      <div
        className="fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <SynthexLogo className="w-9 h-9 opacity-90" />
          <span className="text-[10px] font-light tracking-[0.3em] text-white/50 uppercase">
            Synthex
          </span>
        </div>

        <div className="bg-[#0a0a12] border-[0.5px] border-white/[0.06] rounded-sm p-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-light text-white">
              Create your account
            </h1>
            <HelpVideo videoId="how-to-sign-up" />
          </div>
          <p className="text-xs text-white/40 mb-6">
            {inviteOnly
              ? 'Enter your invite code to get started'
              : 'Start automating your social media in minutes'}
          </p>

          {/* Rate limit banner */}
          {rateLimitSeconds > 0 && (
            <div className="mb-5 p-3.5 bg-red-500/[0.04] border-[0.5px] border-red-500/20 rounded-sm">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs text-white/70 font-medium">
                    Too many attempts
                  </p>
                  <p className="text-xs text-white/40">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invite code */}
            {inviteOnly && (
              <div className="space-y-1.5">
                <label
                  htmlFor="inviteCode"
                  className="text-[10px] uppercase tracking-[0.1em] text-white/50"
                >
                  Invite Code
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                  <input
                    id="inviteCode"
                    type="text"
                    placeholder="SX-XXXXXX"
                    value={formData.inviteCode}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        inviteCode: e.target.value.toUpperCase(),
                      })
                    }
                    className={cn(
                      'w-full pl-9 pr-3 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/80 placeholder:text-white/40 rounded-sm uppercase font-mono tracking-widest',
                      'focus:outline-none focus:border-amber-500/30 transition-colors',
                      fieldErrors.inviteCode
                        ? 'border-red-500/30'
                        : 'border-white/[0.06]'
                    )}
                    required
                    disabled={isSubmitDisabled}
                    maxLength={20}
                    autoComplete="off"
                  />
                </div>
                {fieldErrors.inviteCode && (
                  <p className="text-[10px] text-red-400/70">
                    {fieldErrors.inviteCode}
                  </p>
                )}
                <p className="text-[10px] text-white/60">
                  No invite?{' '}
                  <Link
                    href="/waitlist"
                    className="text-amber-500/60 hover:text-amber-500/80 transition-colors"
                  >
                    Request access
                  </Link>
                </p>
              </div>
            )}

            {/* Full name */}
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="text-[10px] uppercase tracking-[0.1em] text-white/50"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                <input
                  id="name"
                  type="text"
                  placeholder="Jane Smith"
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={cn(
                    'w-full pl-9 pr-3 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/80 placeholder:text-white/40 rounded-sm',
                    'focus:outline-none focus:border-amber-500/30 transition-colors',
                    fieldErrors.name
                      ? 'border-red-500/30'
                      : 'border-white/[0.06]'
                  )}
                  required
                  disabled={isSubmitDisabled}
                />
              </div>
              {fieldErrors.name && (
                <p className="text-[10px] text-red-400/70">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-[10px] uppercase tracking-[0.1em] text-white/50"
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
                  onChange={e =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={cn(
                    'w-full pl-9 pr-3 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/80 placeholder:text-white/40 rounded-sm',
                    'focus:outline-none focus:border-amber-500/30 transition-colors',
                    fieldErrors.email
                      ? 'border-red-500/30'
                      : 'border-white/[0.06]'
                  )}
                  required
                  disabled={isSubmitDisabled}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[10px] text-red-400/70">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-[10px] uppercase tracking-[0.1em] text-white/50"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => {
                    setFormData({ ...formData, password: e.target.value });
                    calculatePasswordStrength(e.target.value);
                  }}
                  className={cn(
                    'w-full pl-9 pr-10 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/80 placeholder:text-white/40 rounded-sm',
                    'focus:outline-none focus:border-amber-500/30 transition-colors',
                    fieldErrors.password
                      ? 'border-red-500/30'
                      : 'border-white/[0.06]'
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
              {/* Strength meter */}
              {formData.password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className={cn(
                          'h-0.5 flex-1 rounded-full transition-all',
                          level <= passwordStrength
                            ? getStrengthColor()
                            : 'bg-white/[0.06]'
                        )}
                      />
                    ))}
                  </div>
                  {getStrengthLabel() && (
                    <p className="text-[10px] text-white/60">
                      Strength:{' '}
                      <span
                        className={
                          passwordStrength >= 3
                            ? 'text-amber-500/70'
                            : 'text-white/50'
                        }
                      >
                        {getStrengthLabel()}
                      </span>
                    </p>
                  )}
                </div>
              )}
              {fieldErrors.password && (
                <p className="text-[10px] text-red-400/70">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-[10px] uppercase tracking-[0.1em] text-white/50"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className={cn(
                    'w-full pl-9 pr-10 py-2.5 text-xs bg-white/[0.02] border-[0.5px] text-white/80 placeholder:text-white/40 rounded-sm',
                    'focus:outline-none focus:border-amber-500/30 transition-colors',
                    fieldErrors.confirmPassword
                      ? 'border-red-500/30'
                      : 'border-white/[0.06]'
                  )}
                  required
                  disabled={isSubmitDisabled}
                />
                {formData.confirmPassword &&
                formData.password === formData.confirmPassword ? (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500/70" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/60 transition-colors"
                    aria-label={
                      showConfirmPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[10px] text-red-400/70">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* ToS */}
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 w-3 h-3 rounded-sm border-[0.5px] border-white/[0.15] bg-white/[0.02] text-amber-500 focus:ring-0 focus:ring-offset-0"
                required
              />
              <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors leading-relaxed">
                I agree to the{' '}
                <Link
                  href="/terms"
                  className="text-amber-500/60 hover:text-amber-500/80 transition-colors"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  className="text-amber-500/60 hover:text-amber-500/80 transition-colors"
                >
                  Privacy Policy
                </Link>
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
                  Creating account…
                </>
              ) : rateLimitSeconds > 0 ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  Wait {formatCountdown(rateLimitSeconds)}
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Google OAuth — hidden in invite-only mode */}
          {!inviteOnly && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/[0.06]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#0a0a12] px-3 text-[10px] uppercase tracking-[0.15em] text-white/50">
                    or
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 text-xs text-white/60 hover:text-white/80 bg-white/[0.02] hover:bg-white/[0.04] border-[0.5px] border-white/[0.06] hover:border-white/[0.12] rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Chrome className="w-3.5 h-3.5" />
                )}
                Continue with Google
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/60 mt-5">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-amber-500/70 hover:text-amber-500/90 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
