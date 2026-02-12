'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/supabase-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Sparkles
} from '@/components/icons';
import toast, { Toaster } from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await auth.resetPassword(email);
      setSuccess(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email. Please try again.';
      setError(message);
      toast.error('Failed to send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-cyan-950/20 to-gray-950 flex items-center justify-center p-4">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-green-500/20 rounded-full blur-3xl" />
        </div>

        <Card variant="glass-success" className="max-w-md w-full relative z-10">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4 shadow-lg shadow-emerald-500/25">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
              <p className="text-white/60 mb-6">
                We've sent a password reset link to <strong className="text-white">{email}</strong>.
                Click the link in the email to reset your password.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setSuccess(false)}
                  variant="glass"
                  className="w-full"
                >
                  Send Another Email
                </Button>
                <Button
                  onClick={() => router.push('/auth/login')}
                  variant="premium-primary"
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
              <p className="text-xs text-white/40 mt-4">
                Didn't receive the email? Check your spam folder or try again.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-cyan-950/20 to-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />

      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 mb-4 shadow-lg shadow-amber-500/25">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
          <p className="text-white/60">No worries, we'll send you reset instructions</p>
        </div>

        <Card variant="glass-warning">
          <CardHeader>
            <CardTitle className="text-white">Reset Password</CardTitle>
            <CardDescription className="text-white/60">
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="glass-destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label variant="glass" htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    variant="glass"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                variant="premium-primary"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending email...
                  </>
                ) : (
                  <>
                    Send Reset Email
                    <Mail className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/[0.08]">
              <Link
                href="/auth/login"
                className="flex items-center justify-center text-sm text-white/50 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/40 mt-6">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}