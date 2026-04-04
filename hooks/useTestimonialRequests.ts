'use client';

import useSWR from 'swr';

export interface RequestItem {
  id: string;
  token: string;
  title: string;
  subtitle: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  submissionCount: number;
  url: string;
}

interface TestimonialRequestsResponse {
  items: RequestItem[];
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<TestimonialRequestsResponse>;
  });

export function useTestimonialRequests() {
  const { data, error, isLoading, mutate } =
    useSWR<TestimonialRequestsResponse>(
      '/api/testimonials/requests',
      fetchJson,
      {
        dedupingInterval: 30_000,
        revalidateOnFocus: false,
      }
    );

  return {
    items: data?.items ?? [],
    isLoading,
    error: error?.message as string | undefined,
    refresh: mutate,
  };
}
