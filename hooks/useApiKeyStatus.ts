'use client';

/**
 * useApiKeyStatus
 *
 * SWR hook that fetches API key availability for the current user.
 * Checks both user BYOK keys and platform-level env keys.
 *
 * Response shape per provider:
 *   { byok: bool, platform: bool, available: bool }
 *
 * The gate component uses `available` — fires only when NEITHER source works.
 *
 * Usage:
 *   const { isAvailable, hasByok } = useApiKeyStatus();
 *   if (!isAvailable('elevenlabs')) return <ApiKeyGate ... />;
 */

import useSWR from 'swr';

interface ProviderStatus {
  byok: boolean;
  platform: boolean;
  available: boolean;
}

interface ApiKeyStatusResponse {
  providers: Record<string, ProviderStatus>;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ApiKeyStatusResponse>;
  });

export function useApiKeyStatus() {
  const { data, error, mutate, isLoading } = useSWR<ApiKeyStatusResponse>(
    '/api/api-keys/status',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const getStatus = (provider: string): ProviderStatus =>
    data?.providers[provider] ?? {
      byok: false,
      platform: false,
      available: false,
    };

  return {
    /** True if the feature can work (user BYOK OR platform key configured) */
    isAvailable: (provider: string): boolean => getStatus(provider).available,
    /** True if the user has their own BYOK for this provider */
    hasByok: (provider: string): boolean => getStatus(provider).byok,
    /** True if the platform has an env key for this provider */
    hasPlatformKey: (provider: string): boolean => getStatus(provider).platform,
    /** True if ALL listed providers have an available key */
    allAvailable: (providers: string[]): boolean =>
      providers.every(p => getStatus(p).available),
    /** Raw status map */
    providers: data?.providers ?? {},
    isLoading,
    isError: !!error,
    /** Re-fetch after a key is saved */
    refresh: () => mutate(),
  };
}
