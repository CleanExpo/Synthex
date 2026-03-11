'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, Layers } from '@/components/icons';
import Link from 'next/link';

interface SpatiotemporalFeatureGateProps {
  children: React.ReactNode;
}

/**
 * Paywall component that gates BayesNF cross-platform spatiotemporal predictions
 * behind the Scale plan. Shows upgrade prompt for non-Scale users.
 * Uses emerald accent colour consistent with Forecasting feature family.
 */
export function SpatiotemporalFeatureGate({ children }: SpatiotemporalFeatureGateProps) {
  const { subscription, isLoading, hasAccess } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="h-32 bg-white/5 rounded-lg" />
      </div>
    );
  }

  const userHasAccess = hasAccess('scale');

  if (!userHasAccess) {
    const defaultBenefits = [
      'BayesNF models cross-platform engagement with calibrated uncertainty bounds',
      'Spatiotemporal heatmap reveals which platforms perform best on each day',
      'Uncertainty bounds show confidence ranges — plan campaigns where the model is most certain',
    ];

    return (
      <Card className="bg-surface-base/80 backdrop-blur-xl border border-emerald-500/20 overflow-hidden">
        <CardContent className="p-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/10 pointer-events-none" />

          <div className="relative z-10 text-center max-w-md mx-auto">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <div className="relative bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 p-4 rounded-2xl border border-emerald-500/30">
                <Lock className="w-10 h-10 text-emerald-400" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Cross-Platform Intelligence</h3>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium mb-4">
              <Layers className="w-3.5 h-3.5" />
              Scale Plan Feature
            </div>

            <p className="text-gray-400 mb-6 leading-relaxed">
              BayesNF spatiotemporal models predict performance across every platform simultaneously.
            </p>

            <div className="text-left bg-white/5 rounded-lg p-4 mb-6 space-y-2">
              {defaultBenefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <Link href="/dashboard/billing">
              <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all px-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Scale
              </Button>
            </Link>

            {subscription && (
              <p className="text-gray-500 text-sm mt-4">
                Current plan: <span className="text-gray-400 capitalize">{subscription.plan}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

export default SpatiotemporalFeatureGate;
