'use client';

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { cn } from '@/lib/utils';
import type { ProviderReadiness } from '@/lib/unite-command-center';

type ProviderReadinessResponse = {
  organizationId: string;
  providers: ProviderReadiness[];
};

const MODE_CLASSES: Record<ProviderReadiness['mode'], string> = {
  live: 'border-emerald-500/25 text-emerald-300 bg-emerald-500/[0.04]',
  draft: 'border-cyan-500/25 text-cyan-300 bg-cyan-500/[0.04]',
  mock: 'border-violet-500/25 text-violet-300 bg-violet-500/[0.04]',
  blocked: 'border-red-500/25 text-red-300 bg-red-500/[0.04]',
};

export function ProviderReadinessStrip() {
  const { data, isLoading } = useSWR<ProviderReadinessResponse>(
    '/api/command-centre/provider-readiness',
    fetchJson,
    { refreshInterval: 60_000 }
  );

  const providers = data?.providers ?? [];

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-4 bg-white/[0.01]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-widest">
          Provider Gates
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-white/35">
          No credential values exposed
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {[...Array(7)].map((_, index) => (
            <div
              key={index}
              className="h-16 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.03] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {providers.map(provider => (
            <div
              key={provider.provider}
              className="border-[0.5px] border-white/[0.06] rounded-sm p-2 min-h-16"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-white/50">
                  {provider.provider}
                </span>
                <span
                  className={cn(
                    'w-fit border-[0.5px] px-1.5 py-0.5 rounded-sm text-[9px] uppercase tracking-wider',
                    MODE_CLASSES[provider.mode]
                  )}
                >
                  {provider.mode}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
