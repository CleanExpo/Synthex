'use client';

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
    locations: GBPLocation[];
  }>('/api/google-business/locations', fetchJson);

  const syncLocations = async () => {
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
    mutate();
    return result;
  };

  const primaryLocation =
    data?.locations?.find(l => l.isPrimary) ?? data?.locations?.[0];

  return {
    locations: data?.locations ?? [],
    primaryLocation,
    isLoading,
    error: error?.message,
    syncLocations,
    refresh: mutate,
  };
}
