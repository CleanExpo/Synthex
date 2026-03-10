'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, TrendingUp } from '@/components/icons';
import Link from 'next/link';

interface SEOFeatureGateProps {
  children: React.ReactNode;
  requiredPlan?: 'professional' | 'business' | 'custom';
  feature: string;
  description?: string;
}

/**
 * Paywall component that gates SEO features behind subscription tiers.
 * Shows upgrade prompt for users without required subscription level.
 */
export function SEOFeatureGate({
  children,
  requiredPlan = 'professional',
  feature,
  description,
}: SEOFeatureGateProps) {
  const { subscription, isLoading, hasAccess } = useSubscription();

  // Show loading skeleton while checking subscription
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="h-32 bg-white/5 rounded-lg" />
      </div>
    );
  }

  // Check if user has required plan access
  const userHasAccess = hasAccess(requiredPlan);

  if (!userHasAccess) {
    return (
      <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/20 overflow-hidden">
        <CardContent className="p-8 relative">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-cyan-500/10 pointer-events-none" />

          <div className="relative z-10 text-center max-w-md mx-auto">
            {/* Lock icon with glow */}
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
              <div className="relative bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 p-4 rounded-2xl border border-cyan-500/30">
                <Lock className="w-10 h-10 text-cyan-400" />
              </div>
            </div>

            {/* Feature name */}
            <h3 className="text-2xl font-bold text-white mb-2">
              {feature}
            </h3>

            {/* Plan badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Plan Feature
            </div>

            {/* Description */}
            <p className="text-gray-400 mb-6 leading-relaxed">
              {description || `Upgrade to the ${requiredPlan} plan to unlock ${feature.toLowerCase()} and other advanced SEO tools to optimize your content for maximum visibility.`}
            </p>

            {/* Benefits list */}
            <div className="text-left bg-white/5 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Comprehensive SEO analysis</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>AI-powered optimization suggestions</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Schema markup generation</span>
              </div>
            </div>

            {/* Upgrade button */}
            <Link href="/dashboard/settings/billing">
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all px-8">
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
              </Button>
            </Link>

            {/* Current plan info */}
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

  // User has access - render children
  return <>{children}</>;
}

export default SEOFeatureGate;
