'use client';

import { Button } from '@/components/ui/button';
import { Lock } from '@/components/icons';
import Link from 'next/link';

interface UpgradePromptProps {
  feature: string;
  requiredPlan?: string;
  className?: string;
}

/**
 * Generic upgrade prompt shown when a user on a free plan tries to access
 * a premium feature. Displays a lock icon, feature name, required plan,
 * and CTAs to view pricing or manage billing.
 */
export function UpgradePrompt({
  feature,
  requiredPlan = 'Professional',
  className,
}: UpgradePromptProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-muted-foreground/30 p-12 text-center ${className ?? ''}`}
    >
      <div className="rounded-full bg-muted p-4">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">
          {feature} requires {requiredPlan}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upgrade your plan to unlock {feature} and other premium features.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/pricing">View Plans</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/billing">Manage Billing</Link>
        </Button>
      </div>
    </div>
  );
}

export default UpgradePrompt;
