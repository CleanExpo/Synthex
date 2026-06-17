'use client';

/**
 * CredentialCoveragePanel — components/integrations/CredentialCoveragePanel.tsx
 *
 * Surfaces the per-org credential-reference coverage (SYN-1023) on the
 * Integrations page: each mapped account shows whether it is connected via
 * OAuth, has a reference-only 1Password entry, or is missing entirely. Reads
 * the secret-free GET /api/credential-coverage endpoint — no secret values are
 * ever fetched or shown.
 */
import { useApi } from '@/hooks/use-api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Key, CheckCircle, AlertCircle } from '@/components/icons';
import type {
  CoverageReport,
  CoverageStatus,
} from '@/lib/credential-intake/credential-coverage';

const STATUS_META: Record<
  CoverageStatus,
  { label: string; badge: 'default' | 'secondary' | 'outline'; className: string }
> = {
  connected_oauth: {
    label: 'Connected',
    badge: 'default',
    className: 'text-emerald-300 border-emerald-400/30',
  },
  reference_only: {
    label: 'Reference only',
    badge: 'outline',
    className: 'text-amber-200 border-amber-400/30',
  },
  missing: {
    label: 'Missing',
    badge: 'secondary',
    className: 'text-red-200 border-red-400/30',
  },
};

export function CredentialCoveragePanel() {
  const { data, isLoading, error } = useApi<{ report: CoverageReport }>(
    '/api/credential-coverage',
  );

  const report = data?.report;
  const rows = report?.rows ?? [];

  return (
    <Card variant="glass" className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5 text-cyan-300" />
          Credential coverage
        </CardTitle>
        <CardDescription>
          Which of this client&apos;s accounts are connected, reference-only, or
          missing. No secret values are shown.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-gray-400">Loading credential coverage…</p>
        )}
        {error && (
          <p className="text-sm text-red-300">
            Could not load credential coverage: {error.message}
          </p>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-gray-400">
            No mapped accounts for this client yet.
          </p>
        )}
        {rows.length > 0 && (
          <ul className="divide-y divide-white/5">
            {rows.map((row, i) => {
              const meta = STATUS_META[row.status];
              return (
                <li
                  key={`${row.orgSlug}-${row.provider}-${i}`}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white capitalize">
                      {row.provider}
                    </p>
                    {row.status === 'missing' && row.reason && (
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-100/80">
                        <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-300" />
                        {row.reason}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={meta.badge}
                    className={`shrink-0 ${meta.className}`}
                  >
                    {row.status === 'connected_oauth' && (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    )}
                    {meta.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
