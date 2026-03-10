'use client';

import useSWR from 'swr';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

interface ConnectionStatus {
  platform: string;
  connected: boolean;
  username?: string;
  avatar?: string;
  connectedAt?: string;
  expiresAt?: string;
  isExpired: boolean;
  needsRefresh: boolean;
}

interface ConnectionsSummary {
  total: number;
  connected: number;
  needsAttention: number;
}

interface UseConnectionsResult {
  connections: ConnectionStatus[];
  summary: ConnectionsSummary | null;
  isLoading: boolean;
  error: unknown;
  mutate: () => void;
  connect: (platform: string) => Promise<void>;
  disconnect: (platform: string) => Promise<void>;
}

export function useSocialConnections(): UseConnectionsResult {
  const { data, error, isLoading, mutate } = useSWR<{
    connections: ConnectionStatus[];
    summary: ConnectionsSummary;
  }>('/api/auth/connections', fetchJson, {
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  // Initiate OAuth flow for a platform.
  // Uses plain fetch() in a mutation callback (not SWR) per project data fetching rules.
  // The window.location.href redirect is intentional — OAuth requires full browser navigation.
  const connect = async (platform: string): Promise<void> => {
    const params = new URLSearchParams({ returnTo: '/dashboard/platforms' });
    const res = await fetch(`/api/auth/oauth/${platform}?${params.toString()}`, {
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.message || `Failed to initiate ${platform} OAuth`);
    }
    if (json.authorizationUrl) {
      window.location.href = json.authorizationUrl;
    }
  };

  // Disconnect a platform
  const disconnect = async (platform: string): Promise<void> => {
    const res = await fetch(`/api/auth/connections?platform=${encodeURIComponent(platform)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Failed to disconnect ${platform}`);
    }
    await mutate();
  };

  return {
    connections: data?.connections ?? [],
    summary: data?.summary ?? null,
    isLoading,
    error,
    mutate,
    connect,
    disconnect,
  };
}
