'use client';

/**
 * ROI Calculator Dashboard
 *
 * @description Calculate and track return on content investment.
 */

import { useState, useCallback } from 'react';
import { useROI, CreateInvestmentInput, ContentInvestment } from '@/hooks/useROI';
import { ROIOverview } from '@/components/roi/ROIOverview';
import { ROIChart } from '@/components/roi/ROIChart';
import { PlatformROICards } from '@/components/roi/PlatformROICards';
import { InvestmentList } from '@/components/roi/InvestmentList';
import { InvestmentForm } from '@/components/roi/InvestmentForm';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Plus,
  Calculator,
} from '@/components/icons';
import type { InvestmentType, InvestmentCategory } from '@/lib/roi/roi-service';

export default function ROIPage() {
  const [typeFilter, setTypeFilter] = useState<InvestmentType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<InvestmentCategory | 'all'>('all');
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '365d' | 'all'>('all');

  // Calculate date filters
  const getDateFilters = () => {
    if (dateRange === 'all') return {};
    const now = new Date();
    const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate, endDate: now };
  };

  const dateFilters = getDateFilters();

  const {
    data,
    isLoading,
    error,
    isMutating,
    refetch,
    createInvestment,
    updateInvestment,
    deleteInvestment,
  } = useROI({
    type: typeFilter === 'all' ? undefined : typeFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    ...dateFilters,
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContentInvestment | null>(null);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowForm(true);
  };

  const handleEditEntry = (entry: ContentInvestment) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteInvestment(id);
  };

  const handleSubmit = async (input: CreateInvestmentInput) => {
    if (editingEntry) {
      await updateInvestment(editingEntry.id, input);
    } else {
      await createInvestment(input);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="ROI Calculator"
          description="Measure return on your content investment"
        />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Failed to load ROI data</h3>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const emptyData = !data || data.investments.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="ROI Calculator"
          description="Measure return on your content investment"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as InvestmentType | 'all')}
          >
            <SelectTrigger className="w-[120px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="money">Money</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as InvestmentCategory | 'all')}
          >
            <SelectTrigger className="w-[140px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="creation">Creation</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="software">Software</SelectItem>
              <SelectItem value="promotion">Promotion</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as typeof dateRange)}
          >
            <SelectTrigger className="w-[120px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="border-white/10"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button onClick={handleAddEntry} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Investment
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {emptyData && !isLoading && (
        <div className="bg-gray-900/30 border border-white/10 rounded-xl p-12 text-center">
          <Calculator className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Investments Tracked Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Start tracking your content investments to calculate ROI.
            Track time spent creating content and money invested in equipment, software, and promotion.
          </p>
          <Button onClick={handleAddEntry} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Your First Investment
          </Button>
        </div>
      )}

      {/* ROI Overview */}
      {(!emptyData || isLoading) && (
        <ROIOverview
          metrics={data?.report.overall || null}
          isLoading={isLoading}
        />
      )}

      {/* ROI Chart */}
      {(!emptyData || isLoading) && (
        <ROIChart
          data={data?.report.byPlatform || []}
          currency={data?.report.overall.currency}
          isLoading={isLoading}
        />
      )}

      {/* Platform ROI Cards */}
      {(!emptyData || isLoading) && data?.report.byPlatform && data.report.byPlatform.length > 0 && (
        <PlatformROICards
          data={data?.report.byPlatform || []}
          currency={data?.report.overall.currency}
          isLoading={isLoading}
        />
      )}

      {/* Investment List */}
      {(!emptyData || isLoading) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Investments</h3>
            <span className="text-sm text-gray-500">
              {data?.investments.length || 0} investments
            </span>
          </div>
          <InvestmentList
            entries={data?.investments || []}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <InvestmentForm
          entry={editingEntry}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          isSubmitting={isMutating}
        />
      )}
    </div>
  );
}
