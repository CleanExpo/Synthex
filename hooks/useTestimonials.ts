'use client';

import useSWR from 'swr';

export type TestimonialStatus = 'pending' | 'approved' | 'rejected';

export interface TestimonialItem {
  id: string;
  submitterName: string;
  submitterEmail: string | null;
  rating: number;
  text: string;
  photoUrls: string[];
  videoUrl: string | null;
  status: TestimonialStatus;
  gbpPostId: string | null;
  postedToGmbAt: string | null;
  createdAt: string;
  request: {
    title: string;
  };
}

interface TestimonialsResponse {
  items: TestimonialItem[];
  total: number;
  page: number;
  pages: number;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<TestimonialsResponse>;
  });

export function useTestimonials(options?: {
  status?: TestimonialStatus | 'all';
  page?: number;
}) {
  const params = new URLSearchParams();
  if (options?.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options?.page) {
    params.set('page', String(options.page));
  }

  const url = `/api/testimonials?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<TestimonialsResponse>(
    url,
    fetchJson,
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
    }
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pages: data?.pages ?? 1,
    isLoading,
    error: error?.message as string | undefined,
    refresh: mutate,
  };
}
