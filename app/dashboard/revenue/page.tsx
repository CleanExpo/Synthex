'use client';

/**
 * Revenue Dashboard
 *
 * @description Track income from sponsorships, affiliates, ads, and more.
 */

import { useState, useCallback } from 'react';
import { useRevenue, CreateRevenueInput, RevenueEntry } from '@/hooks/useRevenue';
import { RevenueOverview } from '@/components/revenue/RevenueOverview';
import { RevenueChart } from '@/components/revenue/RevenueChart';
import { RevenueBySource } from '@/components/revenue/RevenueBySource';
import { RevenueEntryList } from '@/components/revenue/RevenueEntryList';
import { RevenueEntryForm } from '@/components/revenue/RevenueEntryForm';
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
  DollarSign,
} from '@/components/icons';
import type { RevenueSource } from '@/lib/revenue/revenue-service';

export default function RevenuePage() {
  const [source, setSource] = useState<RevenueSource | 'all'>('all');
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
    createEntry,
    updateEntry,
    deleteEntry,
  } = useRevenue({
    source: source === 'all' ? undefined : source,
    ...dateFilters,
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueEntry | null>(null);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowForm(true);
  };

  const handleEditEntry = (entry: RevenueEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
  };

  const handleSubmit = async (input: CreateRevenueInput) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, input);
    } else {
      await createEntry(input);
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
          title="Revenue Tracker"
          description="Track your income across all monetization sources"
        />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Failed to load revenue data</h3>
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

  const emptyData = !data || data.entries.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Revenue Tracker"
          description="Track your income across all monetization sources"
        />
        <div className="flex items-center gap-3">
          <Select
            value={source}
            onValueChange={(v) => setSource(v as RevenueSource | 'all')}
          >
            <SelectTrigger className="w-[140px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="sponsorship">Sponsorship</SelectItem>
              <SelectItem value="affiliate">Affiliate</SelectItem>
              <SelectItem value="ads">Ad Revenue</SelectItem>
              <SelectItem value="tips">Tips</SelectItem>
              <SelectItem value="merchandise">Merchandise</SelectItem>
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
            Add Entry
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {emptyData && !isLoading && (
        <div className="bg-gray-900/30 border border-white/10 rounded-xl p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Revenue Data Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Start tracking your income by adding your first revenue entry.
            Track sponsorships, affiliate commissions, ad revenue, and more.
          </p>
          <Button onClick={handleAddEntry} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Your First Entry
          </Button>
        </div>
      )}

      {/* Overview Stats */}
      {(!emptyData || isLoading) && (
        <RevenueOverview summary={data?.summary || null} isLoading={isLoading} />
      )}

      {/* Charts Row */}
      {(!emptyData || isLoading) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart
              data={data?.summary.byMonth || []}
              currency={data?.summary.currency}
              isLoading={isLoading}
            />
          </div>
          <RevenueBySource
            data={data?.summary.bySource || {
              sponsorship: 0,
              affiliate: 0,
              ads: 0,
              tips: 0,
              merchandise: 0,
              other: 0,
            }}
            currency={data?.summary.currency}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Entry List */}
      {(!emptyData || isLoading) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Revenue Entries</h3>
            <span className="text-sm text-gray-500">
              {data?.entries.length || 0} entries
            </span>
          </div>
          <RevenueEntryList
            entries={data?.entries || []}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <RevenueEntryForm
          entry={editingEntry}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
          isSubmitting={isMutating}
        />
      )}
    </div>
  );
}
