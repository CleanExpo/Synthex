'use client';

/**
 * Demographics Charts Container
 *
 * @description Grid layout containing age, gender, and location charts.
 */

import { AudienceDemographics } from '@/hooks/useAudienceInsights';
import { AgeDistributionChart } from './AgeDistributionChart';
import { GenderChart } from './GenderChart';
import { LocationMap } from './LocationMap';
import { cn } from '@/lib/utils';

interface DemographicsChartsProps {
  demographics: AudienceDemographics;
  totalAudience?: number;
  isLoading?: boolean;
  className?: string;
}

export function DemographicsCharts({
  demographics,
  totalAudience,
  isLoading,
  className,
}: DemographicsChartsProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      <AgeDistributionChart
        data={demographics?.ageRanges || []}
        isLoading={isLoading}
      />
      <GenderChart
        data={demographics?.genderSplit || []}
        totalAudience={totalAudience}
        isLoading={isLoading}
      />
      <LocationMap
        data={demographics?.topLocations || []}
        isLoading={isLoading}
      />
    </div>
  );
}

export default DemographicsCharts;
