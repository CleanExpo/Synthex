'use client';

import { useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';

interface GBPLocation {
  id: string;
  organizationId: string;
  connectionId: string;
  locationId: string;
  locationName: string;
  address: Record<string, unknown> | null;
  phone: string | null;
  website: string | null;
  categories: Record<string, unknown> | null;
  hours: Record<string, unknown> | null;
  verified: boolean;
  isPrimary: boolean;
  lastSyncedAt: string | null;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useGBPLocations() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    connected?: boolean;
    locations: GBPLocation[];
  }>('/api/google-business/locations', fetchJson);

  const syncLocations = useCallback(async () => {
    const response = await fetch('/api/google-business/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to sync locations');
    }

    const result = await response.json();
    await mutate();
    return result;
  }, [mutate]);

  const autoSyncAttempted = useRef(false);

  // After OAuth return (?connected=googlebusiness), sync real org-scoped
  // locations once — never seed fabricated listings.
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      isLoading ||
      autoSyncAttempted.current
    ) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') !== 'googlebusiness') return;
    if (!data?.connected) return;
    if ((data.locations?.length ?? 0) > 0) {
      params.delete('connected');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', next);
      return;
    }

    autoSyncAttempted.current = true;
    void syncLocations()
      .catch(() => {
        // Banner shows syncError / Sync CTA; leave ?connected for honesty.
      })
      .finally(() => {
        const cleaned = new URLSearchParams(window.location.search);
        cleaned.delete('connected');
        const next = `${window.location.pathname}${cleaned.toString() ? `?${cleaned}` : ''}`;
        window.history.replaceState({}, '', next);
      });
  }, [data?.connected, data?.locations?.length, isLoading, syncLocations]);

  const primaryLocation =
    data?.locations?.find(l => l.isPrimary) ?? data?.locations?.[0];

  return {
    locations: data?.locations ?? [],
    primaryLocation,
    connected: Boolean(data?.connected),
    isLoading,
    error: error?.message,
    syncLocations,
    refresh: mutate,
  };
}
