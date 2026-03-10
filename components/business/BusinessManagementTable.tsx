'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Settings, RefreshCw, Link2, ChevronDown, ChevronUp, Edit, Check, X } from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';
import { BusinessSocialAccounts } from './BusinessSocialAccounts';

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

interface BusinessManagementTableProps {
  businesses: OwnedBusiness[];
  onSwitch: (orgId: string) => void;
  onManageAccounts: (orgId: string) => void;
  onRefresh: () => void;
}

export function BusinessManagementTable({ businesses, onSwitch, onManageAccounts, onRefresh }: BusinessManagementTableProps) {
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

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

  const handleSwitch = async (orgId: string) => {
    setSwitchingId(orgId);
    try {
      await onSwitch(orgId);
    } finally {
      setSwitchingId(null);
    }
  };

  const handleDeactivate = async (businessId: string) => {
    if (!confirm('Are you sure you want to deactivate this business?')) {
      return;
    }

    setDeactivatingId(businessId);
    try {
      const response = await fetchWithCSRF(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate business');
      }

      onRefresh();
    } catch (error) {
      console.error('Error deactivating business:', error);
      alert('Failed to deactivate business. Please try again.');
    } finally {
      setDeactivatingId(null);
    }
  };

  const startRename = (business: OwnedBusiness) => {
    setRenamingId(business.id);
    setRenameValue(business.organizationName);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const saveRename = async (businessId: string) => {
    if (!renameValue.trim()) return;
    setRenameSaving(true);
    try {
      const response = await fetchWithCSRF(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: renameValue.trim() }),
      });
      if (!response.ok) throw new Error('Failed to rename');
      setRenamingId(null);
      setRenameValue('');
      onRefresh();
    } catch {
      alert('Failed to save name. Please try again.');
    } finally {
      setRenameSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Your Businesses</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="bg-surface-base/80 border-cyan-500/10 text-white hover:bg-cyan-500/10 hover:border-cyan-500/20"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-cyan-500/10">
                <tr className="text-left">
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Billing
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Monthly Rate
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Social Accounts
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {businesses.map((business) => (
                  <React.Fragment key={business.organizationId}>
                  <tr className="hover:bg-cyan-500/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        {renamingId === business.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(business.id); if (e.key === 'Escape') cancelRename(); }}
                              autoFocus
                              className="px-2 py-1 text-sm bg-surface-base border border-cyan-500/30 rounded text-white focus:outline-none focus:border-cyan-500/60 w-40"
                              disabled={renameSaving}
                            />
                            <Button variant="ghost" size="sm" onClick={() => saveRename(business.id)} disabled={renameSaving} className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10">
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelRename} disabled={renameSaving} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-300 hover:bg-white/5">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <div className="text-sm font-medium text-white">
                              {business.organizationName}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => startRename(business)} className="h-6 w-6 p-0 text-gray-600 hover:text-gray-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">@{business.organizationSlug}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={business.isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                      >
                        {business.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={getBillingStatusColor(business.billingStatus)}
                      >
                        {business.billingStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white font-medium">
                        {formatCurrency(business.monthlyRate)}
                      </span>
                      <span className="text-xs text-gray-500">/month</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">
                          {business.stats?.activePlatforms ?? 0} connected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === business.organizationId ? null : business.organizationId)}
                          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
                        >
                          {expandedId === business.organizationId ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onManageAccounts(business.organizationId)}
                          className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/30"
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitch(business.organizationId)}
                          disabled={switchingId === business.organizationId}
                          className="bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/30"
                        >
                          {switchingId === business.organizationId ? (
                            <>
                              <div className="h-3 w-3 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mr-2" />
                              Switching...
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Switch To
                            </>
                          )}
                        </Button>
                        {business.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(business.id)}
                            disabled={deactivatingId === business.id}
                            className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
                          >
                            {deactivatingId === business.id ? 'Deactivating...' : 'Deactivate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === business.organizationId && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-[#0a1020]/50">
                        <BusinessSocialAccounts
                          organizationId={business.organizationId}
                          organizationName={business.organizationName}
                          onConnectPlatform={onManageAccounts}
                        />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {businesses.map((business) => (
          <Card
            key={business.organizationId}
            className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10"
          >
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {renamingId === business.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(business.id); if (e.key === 'Escape') cancelRename(); }}
                          autoFocus
                          className="px-2 py-1 text-sm bg-surface-base border border-cyan-500/30 rounded text-white focus:outline-none focus:border-cyan-500/60 w-full"
                          disabled={renameSaving}
                        />
                        <Button variant="ghost" size="sm" onClick={() => saveRename(business.id)} disabled={renameSaving} className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10 flex-shrink-0">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelRename} disabled={renameSaving} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-300 hover:bg-white/5 flex-shrink-0">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <h3 className="text-base font-semibold text-white truncate">
                          {business.organizationName}
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => startRename(business)} className="h-6 w-6 p-0 text-gray-600 hover:text-gray-300 hover:bg-white/5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
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

                {/* Monthly Rate */}
                <div className="pt-2 border-t border-cyan-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Monthly Rate</span>
                    <span className="text-lg font-semibold text-white">
                      {formatCurrency(business.monthlyRate)}
                      <span className="text-xs text-gray-500">/month</span>
                    </span>
                  </div>
                </div>

                {/* Social Accounts */}
                <div className="pt-2 border-t border-cyan-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      {business.stats?.activePlatforms ?? 0} social accounts connected
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === business.organizationId ? null : business.organizationId)}
                        className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
                      >
                        {expandedId === business.organizationId ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageAccounts(business.organizationId)}
                        className="bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/30"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Manage Accounts
                      </Button>
                    </div>
                  </div>
                  {expandedId === business.organizationId && (
                    <div className="mt-3">
                      <BusinessSocialAccounts
                        organizationId={business.organizationId}
                        organizationName={business.organizationName}
                        onConnectPlatform={onManageAccounts}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSwitch(business.organizationId)}
                    disabled={switchingId === business.organizationId}
                    className="flex-1 bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/30"
                  >
                    {switchingId === business.organizationId ? (
                      <>
                        <div className="h-3 w-3 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mr-2" />
                        Switching...
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Switch To
                      </>
                    )}
                  </Button>
                  {business.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeactivate(business.id)}
                      disabled={deactivatingId === business.id}
                      className="flex-1 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
                    >
                      {deactivatingId === business.id ? 'Deactivating...' : 'Deactivate'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {businesses.length === 0 && (
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No businesses found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
