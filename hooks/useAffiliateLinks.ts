/**
 * Affiliate Links Hook
 *
 * @description Fetches affiliate link data and manages CRUD operations for
 * networks, links, and statistics.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  AffiliateNetwork,
  AffiliateLink,
  AffiliateStats,
  NetworkSlug,
  CreateNetworkInput,
  UpdateNetworkInput,
  CreateLinkInput,
  UpdateLinkInput,
  LinkFilters,
} from '@/lib/affiliates/affiliate-link-service';

// Re-export types for consumers
export type {
  AffiliateNetwork,
  AffiliateLink,
  AffiliateStats,
  NetworkSlug,
  CreateNetworkInput,
  UpdateNetworkInput,
  CreateLinkInput,
  UpdateLinkInput,
  LinkFilters,
};

// Re-export constants
export {
  NETWORK_SLUGS,
  NETWORK_LABELS,
  NETWORK_COLORS,
} from '@/lib/affiliates/affiliate-link-service';

// ============================================================================
// TYPES
// ============================================================================

export interface UseAffiliateLinksOptions {
  networkId?: string;
  category?: string;
  activeOnly?: boolean;
  autoInsertOnly?: boolean;
}

export interface AffiliateLinksData {
  networks: AffiliateNetwork[];
  links: AffiliateLink[];
  stats: AffiliateStats;
}

// ============================================================================
// HELPERS
// ============================================================================

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };

  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token');

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAffiliateLinks(options: UseAffiliateLinksOptions = {}) {
  const { networkId, category, activeOnly, autoInsertOnly } = options;

  // State
  const [data, setData] = useState<AffiliateLinksData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build query string for links
  const buildLinkQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (networkId) params.set('networkId', networkId);
    if (category) params.set('category', category);
    if (activeOnly) params.set('activeOnly', 'true');
    if (autoInsertOnly) params.set('autoInsertOnly', 'true');
    return params.toString();
  }, [networkId, category, activeOnly, autoInsertOnly]);

  // Fetch data
  const fetchData = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();
      const linkQuery = buildLinkQuery();
      const linkUrl = `/api/affiliates/links${linkQuery ? `?${linkQuery}` : ''}`;

      // Parallel fetch for networks, links, and stats
      const [networksRes, linksRes, statsRes] = await Promise.all([
        fetch('/api/affiliates/networks', {
          headers,
          signal: abortControllerRef.current.signal,
        }),
        fetch(linkUrl, {
          headers,
          signal: abortControllerRef.current.signal,
        }),
        fetch('/api/affiliates/stats', {
          headers,
          signal: abortControllerRef.current.signal,
        }),
      ]);

      if (!networksRes.ok || !linksRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch affiliate data');
      }

      const [networksData, linksData, statsData] = await Promise.all([
        networksRes.json(),
        linksRes.json(),
        statsRes.json(),
      ]);

      setData({
        networks: networksData.data || [],
        links: linksData.data || [],
        stats: statsData.data || {
          totalClicks: 0,
          totalConversions: 0,
          totalRevenue: 0,
          conversionRate: 0,
          networkBreakdown: [],
          topLinks: [],
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [buildLinkQuery]);

  // Initial fetch and refetch on options change
  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // ============================================================================
  // NETWORK MUTATIONS
  // ============================================================================

  const createNetwork = useCallback(async (input: CreateNetworkInput): Promise<AffiliateNetwork> => {
    setIsMutating(true);
    try {
      const res = await fetch('/api/affiliates/networks', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create network');
      }

      const { data: network } = await res.json();
      await fetchData();
      return network;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const updateNetwork = useCallback(async (
    networkId: string,
    input: UpdateNetworkInput
  ): Promise<AffiliateNetwork> => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/affiliates/networks/${networkId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update network');
      }

      const { data: network } = await res.json();
      await fetchData();
      return network;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const deleteNetwork = useCallback(async (networkId: string): Promise<void> => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/affiliates/networks/${networkId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete network');
      }

      await fetchData();
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  // ============================================================================
  // LINK MUTATIONS
  // ============================================================================

  const createLink = useCallback(async (input: CreateLinkInput): Promise<AffiliateLink> => {
    setIsMutating(true);
    try {
      const res = await fetch('/api/affiliates/links', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create link');
      }

      const { data: link } = await res.json();
      await fetchData();
      return link;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const updateLink = useCallback(async (
    linkId: string,
    input: UpdateLinkInput
  ): Promise<AffiliateLink> => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/affiliates/links/${linkId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update link');
      }

      const { data: link } = await res.json();
      await fetchData();
      return link;
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  const deleteLink = useCallback(async (linkId: string): Promise<void> => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/affiliates/links/${linkId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete link');
      }

      await fetchData();
    } finally {
      setIsMutating(false);
    }
  }, [fetchData]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Data
    networks: data?.networks ?? [],
    links: data?.links ?? [],
    stats: data?.stats ?? {
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      conversionRate: 0,
      networkBreakdown: [],
      topLinks: [],
    },
    isLoading,
    error,
    isMutating,

    // Actions
    refetch: fetchData,

    // Network mutations
    createNetwork,
    updateNetwork,
    deleteNetwork,

    // Link mutations
    createLink,
    updateLink,
    deleteLink,
  };
}

export default useAffiliateLinks;
