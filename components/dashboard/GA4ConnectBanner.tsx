'use client';

/**
 * GA4ConnectBanner — SYN-635
 *
 * Dismissable in-app prompt shown to orgs without an active Google Analytics
 * connection. Directs users to /dashboard/platforms to complete the OAuth flow.
 *
 * Self-hides when:
 *   - GA4 is already connected (platform === 'googleanalytics', connected === true)
 *   - The user has dismissed it for their current org (localStorage)
 *   - Connections are still loading
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocialConnections } from '@/hooks/use-social-connections';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { X, BarChart3 } from '@/components/icons';

function getDismissKey(orgId: string | null): string {
  return orgId ? `ga4BannerDismissed_${orgId}` : 'ga4BannerDismissed_default';
}

export function GA4ConnectBanner() {
  const { activeOrganizationId } = useActiveBusiness();
  const { connections, isLoading } = useSocialConnections(activeOrganizationId);
  const [dismissed, setDismissed] = useState(true); // start true to prevent hydration flash

  useEffect(() => {
    const wasDismissed =
      localStorage.getItem(getDismissKey(activeOrganizationId)) === 'true';
    setDismissed(wasDismissed);
  }, [activeOrganizationId]);

  const handleDismiss = () => {
    localStorage.setItem(getDismissKey(activeOrganizationId), 'true');
    setDismissed(true);
  };

  // GA4 is connected when a googleanalytics connection exists and is active
  const ga4Connected = connections.some(
    c => c.platform === 'googleanalytics' && c.connected
  );

  if (isLoading || dismissed || ga4Connected) {
    return null;
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 p-2 rounded-lg bg-blue-500/20">
          <BarChart3 className="h-4 w-4 text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            Connect Google Analytics to unlock ROI reporting
          </p>
          <p className="text-xs text-slate-300 mt-0.5">
            GA4 powers attribution tracking, Effect Report revenue figures, and
            website traffic insights. Takes 60 seconds to set up.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/dashboard/platforms?highlight=googleanalytics"
          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
        >
          Connect GA4
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
