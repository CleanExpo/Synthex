'use client';

import useSWR from 'swr';

interface GSCProperty {
  id: string;
  organizationId: string;
  connectionId: string;
  siteUrl: string;
  permissionLevel: string | null;
  isPrimary: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useGSCProperties() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    properties: GSCProperty[];
  }>('/api/seo/search-console/properties', fetchJson);

  const syncProperties = async () => {
    const response = await fetch('/api/seo/search-console/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to sync properties');
    }

    const result = await response.json();
    mutate();
    return result;
  };

  const primaryProperty =
    data?.properties?.find(p => p.isPrimary) ?? data?.properties?.[0];

  return {
    properties: data?.properties ?? [],
    primaryProperty,
    isLoading,
    error: error?.message,
    syncProperties,
    refresh: mutate,
  };
}
