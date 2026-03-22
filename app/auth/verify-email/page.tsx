'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  RefreshCw,
} from '@/components/icons';
import { toast } from 'sonner';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);

  const verifyEmail = useCallback(
    async (verificationCode: string) => {
      const codeToVerify = verificationCode.trim();
      if (!codeToVerify) {
        setError('Please enter a verification code');
        return;
      }

      setVerifying(true);
      setError('');

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ code: codeToVerify }),
        });

        const data = await response.json();

        if (response.ok) {
          setVerified(true);
          toast.success('Email verified successfully!');

          // Redirect to onboarding after 3 seconds (new users need to complete onboarding)
          // Middleware will redirect to /dashboard if onboarding is already complete
          setTimeout(() => {
            router.push('/onboarding');
          }, 3000);
        } else {
          setError(data.error || 'Verification failed');
        }
      } catch (err) {
        setError('An error occurred during verification');
        console.error('Verification error:', err);
      } finally {
        setVerifying(false);
      }
    },
    [router]
  );

  useEffect(() => {
    // Check for verification code in URL
    const urlCode = searchParams.get('code');
    const success = searchParams.get('success');
    const errorMsg = searchParams.get('error');

    if (success === 'true') {
      setVerified(true);
    } else if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
    } else if (urlCode) {
      // Auto-verify if code is in URL
      verifyEmail(urlCode);
    }
  }, [searchParams, verifyEmail]);

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4 relative overflow-hidden">
        {/* Background gradient */}
        <div className="fixed inset-0 bg-gradient-to-br from-[#050505] via-[#111111] to-[#050505]" />

        {/* Subtle grid */}
        <div
          className="fixed inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 184, 123, 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 184, 123, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Glow effects */}
        <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-orange-400/5 rounded-full blur-[150px] pointer-events-none" />

        <Card className="relative z-10 w-full max-w-md bg-zinc-900/90 backdrop-blur-xl border border-orange-900/20 shadow-2xl shadow-orange-500/5">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-orange-400" />
              </div>
            </div>
            <CardTitle className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">
              Email Verified!
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your email has been successfully verified
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-300 text-sm">
              You can now access all features of SYNTHEX.
            </p>
            <Button
              onClick={() => router.push('/onboarding')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-medium shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40"
            >
              Continue Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#050505] via-[#111111] to-[#050505]" />

      {/* Subtle grid */}
      <div
        className="fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 184, 123, 0.3) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255, 184, 123, 0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Glow effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-orange-400/5 rounded-full blur-[150px] pointer-events-none" />

      <Card className="relative z-10 w-full max-w-md bg-zinc-900/90 backdrop-blur-xl border border-orange-900/20 shadow-2xl shadow-orange-500/5">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 flex items-center justify-center">
              <Mail className="h-8 w-8 text-orange-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-gray-400">
            Enter the verification code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-500/30 bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="text-center text-lg tracking-wider bg-white/5 border-orange-500/20 text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:ring-orange-500/20"
                maxLength={64}
              />
              <p className="text-xs text-gray-500 mt-2">
                Check your email for the verification code
              </p>
            </div>

            <Button
              onClick={() => verifyEmail(code)}
              disabled={verifying || !code}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-medium shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>

            <div className="text-center text-sm">
              <p className="text-gray-500">
                Didn&apos;t receive the email?{' '}
                <button
                  onClick={async () => {
                    setResending(true);
                    try {
                      const res = await fetch('/api/auth/resend-verification', {
                        method: 'POST',
                        credentials: 'include',
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast.success(
                          data.message || 'Verification email resent!'
                        );
                      } else {
                        toast.error(
                          data.error || 'Failed to resend. Please try again.'
                        );
                      }
                    } catch {
                      toast.error(
                        'Network error. Please check your connection.'
                      );
                    } finally {
                      setResending(false);
                    }
                  }}
                  disabled={resending}
                  className="text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {resending && <RefreshCw className="h-3 w-3 animate-spin" />}
                  {resending ? 'Sending...' : 'Resend code'}
                </button>
              </p>
            </div>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => router.push('/login')}
                className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
              >
                Back to Login
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
