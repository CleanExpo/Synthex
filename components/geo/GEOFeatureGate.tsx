'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, Globe, TrendingUp } from '@/components/icons';
import Link from 'next/link';

interface GEOFeatureGateProps {
  children: React.ReactNode;
  requiredPlan?: 'professional' | 'business' | 'custom';
  feature: string;
  description?: string;
  benefits?: string[];
}

/**
 * Paywall component that gates GEO/E-E-A-T features behind subscription tiers.
 * Shows upgrade prompt for users without required subscription level.
 * Reuses the same visual pattern as SEOFeatureGate for consistency.
 */
export function GEOFeatureGate({
  children,
  requiredPlan = 'professional',
  feature,
  description,
  benefits,
}: GEOFeatureGateProps) {
  const { subscription, isLoading, hasAccess } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="h-32 bg-white/5 rounded-lg" />
      </div>
    );
  }

  const userHasAccess = hasAccess(requiredPlan);

  if (!userHasAccess) {
    const defaultBenefits = [
      'AI-powered content optimization for search engines',
      'GEO citability scoring and passage extraction',
      'E-E-A-T compliance auditing',
    ];

    return (
      <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/20 overflow-hidden">
        <CardContent className="p-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-cyan-500/10 pointer-events-none" />

          <div className="relative z-10 text-center max-w-md mx-auto">
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
              <div className="relative bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 p-4 rounded-2xl border border-cyan-500/30">
                <Lock className="w-10 h-10 text-cyan-400" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{feature}</h3>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-4">
              <Globe className="w-3.5 h-3.5" />
              {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Plan Feature
            </div>

            <p className="text-gray-400 mb-6 leading-relaxed">
              {description ||
                `Upgrade to the ${requiredPlan} plan to unlock ${feature.toLowerCase()} and other advanced GEO optimization tools.`}
            </p>

            <div className="text-left bg-white/5 rounded-lg p-4 mb-6 space-y-2">
              {(benefits || defaultBenefits).map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            <Link href="/dashboard/settings/billing">
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all px-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
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

export default GEOFeatureGate;
