'use client';

/**
 * Platform Connector
 *
 * @description Component for connecting social media platforms during onboarding
 */

import React, { useState } from 'react';
import { Check, Loader2, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOnboarding } from './OnboardingContext';

// ============================================================================
// TYPES
// ============================================================================

interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface PlatformConnectorProps {
  onConnect?: (platform: string) => Promise<void>;
  onDisconnect?: (platform: string) => Promise<void>;
}

// ============================================================================
// PLATFORM DATA
// ============================================================================

const PLATFORMS: Platform[] = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '𝕏',
    color: 'bg-black',
    description: 'Share tweets and threads',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'f',
    color: 'bg-[#1877F2]',
    description: 'Post to pages and groups',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    color: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]',
    description: 'Share photos and reels',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'in',
    color: 'bg-[#0A66C2]',
    description: 'Professional networking',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '♪',
    color: 'bg-black',
    description: 'Short-form videos',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶',
    color: 'bg-[#FF0000]',
    description: 'Video content',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: 'P',
    color: 'bg-[#E60023]',
    description: 'Visual discovery',
  },
  {
    id: 'threads',
    name: 'Threads',
    icon: '@',
    color: 'bg-black',
    description: 'Text-based conversations',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function PlatformConnector({ onConnect, onDisconnect }: PlatformConnectorProps) {
  const { data, addPlatform, removePlatform } = useOnboarding();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    setError(null);

    try {
      if (onConnect) {
        await onConnect(platformId);
      } else {
        // Default behavior: redirect to OAuth
        window.location.href = `/api/auth/${platformId}/connect?redirect=/onboarding/step-2`;
        return;
      }

      addPlatform(platformId);
    } catch (err) {
      setError(`Failed to connect ${platformId}. Please try again.`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    setConnecting(platformId);
    setError(null);

    try {
      if (onDisconnect) {
        await onDisconnect(platformId);
      }

      removePlatform(platformId);
    } catch (err) {
      setError(`Failed to disconnect ${platformId}. Please try again.`);
    } finally {
      setConnecting(null);
    }
  };

  const isConnected = (platformId: string) => data.connectedPlatforms.includes(platformId);

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Platform grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) => {
          const connected = isConnected(platform.id);
          const isLoading = connecting === platform.id;

          return (
            <div
              key={platform.id}
              className={cn(
                'relative p-4 border rounded-lg transition-all duration-200',
                connected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50',
                isLoading && 'opacity-70'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Platform icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold',
                    platform.color
                  )}
                >
                  {platform.icon}
                </div>

                {/* Platform info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">{platform.name}</h3>
                  <p className="text-sm text-muted-foreground">{platform.description}</p>
                </div>

                {/* Connected indicator */}
                {connected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Action button */}
              <div className="mt-3">
                {connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDisconnect(platform.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => handleConnect(platform.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-2" />
                    )}
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection summary */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          {data.connectedPlatforms.length === 0 ? (
            'Connect at least one platform to continue'
          ) : (
            <>
              <span className="font-medium text-foreground">
                {data.connectedPlatforms.length}
              </span>{' '}
              platform{data.connectedPlatforms.length !== 1 ? 's' : ''} connected
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default PlatformConnector;
