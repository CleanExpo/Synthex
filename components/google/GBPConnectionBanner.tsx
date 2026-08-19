'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Map, ExternalLink, RefreshCw, Loader2 } from '@/components/icons';

interface GBPConnectionBannerProps {
  /** When true, OAuth is already linked — show sync/empty honesty, not Connect. */
  connected?: boolean;
  onConnect?: () => void;
  onSync?: () => Promise<unknown>;
  syncError?: string | null;
}

/**
 * Unconnected: start Google Business OAuth (fetch → full-page redirect).
 * Connected but no synced locations: explicit sync CTA — never invent listings.
 */
export function GBPConnectionBanner({
  connected = false,
  onConnect,
  onSync,
  syncError = null,
}: GBPConnectionBannerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (onConnect) {
      onConnect();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const returnTo = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`
      );
      const res = await fetch(
        `/api/auth/oauth/googlebusiness?returnTo=${returnTo}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(
          data.message || data.error || 'Failed to start Google Business OAuth'
        );
      }
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start connection'
      );
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (!onSync) return;
    setBusy(true);
    setError(null);
    try {
      await onSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync locations');
    } finally {
      setBusy(false);
    }
  };

  const displayError = error || syncError;

  if (connected) {
    return (
      <div className="p-6 bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-500/10 rounded-lg">
            <Map className="w-6 h-6 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              Google Business Profile connected
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              No listing matched this organisation yet. Synthex only imports
              locations that exactly match your organisation website domain (or
              a single location with the same business name). We never invent
              listings — sync after connecting, or fix the match and try again.
            </p>
            {onSync && (
              <Button
                onClick={handleSync}
                disabled={busy}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync locations from Google
              </Button>
            )}
            {displayError && (
              <p className="text-sm text-orange-300 mt-3">{displayError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-500/10 rounded-lg">
          <Map className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            Connect Google Business Profile
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Connect your Google account to manage your business listings,
            respond to reviews, post updates, and track local search performance
            — all from Synthex. Listings stay empty until OAuth is connected and
            a matching location is synced.
          </p>
          <Button
            onClick={handleConnect}
            disabled={busy}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            Connect Google Business Profile
          </Button>
          {displayError && (
            <p className="text-sm text-orange-300 mt-3">{displayError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
