'use client';

import useSWR from 'swr';

interface GBPReview {
  id: string;
  organizationId: string;
  locationId: string;
  gbpReviewId: string;
  reviewerName: string | null;
  reviewerAvatar: string | null;
  rating: number;
  comment: string | null;
  reviewTime: string;
  replyText: string | null;
  replyTime: string | null;
  aiSuggestion: string | null;
  aiSuggestionAt: string | null;
  responseStatus: string; // pending | posted | dismissed
  dismissReason: string | null;
  location?: { locationName: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useGBPReviews(options?: {
  locationId?: string;
  page?: number;
  limit?: number;
  rating?: number;
  unreplied?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.locationId) params.set('locationId', options.locationId);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.rating) params.set('rating', String(options.rating));
  if (options?.unreplied) params.set('unreplied', 'true');

  const url = `/api/google-business/reviews?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    reviews: GBPReview[];
    pagination: Pagination;
  }>(url, fetchJson);

  return {
    reviews: data?.reviews ?? [],
    pagination: data?.pagination,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
