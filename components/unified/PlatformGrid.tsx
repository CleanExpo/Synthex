'use client';

/**
 * Platform Grid Component
 *
 * @description Responsive grid of platform cards with loading and empty states.
 */

import { PlatformCard, PlatformCardProps } from './PlatformCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2 } from '@/components/icons';

interface PlatformGridProps {
  platforms: PlatformCardProps['platform'][];
  isLoading?: boolean;
  onConnect?: (platformId: string) => void;
  onViewDetails?: (platformId: string) => void;
}

function PlatformCardSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-9 w-full mt-2" />
      </div>
    </div>
  );
}

export function PlatformGrid({
  platforms,
  isLoading,
  onConnect,
  onViewDetails,
}: PlatformGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <PlatformCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900/30 border border-white/10 rounded-xl">
        <div className="p-4 rounded-full bg-gray-800/50 w-fit mx-auto mb-4">
          <Link2 className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Platforms Available</h3>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          Connect your social media accounts to see unified metrics across all platforms.
        </p>
      </div>
    );
  }

  // Sort: connected first, then alphabetically
  const sortedPlatforms = [...platforms].sort((a, b) => {
    if (a.connected !== b.connected) {
      return a.connected ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedPlatforms.map((platform) => (
        <PlatformCard
          key={platform.id}
          platform={platform}
          onConnect={() => onConnect?.(platform.id)}
          onViewDetails={() => onViewDetails?.(platform.id)}
        />
      ))}
    </div>
  );
}

export default PlatformGrid;
