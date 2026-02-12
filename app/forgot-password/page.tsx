'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from '@/components/icons';
import { SynthexLogo } from '@/components/marketing/MarketingLayout';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate email
      if (!email) {
        throw new Error('Please enter your email address');
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // In production, this would call the actual password reset API
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reset email');
      }

      setIsSubmitted(true);
    } catch (err: unknown) {
      // For now, simulate success in development
      if (process.env.NODE_ENV === 'development') {
        setIsSubmitted(true);
      } else {
        const message = err instanceof Error ? err.message : 'An error occurred. Please try again.';
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4 relative overflow-hidden">
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

        <Card className="relative z-10 w-full max-w-md bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 shadow-2xl shadow-cyan-500/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Check Your Email</CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              We've sent password reset instructions to <span className="text-cyan-400 font-medium">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-cyan-500/10 border-cyan-500/20">
              <AlertCircle className="h-4 w-4 text-cyan-400" />
              <AlertDescription className="text-gray-300">
                If you don't see the email, check your spam folder or try resending it.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                onClick={() => router.push('/login')}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
              >
                Return to Login
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                className="w-full border-cyan-500/20 bg-transparent text-gray-300 hover:bg-cyan-500/10 hover:text-white hover:border-cyan-500/40"
              >
                Try Different Email
              </Button>
            </div>

            <p className="text-center text-sm text-gray-400">
              Didn't receive the email?{' '}
              <button
                onClick={handleSubmit}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                disabled={isLoading}
              >
                Resend
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4 relative overflow-hidden">
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

      <Card className="relative z-10 w-full max-w-md bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 shadow-2xl shadow-cyan-500/5">
        <CardHeader>
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-gray-400 hover:text-cyan-400 transition mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Login
          </Link>

          {/* Synthex Logo */}
          <div className="flex items-center space-x-3 mb-4">
            <SynthexLogo className="w-10 h-10" />
            <span className="text-xl font-bold tracking-tight text-white">SYNTHEX</span>
          </div>

          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
            Reset Your Password
          </CardTitle>
          <CardDescription className="text-gray-400">
            Enter your email address and we'll send you instructions to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="bg-red-500/10 border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-[#0a1628]/50 border-cyan-500/20 focus:border-cyan-500/50 focus:ring-cyan-500/20 text-white placeholder:text-gray-500"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                'Send Reset Instructions'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-400">
              Remember your password?{' '}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
