'use client';

/**
 * useMediaLibrary
 *
 * Reads the media library that `/api/media/library` has always exposed and that,
 * until now, nothing in the product called. Folders, tags, favourites, search and
 * stats were all implemented server-side with no screen reading them, so uploaded
 * files effectively disappeared once the upload finished.
 *
 * Follows the house data-fetching pattern in `hooks/use-approvals.ts`: SWR with
 * `credentials: 'include'`, filters assembled into a query string.
 */

import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

export type MediaKind = 'image' | 'video' | 'audio';

/** Mirrors the `MediaAsset` the service returns (camelCase, already mapped). */
export interface MediaLibraryAsset {
  id: string;
  userId: string;
  type: MediaKind;
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  base64Data?: string;
  externalId?: string;
  prompt?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  folderId?: string;
  isFavorite: boolean;
  isArchived: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaLibraryResponse {
  assets: MediaLibraryAsset[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface UseMediaLibraryOptions {
  /** Restrict to one or more kinds. Omit for everything. */
  type?: MediaKind | MediaKind[];
  /** Free-text search across the asset name and prompt. */
  search?: string;
  /** Only favourites. */
  favouritesOnly?: boolean;
  folderId?: string | null;
  tags?: string[];
  sortBy?: 'createdAt' | 'updatedAt' | 'usageCount' | 'name';
  sortOrder?: 'asc' | 'desc';
  /** The route caps this at 100. */
  limit?: number;
  offset?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * A failed library request. `notProvisioned` is true for the route's honest
 * 503 FEATURE_NOT_PROVISIONED (the media tables do not exist yet), which the
 * UI shows as "not set up" rather than as a retryable failure.
 */
export class MediaLibraryFetchError extends Error {
  constructor(
    readonly status: number,
    readonly notProvisioned: boolean
  ) {
    super(`HTTP ${status}`);
    this.name = 'MediaLibraryFetchError';
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new MediaLibraryFetchError(
      res.status,
      res.status === 503 && body?.error === 'FEATURE_NOT_PROVISIONED'
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Build the query string.
 *
 * Exported so a test can assert the mapping without rendering anything — the
 * route reads `isFavorite`, not `favouritesOnly`, and a silent mismatch there
 * would show the founder an unfiltered grid that looks correct.
 */
export function buildMediaLibraryQuery(
  options: UseMediaLibraryOptions = {}
): string {
  const params = new URLSearchParams();

  if (options.type) {
    params.set(
      'type',
      Array.isArray(options.type) ? options.type.join(',') : options.type
    );
  }
  if (options.search) params.set('search', options.search);
  if (options.favouritesOnly) params.set('isFavorite', 'true');
  if (options.folderId === null) params.set('folderId', 'null');
  else if (options.folderId) params.set('folderId', options.folderId);
  if (options.tags?.length) params.set('tags', options.tags.join(','));
  if (options.sortBy) params.set('sortBy', options.sortBy);
  if (options.sortOrder) params.set('sortOrder', options.sortOrder);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined)
    params.set('offset', String(options.offset));

  // Archived assets are hidden unless explicitly asked for, so the default grid
  // shows the working set rather than everything ever created.
  if (params.get('isArchived') === null) params.set('isArchived', 'false');

  const qs = params.toString();
  return qs ? `/api/media/library?${qs}` : '/api/media/library';
}

// ============================================================================
// HOOK
// ============================================================================

export function useMediaLibrary(options: UseMediaLibraryOptions = {}) {
  const url = buildMediaLibraryQuery(options);

  const { data, error, isLoading, mutate } = useSWR<MediaLibraryResponse>(
    url,
    fetchJson,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  return {
    assets: data?.assets ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error,
    mutate,
  };
}
