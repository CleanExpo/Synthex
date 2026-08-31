'use client';

import { useState, useMemo } from 'react';
import { APIErrorCard, LoadingSkeleton } from '@/components/error-states';
import { useCohortAnalysis } from '@/app/dashboard/churn/hooks/use-cohort-analysis';
import {
  MetricCard,
  MetricCardTitle,
  MetricCardValue,
} from '@/app/dashboard/churn/components/metric-card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/app/dashboard/churn/components/table';
import { Chip } from '@/app/dashboard/churn/components/chip';

interface CohortRetention {
  cohortDate: string;
  cohortSize: number;
  active30d: number;
  active90d: number;
  churn30d: number;
  churn90d: number;
  retention30d: number;
  retention90d: number;
}

interface ChurnDriverInsight {
  driverType: string;
  drivers: {
    name: string;
    count: number;
    churnRate: number;
    impactScore: number;
  }[];
}

interface PricingElasticityInsight {
  tier: string;
  monthlyPrice: number;
  churnRate: number;
  featureUsage: Record<string, number>;
  recommendation: string;
}

interface FeatureAdoptionInsight {
  featureUsage: {
    feature: string;
    usageCount: number;
  }[];
  totalActiveUsers: number;
  avgUsagePerUser: number;
  cohortStartDate: string;
}

interface ChurnFlaggedUsersResponse {
  gapDays: number;
  count: number;
  users: {
    id: string;
    email: string;
    name: string;
    lastLogin: string | null;
    createdAt: string;
    organizationId: string | null;
  }[];
  generatedAt: string;
}

export default function ChurnAnalysisDashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const [gapDays, setGapDays] = useState(30);

  const { isLoading, error, fetchCohortAnalysis, fetchChurnFlaggedUsers } =
    useCohortAnalysis();

  // Fetch cohort analysis data
  const { cohorts, churnDrivers, pricingElasticity, featureAdoption } =
    useMemo(() => {
      let cohortsData: CohortRetention[] = [];
      let churnDriversData: ChurnDriverInsight[] = [];
      let pricingElasticityData: PricingElasticityInsight[] = [];
      let featureAdoptionData: FeatureAdoptionInsight | null = null;

      if (!isLoading && !error && cohorts.length > 0) {
        cohortsData = cohorts;
        churnDriversData = churnDrivers;
        pricingElasticityData = pricingElasticity;
        featureAdoptionData = featureAdoption as FeatureAdoptionInsight;
      }

      return {
        cohortsData,
        churnDriversData,
        pricingElasticityData,
        featureAdoptionData,
      };
    }, [
      isLoading,
      error,
      cohorts,
      churnDrivers,
      pricingElasticity,
      featureAdoption,
    ]);

  // Fetch churn-flagged users when gapDays changes
  const {
    fetchChurnFlaggedUsers: fetchFlaggedUsers,
    isLoading: isFlaggedLoading,
  } = useCohortAnalysis();
  const [flaggedUsers, setFlaggedUsers] =
    useState<ChurnFlaggedUsersResponse | null>(null);

  const handleFetchFlaggedUsers = useCallback(async () => {
    try {
      const data = await fetchFlaggedUsers(gapDays);
      setFlaggedUsers(data);
    } catch (err) {
      console.error('Failed to fetch flagged users:', err);
    }
  }, [fetchFlaggedUsers, gapDays]);

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  const handleGapDaysChange = (value: number) => {
    setGapDays(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-sx-text-primary">
          Churn Analysis
        </h1>
        <p className="text-sx-text-secondary mt-2">
          Prosumer churn drivers, retention patterns, and pricing discipline.
        </p>
      </div>

      {/* Time Range Selection */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sx-text-secondary">
            Time Range:
          </span>
          {['7d', '30d', '90d'].map(range => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                timeRange === range
                  ? 'bg-sx-primary text-sx-text-on-primary'
                  : 'bg-sx-bg-secondary text-sx-text-secondary hover:bg-sx-bg-tertiary'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Load Cohort Analysis */}
      <button
        onClick={() => fetchCohortAnalysis(timeRange)}
        className="px-4 py-2 bg-sx-primary text-sx-text-on-primary rounded hover:bg-sx-primary-hover"
      >
        Load Cohort Analysis ({timeRange})
      </button>

      {/* Error State */}
      {error && <APIErrorCard error={error} />}

      {/* Loading State */}
      {isLoading && <LoadingSkeleton />}

      {/* Cohorts Table */}
      {!isLoading && !error && cohortsData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sx-text-primary">
            Retention Cohorts
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Cohort Date</TableHead>
                <TableHead className="w-1/6">Cohort Size</TableHead>
                <TableHead className="w-1/6">Active (30d)</TableHead>
                <TableHead className="w-1/6">Active (90d)</TableHead>
                <TableHead className="w-1/6">Churn (30d)</TableHead>
                <TableHead className="w-1/12">Retention (30d)</TableHead>
                <TableHead className="w-1/12">Retention (90d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohortsData.map(cohort => (
                <TableRow key={cohort.cohortDate}>
                  <TableCell className="font-medium">
                    {cohort.cohortDate}
                  </TableCell>
                  <TableCell>{cohort.cohortSize.toLocaleString()}</TableCell>
                  <TableCell>{cohort.active30d.toLocaleString()}</TableCell>
                  <TableCell>{cohort.active90d.toLocaleString()}</TableCell>
                  <TableCell>{cohort.churn30d.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      variant={
                        cohort.retention30d >= 80 ? 'success' : 'warning'
                      }
                    >
                      {cohort.retention30d.toFixed(1)}%
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      variant={
                        cohort.retention90d >= 80 ? 'success' : 'warning'
                      }
                    >
                      {cohort.retention90d.toFixed(1)}%
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Churn Drivers */}
      {!isLoading && !error && churnDriversData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sx-text-primary">
            Top Churn Drivers
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Driver Name</TableHead>
                <TableHead className="w-1/6">Count</TableHead>
                <TableHead className="w-1/6">Churn Rate</TableHead>
                <TableHead className="w-1/6">Impact Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {churnDriversData.flatMap(group =>
                group.drivers.map(driver => (
                  <TableRow key={driver.name}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.count.toLocaleString()}</TableCell>
                    <TableCell>{driver.churnRate.toFixed(2)}%</TableCell>
                    <TableCell>{driver.impactScore}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pricing Discipline */}
      {!isLoading && !error && pricingElasticityData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sx-text-primary">
            Pricing Discipline by Tier
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Tier</TableHead>
                <TableHead className="w-1/4">Monthly Price</TableHead>
                <TableHead className="w-1/6">Churn Rate</TableHead>
                <TableHead className="w-1/3">Recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingElasticityData.map(tier => (
                <TableRow key={tier.tier}>
                  <TableCell className="font-medium">{tier.tier}</TableCell>
                  <TableCell>${tier.monthlyPrice.toLocaleString()}</TableCell>
                  <TableCell>{tier.churnRate.toFixed(2)}%</TableCell>
                  <TableCell>{tier.recommendation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Feature Adoption */}
      {!isLoading && !error && featureAdoptionData && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-sx-text-primary">
            Feature Adoption Correlation
          </h2>
          <MetricCard>
            <MetricCardTitle>Total Active Users</MetricCardTitle>
            <MetricCardValue>
              {featureAdoptionData.totalActiveUsers.toLocaleString()}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardTitle>Avg Usage Per User</MetricCardTitle>
            <MetricCardValue>
              {featureAdoptionData.avgUsagePerUser.toFixed(2)}
            </MetricCardValue>
          </MetricCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Usage Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureAdoptionData.featureUsage.map(item => (
                <TableRow key={item.feature}>
                  <TableCell className="font-medium">{item.feature}</TableCell>
                  <TableCell>{item.usageCount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Churn-Flagged Users */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-sx-text-primary">
            Churn-Flagged Users
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-sx-text-secondary">Gap Days:</span>
            <input
              type="number"
              value={gapDays}
              onChange={e => handleGapDaysChange(Number(e.target.value))}
              className="w-20 px-3 py-1 border border-sx-border rounded text-sm"
            />
            <button
              onClick={handleFetchFlaggedUsers}
              className="px-3 py-1 bg-sx-primary text-sx-text-on-primary rounded text-sm hover:bg-sx-primary-hover"
            >
              Refresh
            </button>
          </div>
        </div>

        {isFlaggedLoading && <LoadingSkeleton />}

        {!isFlaggedLoading && flaggedUsers && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <MetricCard>
                <MetricCardTitle>Total Flagged</MetricCardTitle>
                <MetricCardValue>
                  {flaggedUsers.count.toLocaleString()}
                </MetricCardValue>
              </MetricCard>
              <MetricCard>
                <MetricCardTitle>Gap Threshold</MetricCardTitle>
                <MetricCardValue>{flaggedUsers.gapDays} days</MetricCardValue>
              </MetricCard>
              <MetricCard>
                <MetricCardTitle>Generated At</MetricCardTitle>
                <MetricCardValue className="text-xs">
                  {new Date(flaggedUsers.generatedAt).toLocaleString()}
                </MetricCardValue>
              </MetricCard>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Organization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedUsers.users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || 'N/A'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{user.organizationId ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
