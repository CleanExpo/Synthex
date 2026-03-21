/**
 * Autopilot Toggle — Mutation Hook
 *
 * @module hooks/useAutopilotToggle
 */

'use client';

import { useCallback, useState } from 'react';
import { fetchWithCSRF } from '@/lib/csrf';

interface ToggleResult {
  enabled: boolean;
  status: string;
  nextRunAt: string | null;
}

export function useAutopilotToggle() {
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (enabled: boolean): Promise<ToggleResult | null> => {
      setIsToggling(true);
      setError(null);

      try {
        const res = await fetchWithCSRF('/api/command-centre/autopilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });

        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: 'Toggle failed' }));
          setError(data.error ?? 'Toggle failed');
          return null;
        }

        return await res.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Toggle failed');
        return null;
      } finally {
        setIsToggling(false);
      }
    },
    []
  );

  return { toggle, isToggling, error };
}
