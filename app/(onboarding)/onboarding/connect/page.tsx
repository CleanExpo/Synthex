'use client';

/**
 * Onboarding — Step 3: Connect Social Platforms (OAuth)
 *
 * Shows platform cards for all detected social profiles (from pipeline analysis)
 * plus undetected platforms the user can add. Each card has a "Connect" button
 * that initiates the OAuth PKCE flow via /api/auth/oauth/[platform].
 *
 * After OAuth callback redirects back here, we refresh the connection status
 * and show the newly connected platform with synced profile info.
 *
 * "Skip for now" always available — platforms can be connected later from
 * Dashboard → Platforms.
 *
 * On "Finish Setup" → completes onboarding and navigates to /dashboard.
 *
 * @module app/(onboarding)/onboarding/connect/page
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Link2,
  Unlink,
  Zap,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StepProgressV2 } from '@/components/onboarding';
import { HelpVideo } from '@/components/ui/HelpVideo';
import {
  useExtensionHelper,
  ExtensionStatusBanner,
  ExtensionSocialHint,
  ExtensionInstallPrompt,
} from '@/components/onboarding/ChromeExtensionHelper';
import { notifyOAuthStarting } from '@/lib/chrome-extension/bridge';
import { toast } from 'sonner';
import type {
  PipelineResult,
  SocialProfile,
} from '@/lib/ai/onboarding-pipeline';
import { fireEvent } from '@/lib/analytics/onboarding-events';
import { BRAND_MIRROR_COOKIE } from '@/lib/constants/onboarding';

// ============================================================================
// PLATFORM CONFIG
// ============================================================================

interface PlatformConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
  colour: string;
}

const PLATFORM_LIST: PlatformConfig[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📸',
    description: 'Photos, Reels, Stories',
    colour: 'from-orange-500 to-orange-600',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '📘',
    description: 'Pages, Groups, Events',
    colour: 'from-blue-600 to-blue-700',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    description: 'Professional content',
    colour: 'from-blue-500 to-blue-600',
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    icon: '🐦',
    description: 'Tweets, Threads',
    colour: 'from-sky-400 to-sky-500',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    description: 'Short-form video',
    colour: 'from-gray-800 to-gray-900',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    description: 'Videos, Shorts',
    colour: 'from-red-500 to-red-600',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: '📌',
    description: 'Pins, Boards',
    colour: 'from-red-600 to-red-700',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🤖',
    description: 'Posts, Comments',
    colour: 'from-orange-500 to-orange-600',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '🧵',
    description: 'Text-based social',
    colour: 'from-gray-700 to-gray-800',
  },
];

const GOOGLE_SEO_LIST: PlatformConfig[] = [
  {
    id: 'searchconsole',
    label: 'Google Search Console',
    icon: '🔍',
    description: 'Search performance & indexing',
    colour: 'from-green-500 to-green-600',
  },
  {
    id: 'googlebusiness',
    label: 'Google Business Profile',
    icon: '📍',
    description: 'Local listings & reviews',
    colour: 'from-blue-500 to-blue-600',
  },
];

const SESSION_KEY = 'synthex_pipeline_result';

// ============================================================================
// TYPES
// ============================================================================

interface ConnectionStatus {
  platform: string;
  connected: boolean;
  profileName?: string;
  profileImage?: string;
  connectedAt?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

function ConnectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Chrome Extension helper (social login detection)
  const extensionState = useExtensionHelper();

  // Pipeline result (for detected platforms)
  const [detectedPlatforms, setDetectedPlatforms] = useState<string[]>([]);

  // Connection status from server
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  // UI state
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // ── SYN-504 client-side guard ─────────────────────────────────────
  // Middleware handles the primary gate. This is a backup for cases where
  // middleware is bypassed (e.g. client-side navigation via router.push).
  // Existing users (those with at least one existing connection) are exempt.
  useEffect(() => {
    if (loadingConnections) return; // Wait until we know connection state
    const hasExistingConnections = connections.length > 0;
    if (hasExistingConnections) return; // Existing user — bypass gate

    const brandMirrorViewed = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${BRAND_MIRROR_COOKIE}=`));
    if (!brandMirrorViewed) {
      router.replace('/onboarding');
    }
  }, [loadingConnections, connections, router]);

  // ── Load detected platforms from pipeline result ──────────────────
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const result: PipelineResult = JSON.parse(cached);
        const detected = (result.socialProfiles ?? []).map(p =>
          p.platform.toLowerCase()
        );
        setDetectedPlatforms(detected);
      }
    } catch {
      // No data — show all platforms
    }
  }, []);

  // ── Fetch current connection status ───────────────────────────────
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/connections', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // ── Handle OAuth callback (after redirect back) ───────────────────
  useEffect(() => {
    const platform = searchParams.get('connected');
    const error = searchParams.get('error');

    if (platform) {
      toast.success(`${platform} connected successfully!`);
      fireEvent('social_account_connected', { platform });
      // Refresh connections
      fetchConnections();
      // Clean URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }

    if (error) {
      toast.error(`Connection failed: ${error}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, fetchConnections]);

  // ── Connect platform ──────────────────────────────────────────────
  const handleConnect = async (platformId: string) => {
    setConnectingId(platformId);
    // Notify extension so it can pre-select the right account
    notifyOAuthStarting(platformId);
    try {
      const params = new URLSearchParams({
        returnTo: '/onboarding/connect',
      });

      const res = await fetch(
        `/api/auth/oauth/${platformId}?${params.toString()}`,
        {
          credentials: 'include',
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error || json.message || `Failed to initiate ${platformId} OAuth`
        );
      }

      if (json.authorizationUrl) {
        window.location.href = json.authorizationUrl;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `Failed to connect ${platformId}`;
      toast.error(message);
      setConnectingId(null);
    }
  };

  // ── Finish onboarding ─────────────────────────────────────────────
  const handleFinish = async () => {
    setFinishing(true);
    try {
      // 1. Complete onboarding (creates persona, sets onboardingComplete flag)
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        // Non-blocking — navigate anyway. Completion will be retried.
        console.warn('[connect] Completion endpoint failed:', await res.text());
      }

      // 2. Fire AI kickstart (fire-and-forget — generates first-week drafts)
      fetch('/api/onboarding/kickstart', {
        method: 'POST',
        credentials: 'include',
      }).catch(err => {
        console.warn('[connect] Kickstart failed (non-blocking):', err);
      });

      // 3. Clear sessionStorage
      sessionStorage.removeItem(SESSION_KEY);

      // 4. Mark onboarding as complete in localStorage for middleware
      localStorage.setItem('onboardingComplete', 'true');

      // 5. Trigger the ProductTour on first dashboard visit
      localStorage.setItem('showTourOnDashboard', 'true');

      router.push('/dashboard');
    } catch (err) {
      console.error('[connect] Finish error:', err);
      // Navigate anyway — dashboard will handle incomplete state
      router.push('/dashboard');
    } finally {
      setFinishing(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const isConnected = (platformId: string) =>
    connections.some(c => c.platform === platformId && c.connected);

  const getConnection = (platformId: string) =>
    connections.find(c => c.platform === platformId);

  const connectedCount = connections.filter(c => c.connected).length;

  // Sort: detected first, then connected, then rest
  const sortedPlatforms = [...PLATFORM_LIST].sort((a, b) => {
    const aDetected = detectedPlatforms.includes(a.id) ? 1 : 0;
    const bDetected = detectedPlatforms.includes(b.id) ? 1 : 0;
    const aConnected = isConnected(a.id) ? 1 : 0;
    const bConnected = isConnected(b.id) ? 1 : 0;
    return bDetected + bConnected - (aDetected + aConnected);
  });

  return (
    <div className="space-y-6">
      {/* Progress */}
      <StepProgressV2 currentStep={3} />

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">
          Connect Your Platforms
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          Connect your social media accounts so SYNTHEX can manage your content.
          You can always add more later from the dashboard.
        </p>
        {connectedCount > 0 && (
          <p className="text-sm text-orange-400">
            {connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected
          </p>
        )}
        <HelpVideo videoId="onboarding-connect-social" />
      </div>

      {/* Chrome Extension — active sessions banner */}
      <ExtensionStatusBanner state={extensionState} />

      {/* Chrome Extension — install prompt (only when not installed) */}
      {!extensionState.loading && !extensionState.available && (
        <ExtensionInstallPrompt className="max-w-2xl mx-auto" />
      )}

      {/* Platform cards */}
      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sortedPlatforms.map(platform => {
          const connected = isConnected(platform.id);
          const connection = getConnection(platform.id);
          const detected = detectedPlatforms.includes(platform.id);
          const connecting = connectingId === platform.id;

          return (
            <div
              key={platform.id}
              className={cn(
                'p-4 rounded-xl border transition-all',
                connected
                  ? 'bg-green-500/5 border-green-500/20'
                  : detected
                    ? 'bg-orange-500/5 border-orange-500/20'
                    : 'bg-surface-base/80 border-white/5 hover:border-white/10'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{platform.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">
                        {platform.label}
                      </h3>
                      {detected && !connected && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 bg-orange-500/10 text-orange-400 border-orange-500/20"
                        >
                          Detected
                        </Badge>
                      )}
                    </div>
                    {connected && connection?.profileName ? (
                      <p className="text-xs text-green-400 truncate">
                        ✓ {connection.profileName}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        {platform.description}
                      </p>
                    )}
                    {/* Extension hint — "already logged in" */}
                    {!connected && (
                      <ExtensionSocialHint
                        platformId={platform.id}
                        loggedInPlatforms={extensionState.loggedInPlatforms}
                      />
                    )}
                  </div>
                </div>

                {/* Connect / Connected button */}
                <div className="shrink-0">
                  {connected ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Connected</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnect(platform.id)}
                      disabled={connecting || connectingId !== null}
                      className={cn(
                        'text-xs h-8 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/30',
                        connecting && 'opacity-70'
                      )}
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Connecting…
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3 h-3 mr-1" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Google Search & Local */}
      <div className="max-w-2xl mx-auto space-y-3 pt-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-white">
            Google Search & Local
          </h2>
          <p className="text-sm text-gray-500">
            Optional — connect for SEO monitoring and local presence management
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GOOGLE_SEO_LIST.map(platform => {
            const connected = isConnected(platform.id);
            const connection = getConnection(platform.id);
            const connecting = connectingId === platform.id;

            return (
              <div
                key={platform.id}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  connected
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-surface-base/80 border-white/5 hover:border-white/10'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{platform.icon}</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-white">
                        {platform.label}
                      </h3>
                      {connected && connection?.profileName ? (
                        <p className="text-xs text-green-400 truncate">
                          ✓ {connection.profileName}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          {platform.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {connected ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Connected</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConnect(platform.id)}
                        disabled={connecting || connectingId !== null}
                        className={cn(
                          'text-xs h-8 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/30',
                          connecting && 'opacity-70'
                        )}
                      >
                        {connecting ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Connecting…
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3 h-3 mr-1" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading indicator */}
      {loadingConnections && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between max-w-2xl mx-auto pt-4 pb-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleFinish}
            disabled={finishing}
            title="You can connect any time from Settings → Platforms"
            className="text-gray-400 hover:text-white"
          >
            {connectedCount === 0
              ? "I'll connect later"
              : "I'll connect more later"}
          </Button>

          <Button
            size="lg"
            onClick={handleFinish}
            disabled={finishing}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all disabled:opacity-50 px-8"
          >
            {finishing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Finishing…
              </>
            ) : (
              <>
                Finish Setup
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary — wrap inner component
export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
        </div>
      }
    >
      <ConnectPageInner />
    </Suspense>
  );
}
