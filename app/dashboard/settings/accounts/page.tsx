'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Chrome,
  Github,
  Mail,
  Link2,
  Unlink,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Key,
} from '@/components/icons';
import { toast } from 'sonner';
import Link from 'next/link';

interface LinkedAccount {
  id: string;
  provider: 'email' | 'google' | 'github' | 'demo';
  providerAccountId: string;
  createdAt: string;
  canUnlink: boolean;
  unlinkReason?: string;
  isPrimary?: boolean;
}

const providerConfig = {
  email: {
    name: 'Email & Password',
    icon: Mail,
    color: 'text-gray-400',
    description: 'Sign in with your email and password',
  },
  google: {
    name: 'Google',
    icon: Chrome,
    color: 'text-red-400',
    description: 'Sign in with your Google account',
  },
  github: {
    name: 'GitHub',
    icon: Github,
    color: 'text-gray-300',
    description: 'Sign in with your GitHub account',
  },
  demo: {
    name: 'Demo Mode',
    icon: Key,
    color: 'text-cyan-400',
    description: 'Demo authentication',
  },
};

export default function AccountsSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  // Handle success messages from URL
  useEffect(() => {
    const linked = searchParams.get('linked');
    if (linked) {
      toast.success(`Successfully linked ${providerConfig[linked as keyof typeof providerConfig]?.name || linked}!`);
      // Clear URL params
      router.replace('/dashboard/settings/accounts');
    }
  }, [searchParams, router]);

  // Load linked accounts
  const loadAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      // Authentication is handled via httpOnly cookies (security fix UNI-523)
      const response = await fetch('/api/auth/accounts', {
        credentials: 'include', // Send httpOnly auth cookies automatically
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Failed to load linked accounts');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Link a new provider
  const handleLink = async (provider: string) => {
    setLinkingProvider(provider);
    try {
      // Authentication is handled via httpOnly cookies (security fix UNI-523)
      const response = await fetch(`/api/auth/link/${provider}`, {
        credentials: 'include', // Send httpOnly auth cookies automatically
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate linking');
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (error: unknown) {
      console.error('Link error:', error);
      toast.error(error instanceof Error ? error.message : `Failed to link ${provider}`);
      setLinkingProvider(null);
    }
  };

  // Unlink a provider
  const handleUnlink = async (provider: string) => {
    // Confirm before unlinking
    const account = accounts.find((a) => a.provider === provider);
    if (!account?.canUnlink) {
      toast.error(account?.unlinkReason || 'Cannot unlink this account');
      return;
    }

    if (!confirm(`Are you sure you want to unlink ${providerConfig[provider as keyof typeof providerConfig]?.name}? You will no longer be able to sign in with it.`)) {
      return;
    }

    setUnlinkingProvider(provider);
    try {
      // Authentication is handled via httpOnly cookies (security fix UNI-523)
      const response = await fetch(`/api/auth/unlink/${provider}`, {
        method: 'POST',
        credentials: 'include', // Send httpOnly auth cookies automatically
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink account');
      }

      toast.success(`${providerConfig[provider as keyof typeof providerConfig]?.name} unlinked successfully`);
      await loadAccounts();
    } catch (error: unknown) {
      console.error('Unlink error:', error);
      toast.error(error instanceof Error ? error.message : `Failed to unlink ${provider}`);
    } finally {
      setUnlinkingProvider(null);
    }
  };

  // Get available providers to link
  const linkedProviders = accounts.map((a) => a.provider);
  const availableProviders = (['google', 'github'] as const).filter(
    (p) => !linkedProviders.includes(p)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold gradient-text">Linked Accounts</h1>
        <p className="text-gray-400 mt-1">
          Manage how you sign in to your account
        </p>
      </div>

      {/* Current Linked Accounts */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-cyan-400" />
            Your Authentication Methods
          </CardTitle>
          <CardDescription className="text-gray-400">
            These are the ways you can sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              <span className="ml-2 text-gray-400">Loading accounts...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No linked accounts found. This is unusual - please contact support.
            </div>
          ) : (
            accounts.map((account) => {
              const config = providerConfig[account.provider];
              const Icon = config?.icon || Mail;

              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full bg-white/10 ${config?.color || 'text-gray-400'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium flex items-center">
                        {config?.name || account.provider}
                        {account.isPrimary && (
                          <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-400">
                        {account.providerAccountId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Linked {new Date(account.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    {account.canUnlink ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlink(account.provider)}
                        disabled={unlinkingProvider === account.provider}
                        className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                      >
                        {unlinkingProvider === account.provider ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Unlinking...
                          </>
                        ) : (
                          <>
                            <Unlink className="mr-2 h-4 w-4" />
                            Unlink
                          </>
                        )}
                      </Button>
                    ) : (
                      <span
                        className="text-xs text-gray-500 cursor-help"
                        title={account.unlinkReason}
                      >
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        Cannot unlink
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Add More Auth Methods */}
      {availableProviders.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Link2 className="h-5 w-5 mr-2 text-cyan-400" />
              Link Additional Accounts
            </CardTitle>
            <CardDescription className="text-gray-400">
              Add more ways to sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableProviders.map((provider) => {
              const config = providerConfig[provider];
              const Icon = config.icon;

              return (
                <div
                  key={provider}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full bg-white/10 ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{config.name}</p>
                      <p className="text-sm text-gray-400">{config.description}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleLink(provider)}
                    disabled={linkingProvider === provider}
                    className="gradient-primary text-white"
                  >
                    {linkingProvider === provider ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Link {config.name}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Card variant="glass" className="border-amber-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-medium">Security Notice</p>
              <p className="text-sm text-gray-400 mt-1">
                Make sure to keep at least one authentication method active at all times.
                If you unlink all methods, you may lose access to your account.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                We recommend linking multiple authentication methods for backup access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
