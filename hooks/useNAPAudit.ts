'use client';

import useSWR from 'swr';

export interface NAPMismatchSource {
  source: string;
  value: string;
  label: string;
  editUrl?: string;
}

export interface NAPMismatch {
  field: 'name' | 'phone' | 'website';
  canonical: string;
  sources: NAPMismatchSource[];
}

export interface NAPAuditResponse {
  locationName: string;
  mismatches: NAPMismatch[];
  allMatch: boolean;
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useNAPAudit() {
  const { data, error, isLoading } = useSWR<NAPAuditResponse>(
    '/api/google-business/nap-audit',
    fetchJson,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    locationName: data?.locationName ?? null,
    mismatches: data?.mismatches ?? [],
    allMatch: data?.allMatch ?? false,
    isLoading,
    error: error?.message ?? null,
  };
}
