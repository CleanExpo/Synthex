'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  Video,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
} from '@/components/icons';
import { integrationsAPI } from '@/lib/api/settings';
import { toast } from 'sonner';

// Platform metadata for display
const PLATFORM_META: Record<string, {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  twitter: {
    name: 'Twitter / X',
    icon: Twitter,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-500',
    bgColor: 'bg-blue-600/10',
    borderColor: 'border-blue-600/20',
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  tiktok: {
    name: 'TikTok',
    icon: Video,
    color: 'text-white',
    bgColor: 'bg-white/10',
    borderColor: 'border-white/20',
  },
  pinterest: {
    name: 'Pinterest',
    icon: Link2,
    color: 'text-red-500',
    bgColor: 'bg-red-600/10',
    borderColor: 'border-red-600/20',
  },
  reddit: {
    name: 'Reddit',
    icon: Link2,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  threads: {
    name: 'Threads',
    icon: Link2,
    color: 'text-gray-300',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
  },
};

interface ConnectionStatus {
  platform: string;
  connected: boolean;
  username?: string;
  connectedAt?: string;
  isExpired: boolean;
  needsRefresh: boolean;
}

interface BusinessSocialAccountsProps {
  organizationId: string;
  organizationName: string;
  onConnectPlatform: (organizationId: string) => void;
}

export function BusinessSocialAccounts({
  organizationId,
  organizationName,
  onConnectPlatform,
}: BusinessSocialAccountsProps) {
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/auth/connections?organizationId=${organizationId}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch connections');
      const data = await response.json();
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Failed to load connections for business:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleDisconnect = async (platform: string) => {
    setDisconnectingId(platform);
    try {
      // Switch to this business context first, then disconnect
      await fetch('/api/businesses/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
        credentials: 'include',
      });

      await integrationsAPI.disconnectPlatform(platform);
      await loadConnections();
      toast.success(`Disconnected ${PLATFORM_META[platform]?.name || platform} from ${organizationName}`);
    } catch (error) {
      toast.error('Failed to disconnect platform');
    } finally {
      setDisconnectingId(null);
    }
  };

  const connectedPlatforms = connections.filter(c => c.connected);
  const disconnectedPlatforms = connections.filter(c => !c.connected);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-2 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading social accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {/* Connected Platforms */}
      {connectedPlatforms.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">
            Connected ({connectedPlatforms.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {connectedPlatforms.map((conn) => {
              const meta = PLATFORM_META[conn.platform] || {
                name: conn.platform,
                icon: Link2,
                color: 'text-gray-400',
                bgColor: 'bg-gray-500/10',
                borderColor: 'border-gray-500/20',
              };
              const Icon = meta.icon;

              return (
                <div
                  key={conn.platform}
                  className={`flex items-center justify-between p-3 rounded-lg border ${meta.bgColor} ${meta.borderColor}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`h-5 w-5 shrink-0 ${meta.color}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {meta.name}
                      </div>
                      {conn.username && (
                        <div className="text-xs text-gray-400 truncate">
                          @{conn.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {conn.isExpired || conn.needsRefresh ? (
                      <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Refresh
                      </Badge>
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(conn.platform)}
                      disabled={disconnectingId === conn.platform}
                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {disconnectingId === conn.platform ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Unlink className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 px-1">
          No social accounts connected for this business.
        </p>
      )}

      {/* Available Platforms (not connected) */}
      {disconnectedPlatforms.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">
            Available ({disconnectedPlatforms.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {disconnectedPlatforms.map((conn) => {
              const meta = PLATFORM_META[conn.platform];
              if (!meta) return null;
              const Icon = meta.icon;

              return (
                <button
                  key={conn.platform}
                  onClick={() => onConnectPlatform(organizationId)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-gray-600
                    text-gray-500 hover:text-gray-300 hover:border-gray-400 transition-colors text-sm`}
                >
                  <Icon className="h-4 w-4" />
                  {meta.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick connect CTA */}
      <div className="pt-2 border-t border-cyan-500/10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onConnectPlatform(organizationId)}
          className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/30"
        >
          <Link2 className="h-3 w-3 mr-2" />
          Manage All Connections
        </Button>
      </div>
    </div>
  );
}
