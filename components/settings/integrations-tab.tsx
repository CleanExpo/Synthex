'use client';

/**
 * Integrations Tab Component
 * Platform connections and API key management
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Key, Plus, Trash2 } from '@/components/icons';
import { AICredentialsManager } from './ai-credentials-manager';
import { PlatformCredentialsManager } from './platform-credentials-manager';
import type { PlatformConnection, ApiKey } from './types';

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
