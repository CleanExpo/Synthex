'use client';

/**
 * Integrations Tab Component
 * Platform connections and API key management
 */

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Key, Plus, Trash2, Building2, Copy, ExternalLink } from '@/components/icons';
import { ConnectionStatusBadge, type ConnectionState } from '@/components/realtime/ConnectionStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { AICredentialsManager } from './ai-credentials-manager';
import { PlatformCredentialsManager } from './platform-credentials-manager';
import type { PlatformConnection, ApiKey } from './types';

// ── Unite-Hub Integration Card ─────────────────────────────────────────────────
// Self-contained, owner-only card. Self-gates: returns null for non-owners
// because the /api/unite-hub/status endpoint returns 403 for non-owners.

interface UniteHubStatus {
  configured: boolean;
  reachable: boolean;
  domain: string | null;
  pullEndpoint: string;
  eventTypes: string[];
  error?: string;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

function UniteHubIntegrationCard() {
  const [copying, setCopying] = useState(false);

  const { data, isLoading } = useSWR<UniteHubStatus>(
    '/api/unite-hub/status',
    fetchJson,
    { revalidateOnFocus: false }
  );

  // Non-owners receive 403 — API returns { error: 'Access denied' }
  if (!isLoading && (data?.error || !data)) return null;

  const connectionState: ConnectionState = !data?.configured
    ? 'disconnected'
    : data.reachable
    ? 'connected'
    : 'reconnecting';

  const handleCopy = async () => {
    if (!data?.pullEndpoint) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(data.pullEndpoint);
      toast.success('Copied to clipboard', {
        description: 'Paste this URL into your Unite-Group Nexus settings.',
      });
    } catch {
      toast.error('Could not copy — please select and copy manually.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 shrink-0">
              <Building2 className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base">Unite-Group Nexus</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Real-time event stream to the Unite-Group operations dashboard
              </CardDescription>
            </div>
          </div>
          {!isLoading && <ConnectionStatusBadge state={connectionState} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : (
          <>
            {/* Pull endpoint */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400">
                Pull Endpoint{' '}
                <span className="text-gray-600 font-normal">(configure in Unite-Group)</span>
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 font-mono text-[11px] text-cyan-300 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5 truncate">
                  {data?.pullEndpoint ?? '—'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
                  onClick={handleCopy}
                  disabled={copying}
                  aria-label="Copy pull endpoint URL"
                >
                  <Copy className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </div>
            </div>

            {/* Event count + link row */}
            <div className="flex items-center justify-between">
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">
                {data?.eventTypes?.length ?? 8} event types active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-gray-400 hover:text-white hover:bg-white/[0.06] gap-1.5"
                onClick={() =>
                  window.open('https://unite-hub.unite-group.com.au', '_blank', 'noopener,noreferrer')
                }
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Unite-Group
              </Button>
            </div>

            {!data?.configured && (
              <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                Configure <code className="font-mono">UNITE_HUB_API_URL</code> and{' '}
                <code className="font-mono">UNITE_HUB_API_KEY</code> to activate this integration.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface IntegrationsTabProps {
  platforms: PlatformConnection[];
  apiKeys: ApiKey[];
  activeBusinessName?: string | null;
  onConnect: (platformId: string) => void;
  onDisconnect: (platformId: string) => void;
  onCreateApiKey: () => void;
  onDeleteApiKey: (keyId: string) => void;
}

export function IntegrationsTab({
  platforms,
  apiKeys,
  activeBusinessName,
  onConnect,
  onDisconnect,
  onCreateApiKey,
  onDeleteApiKey,
}: IntegrationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Unite-Group Nexus — owner-only, self-gates for non-owners */}
      <UniteHubIntegrationCard />

      {/* Platform Connections */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Connected Platforms</CardTitle>
          <CardDescription>
            {activeBusinessName
              ? `Social accounts for ${activeBusinessName}`
              : 'Manage your social media integrations'}
          </CardDescription>
          {activeBusinessName && (
            <Badge className="w-fit bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mt-2">
              Business: {activeBusinessName}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                    {platform.icon}
                  </div>
                  <div>
                    <p className="font-medium text-white">{platform.name}</p>
                    {platform.connected && platform.username && (
                      <p className="text-sm text-slate-400">{platform.username}</p>
                    )}
                  </div>
                </div>
                {platform.connected ? (
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDisconnect(platform.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onConnect(platform.id)}
                    className="bg-white/5 border-white/10"
                  >
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Provider Credentials */}
      <AICredentialsManager />

      {/* Platform OAuth Credentials (owner only — self-gates via API) */}
      <PlatformCredentialsManager />

      {/* Platform API Keys */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Platform API Keys</CardTitle>
            <CardDescription>Manage Synthex API keys for external integrations</CardDescription>
          </div>
          <Button onClick={onCreateApiKey} size="sm" className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Key
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-cyan-500" />
                  <div>
                    <p className="font-medium text-white">{apiKey.name}</p>
                    <p className="text-sm text-slate-400 font-mono">{apiKey.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-slate-400">Created: {apiKey.created}</p>
                    <p className="text-slate-500">Last used: {apiKey.lastUsed}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteApiKey(apiKey.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    aria-label={`Delete API key ${apiKey.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
