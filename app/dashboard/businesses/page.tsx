'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useBusinessOverview } from '@/hooks/useBusinessOverview';
import { BusinessOverviewCards } from '@/components/business/BusinessOverviewCards';
import { CreateBusinessDialog } from '@/components/business/CreateBusinessDialog';
import { BusinessManagementTable } from '@/components/business/BusinessManagementTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Plus } from '@/components/icons';

/**
 * Business Management Page
 *
 * Master overview page for multi-business owners.
 * Access: Multi-business owners only (isMultiBusinessOwner flag)
 */
export default function BusinessesPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { businesses, switchBusiness, refetch: refetchBusinesses } = useActiveBusiness();
  const { overview, isLoading: overviewLoading, refetch: refetchOverview } = useBusinessOverview();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Handle business switch
  const handleSwitchBusiness = async (organizationId: string) => {
    try {
      await switchBusiness(organizationId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to switch business:', error);
    }
  };

  // Handle manage social accounts — switch to business then navigate to integrations
  const handleManageAccounts = async (organizationId: string) => {
    try {
      await switchBusiness(organizationId);
      router.push('/dashboard/settings?tab=integrations');
    } catch (error) {
      console.error('Failed to switch business for account management:', error);
    }
  };

  const handleRefresh = () => {
    refetchBusinesses();
    refetchOverview();
  };

  // Loading state
  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500/10 rounded-lg animate-pulse" />
            <div className="w-48 h-8 bg-cyan-500/10 rounded animate-pulse" />
          </div>
          <div className="w-40 h-10 bg-cyan-500/10 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-surface-base/80 border border-cyan-500/10 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-surface-base/80 border border-cyan-500/10 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Access denied state
  if (!user?.isMultiBusinessOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md bg-surface-base/80 border border-cyan-500/10">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <Building className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
              <p className="text-gray-400">
                This page is only accessible to multi-business owners.
                Please contact support if you believe this is an error.
              </p>
            </div>
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center border border-cyan-500/20">
            <Building className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Business Management</h1>
            <p className="text-sm text-gray-400">Manage and monitor all your businesses</p>
          </div>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Business
        </Button>
      </div>

      {/* Cross-Business Overview Cards */}
      {overviewLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-surface-base/80 border border-cyan-500/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : overview ? (
        <BusinessOverviewCards overview={overview} />
      ) : (
        <Card className="bg-surface-base/80 border border-cyan-500/10">
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">No overview data available</p>
          </CardContent>
        </Card>
      )}

      {/* Business Management Table */}
      <BusinessManagementTable
        businesses={businesses}
        onSwitch={handleSwitchBusiness}
        onManageAccounts={handleManageAccounts}
        onRefresh={handleRefresh}
      />

      {/* Create Business Dialog */}
      <CreateBusinessDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => {
          setCreateDialogOpen(false);
          handleRefresh();
        }}
      />
    </div>
  );
}
