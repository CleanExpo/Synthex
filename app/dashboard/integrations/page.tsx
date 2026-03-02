'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ThirdPartyCard, ConnectDialog } from '@/components/integrations';
import { useThirdPartyIntegrations, type ThirdPartyProvider } from '@/hooks/use-third-party-integrations';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/types';
import { integrationsAPI } from '@/lib/api/settings';
import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  Youtube,
  Pinterest,
  Reddit,
  Threads,
  Link2,
  Unlink,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Settings,
  RefreshCw,
  Shield,
  Loader2,
  Palette,
  Clock,
  Zap,
  Search,
  BarChart2,
  HardDrive,
} from '@/components/icons';
import { toast } from 'sonner';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  color: string;
  accountName?: string;
  permissions?: string[];
}

const THIRD_PARTY_ICONS: Record<ThirdPartyProvider, React.ComponentType<{ className?: string }>> = {
  canva: Palette,
  buffer: Clock,
  zapier: Zap,
};

// All 9 supported social platforms
const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'Connect your Twitter account to post and analyze tweets',
    icon: Twitter,
    connected: false,
    color: 'text-blue-400',
    permissions: ['Post tweets', 'Read analytics', 'Schedule posts'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Share professional content and track engagement',
    icon: Linkedin,
    connected: false,
    color: 'text-blue-600',
    permissions: ['Post updates', 'Read analytics', 'Manage pages'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Post photos, stories, and reels to Instagram',
    icon: Instagram,
    connected: false,
    color: 'text-pink-500',
    permissions: ['Post content', 'View insights', 'Manage comments'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Manage Facebook pages and track performance',
    icon: Facebook,
    connected: false,
    color: 'text-blue-500',
    permissions: ['Manage pages', 'Post content', 'Read insights'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Create and schedule TikTok videos',
    icon: Video,
    connected: false,
    color: 'text-gray-900',
    permissions: ['Post videos', 'View analytics', 'Manage account'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Upload and manage YouTube videos and analytics',
    icon: Youtube,
    connected: false,
    color: 'text-red-500',
    permissions: ['Upload videos', 'Read analytics', 'Manage playlists'],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    description: 'Create pins, manage boards, and track engagement',
    icon: Pinterest,
    connected: false,
    color: 'text-red-600',
    permissions: ['Create pins', 'Read analytics', 'Manage boards'],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    description: 'Post content and engage with Reddit communities',
    icon: Reddit,
    connected: false,
    color: 'text-orange-500',
    permissions: ['Submit posts', 'Read content', 'Manage profile'],
  },
  {
    id: 'threads',
    name: 'Threads',
    description: 'Share and engage on Meta Threads',
    icon: Threads,
    connected: false,
    color: 'text-gray-300',
    permissions: ['Post content', 'Read replies', 'View profile'],
  },
];

// Analytics, SEO & Storage integrations (Google OAuth)
const DEFAULT_ANALYTICS_INTEGRATIONS: Integration[] = [
  {
    id: 'searchconsole',
    name: 'Google Search Console',
    description: 'Track search performance, queries, impressions, and ranking data',
    icon: Search,
    connected: false,
    color: 'text-green-400',
    permissions: ['Read search queries', 'View impressions & clicks', 'Monitor rankings'],
  },
  {
    id: 'googleanalytics',
    name: 'Google Analytics (GA4)',
    description: 'Web analytics: sessions, users, conversions, and campaign attribution',
    icon: BarChart2,
    connected: false,
    color: 'text-orange-400',
    permissions: ['Read analytics data', 'View conversions', 'Audience insights'],
  },
  {
    id: 'googledrive',
    name: 'Google Drive',
    description: 'Store and manage all content, media, and reports in your own Google Drive using QMD format',
    icon: HardDrive,
    connected: false,
    color: 'text-blue-300',
    permissions: ['Store content & media', 'Organise with QMD taxonomy', 'AI-managed file structure'],
  },
];

export default function IntegrationsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Third-party integrations
  const {
    integrations: thirdPartyIntegrations,
    loading: thirdPartyLoading,
    connect: thirdPartyConnect,
    disconnect: thirdPartyDisconnect,
    refresh: thirdPartyRefresh,
  } = useThirdPartyIntegrations();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ThirdPartyProvider | null>(null);
  const [thirdPartyActionLoading, setThirdPartyActionLoading] = useState<ThirdPartyProvider | null>(null);

  const [integrations, setIntegrations] = useState<Integration[]>(DEFAULT_INTEGRATIONS);
  const [analyticsIntegrations, setAnalyticsIntegrations] = useState<Integration[]>(DEFAULT_ANALYTICS_INTEGRATIONS);

  // Load actual connection status on mount
  const loadConnectionStatus = useCallback(async () => {
    try {
      const data = await integrationsAPI.getIntegrations();
      const connected = data.integrations || {};
      const details = data.details || {};

      setIntegrations(prev =>
        prev.map(integration => ({
          ...integration,
          connected: !!connected[integration.id],
          accountName: details[integration.id]?.profileName || undefined,
        }))
      );
      setAnalyticsIntegrations(prev =>
        prev.map(integration => ({
          ...integration,
          connected: !!connected[integration.id],
          accountName: details[integration.id]?.profileName || undefined,
        }))
      );
    } catch {
      // Silently fail — show all as disconnected
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  // Handle full-page redirect OAuth results (e.g. Reddit)
  // The callback's no-opener fallback sends ?oauth_success=1&platform=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const platform = params.get('platform');

    if (!platform) return;

    // Clean the URL immediately regardless of outcome
    const url = new URL(window.location.href);
    url.searchParams.delete('oauth_success');
    url.searchParams.delete('oauth_error');
    url.searchParams.delete('platform');
    window.history.replaceState({}, '', url.toString());

    const allIntegrations = [...DEFAULT_INTEGRATIONS, ...DEFAULT_ANALYTICS_INTEGRATIONS];
    const name = allIntegrations.find(i => i.id === platform)?.name || platform;

    if (oauthSuccess === '1') {
      toast.success(`Connected to ${name} successfully!`);
      loadConnectionStatus();
    } else if (oauthError === '1') {
      toast.error(`Connection to ${name} was cancelled or failed.`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // OAuth popup connect flow (proper OAuth via /api/auth/oauth/[platform])
  const handleConnect = async (id: string) => {
    setConnectingId(id);
    try {
      await integrationsAPI.connectPlatform(id);
      // Reload connection status from API after successful connect
      await loadConnectionStatus();
      toast.success(`Connected to ${integrations.find(i => i.id === id)?.name || id} successfully!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setConnectingId(id);
    try {
      await integrationsAPI.disconnectPlatform(id);
      const disconnected = { connected: false as const, accountName: undefined };
      setIntegrations(prev =>
        prev.map(i => i.id === id ? { ...i, ...disconnected } : i)
      );
      setAnalyticsIntegrations(prev =>
        prev.map(i => i.id === id ? { ...i, ...disconnected } : i)
      );
      const name =
        integrations.find(i => i.id === id)?.name ||
        analyticsIntegrations.find(i => i.id === id)?.name ||
        id;
      toast.success(`${name} disconnected`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect. Please try again.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleRefresh = async (id: string) => {
    setConnectingId(id);
    try {
      // Re-run OAuth to get fresh tokens
      await integrationsAPI.connectPlatform(id);
      await loadConnectionStatus();
      toast.success('Connection refreshed successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh connection');
    } finally {
      setConnectingId(null);
    }
  };

  // Third-party handlers
  const handleThirdPartyConnect = (provider: ThirdPartyProvider) => {
    setSelectedProvider(provider);
    setConnectDialogOpen(true);
  };

  const handleThirdPartyDisconnect = async (provider: ThirdPartyProvider) => {
    setThirdPartyActionLoading(provider);
    try {
      await thirdPartyDisconnect(provider);
      const config = INTEGRATION_REGISTRY[provider];
      toast.success(`${config.name} disconnected`);
    } catch (error) {
      toast.error('Failed to disconnect. Please try again.');
    } finally {
      setThirdPartyActionLoading(null);
    }
  };

  const handleThirdPartyRefresh = async (provider: ThirdPartyProvider) => {
    setThirdPartyActionLoading(provider);
    try {
      await thirdPartyRefresh(provider);
      toast.success('Connection refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh connection');
    } finally {
      setThirdPartyActionLoading(null);
    }
  };

  const handleThirdPartySubmit = async (credentials: Record<string, string>) => {
    if (!selectedProvider) return;
    await thirdPartyConnect(selectedProvider, credentials);
    const config = INTEGRATION_REGISTRY[selectedProvider];
    toast.success(`${config.name} connected successfully!`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-gray-400">
          Connect your social media accounts to start creating and scheduling content
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnecting = connectingId === integration.id;
          
          return (
            <Card key={integration.id} variant="glass">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gray-800/50 ${integration.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      {integration.connected && integration.accountName && (
                        <p className="text-sm text-gray-400 mt-1">{integration.accountName}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={integration.connected ? "default" : "secondary"}>
                    {integration.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription>{integration.description}</CardDescription>
                
                {integration.permissions && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-400 mb-2">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {integration.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {integration.connected ? (
                    <>
                      <Button
                        onClick={() => handleRefresh(integration.id)}
                        disabled={isConnecting}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Refresh
                      </Button>
                      <Button
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={isConnecting}
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Unlink className="w-4 h-4" />
                        )}
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleConnect(integration.id)}
                      disabled={isConnecting}
                      className="w-full gradient-primary text-white"
                      size="sm"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analytics & SEO Section */}
      <div className="border-t border-white/10 mt-10 pt-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Analytics, SEO & Storage</h2>
          <p className="text-gray-400">
            Connect Google tools to track performance, analytics, and store all your content in Drive
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {analyticsIntegrations.map((integration) => {
            const Icon = integration.icon;
            const isConnecting = connectingId === integration.id;

            return (
              <Card key={integration.id} variant="glass">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-gray-800/50 ${integration.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        {integration.connected && integration.accountName && (
                          <p className="text-sm text-gray-400 mt-1">{integration.accountName}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={integration.connected ? "default" : "secondary"}>
                      {integration.connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>{integration.description}</CardDescription>

                  {integration.permissions && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-400 mb-2">Permissions:</p>
                      <div className="flex flex-wrap gap-1">
                        {integration.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {integration.connected ? (
                      <>
                        <Button
                          onClick={() => handleRefresh(integration.id)}
                          disabled={isConnecting}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Refresh
                        </Button>
                        <Button
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={isConnecting}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                        >
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Unlink className="w-4 h-4" />
                          )}
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleConnect(integration.id)}
                        disabled={isConnecting}
                        className="w-full gradient-primary text-white"
                        size="sm"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Third-Party Tools Section */}
      <div className="border-t border-white/10 mt-10 pt-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Third-Party Tools</h2>
          <p className="text-gray-400">
            Connect design, scheduling, and automation tools
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(INTEGRATION_REGISTRY) as ThirdPartyProvider[]).map((provider) => {
            const config = INTEGRATION_REGISTRY[provider];
            const integration = thirdPartyIntegrations.find((i) => i.provider === provider);
            const Icon = THIRD_PARTY_ICONS[provider];

            return (
              <ThirdPartyCard
                key={provider}
                provider={provider}
                name={config.name}
                description={config.description}
                icon={Icon}
                category={config.category}
                connected={integration?.connected ?? false}
                loading={thirdPartyActionLoading === provider}
                onConnect={() => handleThirdPartyConnect(provider)}
                onDisconnect={() => handleThirdPartyDisconnect(provider)}
                onConfigure={() => handleThirdPartyRefresh(provider)}
              />
            );
          })}
        </div>
      </div>

      {/* Connect Dialog for Third-Party */}
      {selectedProvider && (
        <ConnectDialog
          open={connectDialogOpen}
          onOpenChange={setConnectDialogOpen}
          provider={selectedProvider}
          providerName={INTEGRATION_REGISTRY[selectedProvider].name}
          requiredFields={INTEGRATION_REGISTRY[selectedProvider].requiredFields}
          oauthSupported={INTEGRATION_REGISTRY[selectedProvider].oauthSupported}
          onSubmit={handleThirdPartySubmit}
        />
      )}

      <Card variant="glass" className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            Security & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-400">
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              Your credentials are encrypted and stored securely
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              We only request necessary permissions for each platform
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              You can revoke access at any time from this page
            </p>
            <p className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              Some features may require re-authentication after 30 days
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}