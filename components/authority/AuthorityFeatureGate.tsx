'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from '@/components/icons';

interface AuthorityFeatureGateProps {
  children: ReactNode;
  hasAddon: boolean;
  featureName: string;
}

export function AuthorityFeatureGate({ children, hasAddon, featureName }: AuthorityFeatureGateProps) {
  if (hasAddon) return <>{children}</>;

  return (
    <Card className="bg-white/5 border-violet-500/10 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
          <Shield className="h-6 w-6 text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Unlock {featureName}</h3>
        <p className="text-sm text-slate-400 max-w-xs mb-6">
          This feature requires the Authority Engine add-on at $22 AUD/month.
          Get verified citations, claim validation, and source connectors.
        </p>
        <a
          href="/dashboard/billing"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          Upgrade to Authority Engine
        </a>
      </CardContent>
    </Card>
  );
}
