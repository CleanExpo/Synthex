/**
 * Link in Bio Hook
 *
 * @description Manages bio pages and links state and operations.
 * Provides pages list, current page, links, and CRUD actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface LinkBioPage {
  id: string;
  userId: string;
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  theme: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonStyle: string;
  socialLinks: Array<{ platform: string; url: string }>;
  isPublished: boolean;
  showBranding: boolean;
  totalViews: number;
  totalClicks: number;
  createdAt: string;
  updatedAt: string;
  links?: LinkBioLink[];
  _count?: { links: number };
}

export interface LinkBioLink {
  id: string;
  pageId: string;
  title: string;
  url: string;
  description: string | null;
  iconType: string | null;
  iconValue: string | null;
  order: number;
  isVisible: boolean;
  isHighlighted: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkBioTotals {
  totalPages: number;
  totalViews: number;
  totalClicks: number;
}

export interface UseLinkBioOptions {
  pageId?: string; // If provided, load specific page with links
}

// ============================================================================
// HELPERS
// ============================================================================

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token')
  );
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function useLinkBio(options: UseLinkBioOptions = {}) {
  const { pageId } = options;

  // Data state
  const [pages, setPages] = useState<LinkBioPage[]>([]);
  const [currentPage, setCurrentPage] = useState<LinkBioPage | null>(null);
  const [links, setLinks] = useState<LinkBioLink[]>([]);
  const [totals, setTotals] = useState<LinkBioTotals>({
    totalPages: 0,
    totalViews: 0,
    totalClicks: 0,
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all pages
   */
  const fetchPages = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/bio', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        setPages(data.pages);
        setTotals(data.totals);
      }
    } catch (err) {
      console.error('Failed to fetch bio pages:', err);
    }
  }, []);

  /**
   * Fetch single page with links
   */
  const fetchPage = useCallback(async (id: string): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bio/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        setCurrentPage(data.page);
        setLinks(data.page.links || []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Create new page
   */
  const createPage = useCallback(async (title: string, bio?: string): Promise<LinkBioPage | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bio', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, bio }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        setPages(prev => [data.page, ...prev]);
        setTotals(prev => ({ ...prev, totalPages: prev.totalPages + 1 }));
        return data.page;
      }
      return null;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Update page
   */
  const updatePage = useCallback(async (
    id: string,
    data: Partial<Omit<LinkBioPage, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/bio/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && mountedRef.current) {
        // Update current page if it's the one being edited
        if (currentPage?.id === id) {
          setCurrentPage(result.page);
          setLinks(result.page.links || []);
        }
        // Update in pages list
        setPages(prev => prev.map(p => p.id === id ? result.page : p));
        return true;
      }
      return false;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [currentPage?.id]);

  /**
   * Delete page
   */
  const deletePage = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic update
    const previousPages = pages;
    setPages(prev => prev.filter(p => p.id !== id));
    setTotals(prev => ({ ...prev, totalPages: Math.max(0, prev.totalPages - 1) }));

    try {
      const response = await fetch(`/api/bio/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Clear current page if it was deleted
      if (currentPage?.id === id && mountedRef.current) {
        setCurrentPage(null);
        setLinks([]);
      }

      return true;
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setPages(previousPages);
        setTotals(prev => ({ ...prev, totalPages: prev.totalPages + 1 }));
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [pages, currentPage?.id]);

  /**
   * Add link to page
   */
  const addLink = useCallback(async (
    targetPageId: string,
    link: { title: string; url: string; description?: string; iconType?: string; iconValue?: string }
  ): Promise<LinkBioLink | null> => {
    try {
      const response = await fetch(`/api/bio/${targetPageId}/links`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(link),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && mountedRef.current) {
        if (currentPage?.id === targetPageId) {
          setLinks(prev => [...prev, data.link]);
        }
        return data.link;
      }
      return null;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    }
  }, [currentPage?.id]);

  /**
   * Update link
   */
  const updateLink = useCallback(async (
    targetPageId: string,
    linkId: string,
    data: Partial<Omit<LinkBioLink, 'id' | 'pageId' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> => {
    // Optimistic update
    const previousLinks = links;
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, ...data } : l));

    try {
      const response = await fetch(`/api/bio/${targetPageId}/links`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ linkId, ...data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setLinks(previousLinks);
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [links]);

  /**
   * Delete link
   */
  const deleteLink = useCallback(async (targetPageId: string, linkId: string): Promise<boolean> => {
    // Optimistic update
    const previousLinks = links;
    setLinks(prev => prev.filter(l => l.id !== linkId));

    try {
      const response = await fetch(`/api/bio/${targetPageId}/links?linkId=${linkId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setLinks(previousLinks);
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [links]);

  /**
   * Reorder links
   */
  const reorderLinks = useCallback(async (targetPageId: string, linkIds: string[]): Promise<boolean> => {
    // Optimistic update
    const previousLinks = links;
    const reorderedLinks = linkIds.map((id, index) => {
      const link = links.find(l => l.id === id);
      return link ? { ...link, order: index } : null;
    }).filter(Boolean) as LinkBioLink[];
    setLinks(reorderedLinks);

    try {
      const response = await fetch(`/api/bio/${targetPageId}/links`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ linkIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return true;
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setLinks(previousLinks);
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [links]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchPages();
    if (pageId) {
      await fetchPage(pageId);
    }
  }, [fetchPages, fetchPage, pageId]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchPages();
    if (pageId) {
      fetchPage(pageId);
    }
  }, [fetchPages, fetchPage, pageId]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    pages,
    currentPage,
    links,
    totals,

    // UI state
    isLoading,
    error,

    // Page actions
    createPage,
    updatePage,
    deletePage,

    // Link actions
    addLink,
    updateLink,
    deleteLink,
    reorderLinks,

    // Utilities
    refresh,
    clearError,
  };
}

export default useLinkBio;
