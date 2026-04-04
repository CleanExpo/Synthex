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
  const {
    businesses,
    switchBusiness,
    refetch: refetchBusinesses,
  } = useActiveBusiness();
  const {
    overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useBusinessOverview();
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
            <div className="w-8 h-8 bg-orange-500/10 rounded-lg animate-pulse" />
            <div className="w-48 h-8 bg-orange-500/10 rounded animate-pulse" />
          </div>
          <div className="w-40 h-10 bg-orange-500/10 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-32 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm animate-pulse"
            />
          ))}
        </div>
        <div className="h-96 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm animate-pulse" />
      </div>
    );
  }

  // Access denied state
  if (!user?.isMultiBusinessOwner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md bg-surface-base/80 border border-orange-500/10">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-sm flex items-center justify-center mx-auto border-[0.5px] border-red-500/20">
              <Building className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-light text-white mb-2">
                Access Denied
              </h2>
              <p className="text-white/40">
                This page is only accessible to multi-business owners. Please
                contact support if you believe this is an error.
              </p>
            </div>
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-[0.5px] border-orange-500/30"
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
          <div className="w-10 h-10 bg-orange-500/10 rounded-sm flex items-center justify-center border-[0.5px] border-orange-500/20">
            <Building className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1 block">
              Workspace
            </span>
            <h1 className="text-3xl font-extralight tracking-tight text-white">
              Business Management
            </h1>
            <p className="text-sm text-white/40">
              Manage and monitor all your businesses
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Business
        </Button>
      </div>

      {/* Cross-Business Overview Cards */}
      {overviewLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-32 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm animate-pulse"
            />
          ))}
        </div>
      ) : overview ? (
        <BusinessOverviewCards overview={overview} />
      ) : (
        <Card className="bg-surface-base/80 border border-orange-500/10">
          <CardContent className="p-8 text-center">
            <p className="text-white/40">No overview data available</p>
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
