'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, BarChart3, TrendingUp, DollarSign } from '@/components/icons';

interface OwnedBusiness {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  displayName: string | null;
  isActive: boolean;
  billingStatus: string;
  monthlyRate: number;
  stats?: {
    totalCampaigns: number;
    totalPosts: number;
    activePlatforms: number;
    totalEngagement: number;
  };
}

interface CrossBusinessAggregation {
  totalBusinesses: number;
  activeBusinesses: number;
  totalCampaigns: number;
  totalPosts: number;
  totalEngagement: number;
  totalMonthlySpend: number;
  perBusiness: OwnedBusiness[];
}

interface BusinessOverviewCardsProps {
  overview: CrossBusinessAggregation;
}

export function BusinessOverviewCards({ overview }: BusinessOverviewCardsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBillingStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'past_due':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Businesses */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Building className="h-4 w-4 text-cyan-400" />
              Total Businesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {overview.activeBusinesses}
              <span className="text-lg text-gray-500">/{overview.totalBusinesses}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Active businesses</p>
          </CardContent>
        </Card>

        {/* Total Campaigns */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatNumber(overview.totalCampaigns)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all businesses</p>
          </CardContent>
        </Card>

        {/* Total Engagement */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              Total Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatNumber(overview.totalEngagement)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Combined interactions</p>
          </CardContent>
        </Card>

        {/* Monthly Spend */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-cyan-400" />
              Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(overview.totalMonthlySpend)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Business Cards */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Business Breakdown</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {overview.perBusiness.map((business) => (
            <Card
              key={business.organizationId}
              className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10 hover:border-cyan-500/20 transition-all"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold text-white truncate">
                      {business.organizationName}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">@{business.organizationSlug}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge
                      variant="outline"
                      className={business.isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                    >
                      {business.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getBillingStatusColor(business.billingStatus)}
                    >
                      {business.billingStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Campaigns</p>
                    <p className="text-lg font-semibold text-white mt-1">
                      {business.stats?.totalCampaigns || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Posts</p>
                    <p className="text-lg font-semibold text-white mt-1">
                      {business.stats?.totalPosts || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monthly</p>
                    <p className="text-lg font-semibold text-cyan-400 mt-1">
                      {formatCurrency(business.monthlyRate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
