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
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Lock, 
  Loader2, 
  AlertCircle,
  Github,
  Chrome,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await auth.signIn(email, password);
      
      if (data.session) {
        toast.success('Welcome back! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    setError('');

    try {
      if (provider === 'google') {
        await auth.signInWithGoogle();
      } else {
        await auth.signInWithGithub();
      }
      // OAuth providers handle their own redirects
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`);
      toast.error(`${provider} login failed. Please try again.`);
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    toast.success('Entering demo mode...');
    router.push('/demo/integrations');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to your SYNTHEX account</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 bg-white/5 border-white/10"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link 
                    href="/auth/forgot-password" 
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 bg-white/5 border-white/10"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full gradient-primary text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="my-6">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 px-2 text-xs text-gray-400">
                OR CONTINUE WITH
              </span>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('google')}
                disabled={isLoading}
                className="w-full"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Continue with Google
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('github')}
                disabled={isLoading}
                className="w-full"
              >
                <Github className="w-4 h-4 mr-2" />
                Continue with GitHub
              </Button>
            </div>

            <Separator className="my-6 bg-white/10" />

            <div className="space-y-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDemoMode}
                className="w-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Try Demo Mode
              </Button>

              <p className="text-center text-sm text-gray-400">
                Don't have an account?{' '}
                <Link 
                  href="/auth/register" 
                  className="text-purple-400 hover:text-purple-300 font-medium"
                >
                  Sign up for free
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-gray-400">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-gray-400">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}