'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, Mail, RefreshCw } from '@/components/icons';
import { toast } from 'sonner';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);

  const verifyEmail = useCallback(async (verificationCode: string) => {
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
  }, [router]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">You can now access all features of SYNTHEX.</p>
            <Button onClick={() => router.push('/onboarding')} className="w-full">
              Continue Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-16 w-16 text-blue-500" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            Enter the verification code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-500 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
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
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-wider"
                maxLength={64}
              />
              <p className="text-xs text-gray-500 mt-2">
                Check your email for the verification code
              </p>
            </div>

            <Button
              onClick={() => verifyEmail(code)}
              disabled={verifying || !code}
              className="w-full"
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
                        toast.success(data.message || 'Verification email resent!');
                      } else {
                        toast.error(data.error || 'Failed to resend. Please try again.');
                      }
                    } catch {
                      toast.error('Network error. Please check your connection.');
                    } finally {
                      setResending(false);
                    }
                  }}
                  disabled={resending}
                  className="text-blue-500 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
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
                className="text-sm"
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
