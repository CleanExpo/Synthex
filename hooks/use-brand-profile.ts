/**
 * useBrandProfile Hook
 *
 * SWR-based hook for fetching and mutating brand profile data.
 * Follows the project SWR pattern: useSWR for reads, fetch() in mutation callbacks.
 *
 * @module hooks/use-brand-profile
 * @task SYN-55
 */

import useSWR from 'swr';
import type {
  BrandProfileResponse,
  BrandProfileUpdatePayload,
} from '@/app/api/brand-profile/types';
import { fetchJson } from '@/lib/fetcher';
import { fetchWithCSRF } from '@/lib/csrf';

export function useBrandProfile(activeOrganizationId?: string | null) {
  const cacheKey = activeOrganizationId
    ? `/api/brand-profile?context=${encodeURIComponent(activeOrganizationId)}`
    : '/api/brand-profile';

  const { data, error, isLoading, mutate } = useSWR<{
    data: BrandProfileResponse;
  }>(cacheKey, fetchJson, { revalidateOnFocus: false });

  const updateBrandProfile = async (
    payload: BrandProfileUpdatePayload
  ): Promise<BrandProfileResponse> => {
    const res = await fetchWithCSRF('/api/brand-profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok)
      throw new Error(json.error || 'Failed to update brand profile');
    await mutate();
    return json.data as BrandProfileResponse;
  };

  return {
    profile: data?.data ?? null,
    isLoading,
    error,
    mutate,
    updateBrandProfile,
  };
}
