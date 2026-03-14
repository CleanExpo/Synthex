'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, User, Chrome, Loader2, CheckCircle, Eye, EyeOff, Clock, ArrowRight, RefreshCw, Key } from '@/components/icons';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';
import { toast } from 'sonner';

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

  // UNI-632: Track email verification state to show inline message
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');

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
      setFieldErrors({ password: 'Password is too weak. Use uppercase letters, numbers, or symbols.' });
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
          ...(inviteOnly && formData.inviteCode && { inviteCode: formData.inviteCode }),
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
        toast.error(`Too many attempts. Please wait ${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) !== 1 ? 's' : ''} before trying again.`);
        return;
      }

      if (!response.ok) {
        // UNI-629: Surface field-level validation errors from the API.
        // The signup API returns { error: string, details?: Array<{ field, message }> }
        // when Zod validation fails (status 400).
        if (data.details && Array.isArray(data.details)) {
          const errors: Record<string, string> = {};
          for (const issue of data.details as ValidationDetail[]) {
            if (issue.field) {
              errors[issue.field] = issue.message;
            }
          }
          if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
          } else {
            // details array exists but no field-level errors — show generic
            toast.error(data.error || 'Registration failed. Please try again.');
          }
        } else {
          // No details array (e.g. 409 duplicate email, 500 server error)
          toast.error(data.error || 'Registration failed. Please try again.');
        }
        return;
      }

      // UNI-632: After successful signup, check the requiresVerification flag.
      // If true, show an inline "Check your email" message with the user's
      // email displayed, instead of immediately redirecting.
      if (data.requiresVerification) {
        setVerificationEmail(formData.email);
        // Do NOT redirect — show inline verification message
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
      // Use custom OAuth route with PKCE (same as login) — ensures JWT is set
      // and onboarding redirect works correctly via callback handler
      const response = await fetch('/api/auth/oauth/google', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes('not configured')) {
          toast.error('Google signup is not configured. Please contact support.');
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
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
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
      if (response.ok) {
        setResendStatus('sent');
      } else {
        setResendStatus('error');
      }
    } catch {
      setResendStatus('error');
    } finally {
      setResendLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return 'bg-gray-600';
    if (passwordStrength === 1) return 'bg-red-500';
    if (passwordStrength === 2) return 'bg-yellow-500';
    if (passwordStrength === 3) return 'bg-cyan-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength === 1) return 'Weak';
    if (passwordStrength === 2) return 'Fair';
    if (passwordStrength === 3) return 'Good';
    return 'Strong';
  };

  const isSubmitDisabled = isLoading || rateLimitSeconds > 0;

  // UNI-632: If email verification is required, render the verification
  // message instead of the signup form. This gives the user clear feedback
  // that their account was created and they should check their email.
  if (verificationEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4 py-8 relative overflow-hidden">
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

        <Card className="relative z-10 w-full max-w-md bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10 shadow-2xl shadow-cyan-500/5">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <SynthexLogo className="w-12 h-12" />
            </div>
            <div className="flex items-center justify-center mb-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 flex items-center justify-center">
                <Mail className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
              Check your email
            </CardTitle>
            <CardDescription className="text-center text-gray-400 space-y-2">
              <span className="block">
                Your account has been created. We sent a verification email to:
              </span>
              <span className="block text-cyan-300 font-medium">
                {verificationEmail}
              </span>
              <span className="block text-xs text-gray-500 mt-2">
                Click the link in the email to verify your account.
                Check your spam folder if you don&apos;t see it.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* UNI-632: Allow user to continue to onboarding without waiting
                for email verification (since email verification is not fully
                wired yet). This prevents blocking the user flow. */}
            <Button
              onClick={() => router.push('/onboarding')}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
            >
              Continue to onboarding
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResendVerification}
              disabled={resendLoading || resendStatus === 'sent'}
              className="w-full border-cyan-500/20 text-gray-300 hover:bg-cyan-500/10 hover:text-white"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resendStatus === 'sent' ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4 text-cyan-400" />
                  Verification email sent
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>
            {resendStatus === 'error' && (
              <p className="text-center text-xs text-red-400">
                Failed to resend. Please try again.
              </p>
            )}
            <p className="text-center text-xs text-gray-500">
              You can verify your email later from your account settings
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-center text-sm text-gray-400 w-full">
              Wrong email?{' '}
              <button
                type="button"
                onClick={() => setVerificationEmail(null)}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Go back
              </button>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark px-4 py-8 relative overflow-hidden">
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
      <Card className="relative z-10 w-full max-w-md bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10 shadow-2xl shadow-cyan-500/5">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <SynthexLogo className="w-12 h-12" />
          </div>
          <CardTitle className="text-2xl text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
            Create your account
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {inviteOnly
              ? 'Enter your invite code to create an account'
              : 'Start automating your social media in minutes'}
          </CardDescription>
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
            {/* Invite code field — shown only during invite-only soft launch */}
            {inviteOnly && (
              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="text-gray-300">Invite Code</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="SX-XXXXXX"
                    value={formData.inviteCode}
                    onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                    className={`pl-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 uppercase tracking-wider font-mono ${fieldErrors.inviteCode ? 'border-red-500/60' : ''}`}
                    required
                    disabled={isSubmitDisabled}
                    maxLength={20}
                    autoComplete="off"
                  />
                </div>
                {fieldErrors.inviteCode && (
                  <p className="text-xs text-red-400">{fieldErrors.inviteCode}</p>
                )}
                <p className="text-xs text-gray-500">
                  Don&apos;t have an invite code?{' '}
                  <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                    Request access
                  </Link>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`pl-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 ${fieldErrors.name ? 'border-red-500/60' : ''}`}
                  required
                  disabled={isSubmitDisabled}
                />
              </div>
              {fieldErrors.name && (
                <p className="text-xs text-red-400">{fieldErrors.name}</p>
              )}
            </div>

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
                  className={`pl-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 ${fieldErrors.email ? 'border-red-500/60' : ''}`}
                  required
                  disabled={isSubmitDisabled}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-red-400">{fieldErrors.email}</p>
              )}
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
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    calculatePasswordStrength(e.target.value);
                  }}
                  className={`pl-10 pr-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 ${fieldErrors.password ? 'border-red-500/60' : ''}`}
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
              {formData.password && (
                <div className="space-y-1">
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${
                          level <= passwordStrength ? getPasswordStrengthColor() : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    Password strength: <span className={passwordStrength >= 3 ? 'text-cyan-400' : 'text-yellow-400'}>
                      {getPasswordStrengthText()}
                    </span>
                  </p>
                </div>
              )}
              {fieldErrors.password && (
                <p className="text-xs text-red-400">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`pl-10 pr-10 bg-white/5 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 ${fieldErrors.confirmPassword ? 'border-red-500/60' : ''}`}
                  required
                  disabled={isSubmitDisabled}
                />
                {formData.confirmPassword && formData.password === formData.confirmPassword ? (
                  <CheckCircle className="absolute right-3 top-3 w-4 h-4 text-cyan-500" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-400">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" className="rounded border-gray-600 bg-white/5 text-cyan-500 focus:ring-cyan-500/20" required />
                <span className="text-gray-400">
                  I agree to the{' '}
                  <Link href="/terms" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitDisabled}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : rateLimitSeconds > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Wait {formatCountdown(rateLimitSeconds)}
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          {/* Google OAuth — hidden during invite-only mode to avoid threading
              invite codes through the OAuth flow. Re-enable for public launch. */}
          {!inviteOnly && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-cyan-500/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface-base px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white/5 border-cyan-500/20 text-white hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                >
                  <Chrome className="mr-2 h-4 w-4" />
                  Continue with Google
                </Button>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-gray-400 w-full">
            Already have an account?{' '}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
