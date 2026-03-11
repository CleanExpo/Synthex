'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, Brain, TrendingUp } from '@/components/icons';
import Link from 'next/link';

interface BOFeatureGateProps {
  children: React.ReactNode;
  feature?: string;
  description?: string;
  benefits?: string[];
}

/**
 * Paywall component that gates Bayesian Optimisation features behind the Pro plan.
 * Shows upgrade prompt for free-tier users.
 * Uses violet/purple accent colour to differentiate from GEO's cyan.
 */
export function BOFeatureGate({
  children,
  feature = 'AI Optimisation Dashboard',
  description,
  benefits,
}: BOFeatureGateProps) {
  const { subscription, isLoading, hasAccess } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="h-32 bg-white/5 rounded-lg" />
      </div>
    );
  }

  const userHasAccess = hasAccess('pro');

  if (!userHasAccess) {
    const defaultBenefits = [
      'Bayesian parameter optimisation adapts to your organisation automatically',
      'AI-powered weight tuning for GEO scores and tactic rankings',
      'Continuous learning from real analysis results to improve recommendations',
    ];

    return (
      <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/20 overflow-hidden">
        <CardContent className="p-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-violet-500/10 pointer-events-none" />

          <div className="relative z-10 text-center max-w-md mx-auto">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full" />
              <div className="relative bg-gradient-to-br from-violet-500/20 to-violet-600/20 p-4 rounded-2xl border border-violet-500/30">
                <Lock className="w-10 h-10 text-violet-400" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{feature}</h3>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/30 rounded-full text-violet-400 text-sm font-medium mb-4">
              <Brain className="w-3.5 h-3.5" />
              Pro Plan Feature
            </div>

            <p className="text-gray-400 mb-6 leading-relaxed">
              {description ||
                `Upgrade to the Pro plan to unlock ${feature.toLowerCase()} and adaptive AI parameter tuning for your organisation.`}
            </p>

            <div className="text-left bg-white/5 rounded-lg p-4 mb-6 space-y-2">
              {(benefits || defaultBenefits).map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <TrendingUp className="w-4 h-4 text-violet-400 shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <Link href="/dashboard/billing">
              <Button className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all px-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Pro
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

export default BOFeatureGate;
