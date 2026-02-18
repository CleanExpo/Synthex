'use client';

/**
 * Sponsor CRM Dashboard
 *
 * @description Manage brand relationships, track deals, and monitor deliverables.
 */

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { PipelineOverview } from '@/components/sponsors/PipelineOverview';
import { SponsorList } from '@/components/sponsors/SponsorList';
import { SponsorForm } from '@/components/sponsors/SponsorForm';
import { DealList } from '@/components/sponsors/DealList';
import { DealForm } from '@/components/sponsors/DealForm';
import { DeliverableForm } from '@/components/sponsors/DeliverableForm';
import { useSponsorCRM } from '@/hooks/useSponsorCRM';
import type {
  Sponsor,
  SponsorDeal,
  DealDeliverable,
  SponsorStatus,
  DealStage,
  CreateSponsorInput,
  UpdateSponsorInput,
  CreateDealInput,
  UpdateDealInput,
  CreateDeliverableInput,
  UpdateDeliverableInput,
} from '@/hooks/useSponsorCRM';
import { SPONSOR_STATUSES, STATUS_LABELS } from '@/hooks/useSponsorCRM';
import { cn } from '@/lib/utils';
import { Plus, Briefcase, X, RefreshCw } from '@/components/icons';

export default function SponsorCRMPage() {
  // CRM data hook
  const {
    sponsors,
    pipeline,
    isLoading,
    error,
    isMutating,
    refetch,
    createSponsor,
    updateSponsor,
    deleteSponsor,
    createDeal,
    updateDeal,
    deleteDeal,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
  } = useSponsorCRM();

  // Filters
  const [statusFilter, setStatusFilter] = useState<SponsorStatus | 'all'>('all');
  const [stageFilter, setStageFilter] = useState<DealStage | null>(null);

  // Selection state
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

  // Modal state
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);

  // Editing state
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [editingDeal, setEditingDeal] = useState<SponsorDeal | null>(null);
  const [editingDeliverable, setEditingDeliverable] = useState<DealDeliverable | null>(null);
  const [currentDeal, setCurrentDeal] = useState<SponsorDeal | null>(null);

  // Filter sponsors
  const filteredSponsors = sponsors.filter((sponsor) => {
    if (statusFilter !== 'all' && sponsor.status !== statusFilter) return false;
    return true;
  });

  // Handle sponsor form
  const handleSponsorSubmit = useCallback(
    async (data: CreateSponsorInput | UpdateSponsorInput) => {
      try {
        if (editingSponsor) {
          await updateSponsor(editingSponsor.id, data);
        } else {
          await createSponsor(data as CreateSponsorInput);
        }
        setShowSponsorForm(false);
        setEditingSponsor(null);
      } catch (err) {
        console.error('Failed to save sponsor:', err);
      }
    },
    [editingSponsor, createSponsor, updateSponsor]
  );

  // Handle deal form
  const handleDealSubmit = useCallback(
    async (data: CreateDealInput | UpdateDealInput) => {
      try {
        if (editingDeal && selectedSponsor) {
          await updateDeal(selectedSponsor.id, editingDeal.id, data);
        } else if (selectedSponsor) {
          await createDeal(selectedSponsor.id, data as CreateDealInput);
        }
        setShowDealForm(false);
        setEditingDeal(null);
      } catch (err) {
        console.error('Failed to save deal:', err);
      }
    },
    [selectedSponsor, editingDeal, createDeal, updateDeal]
  );

  // Handle deliverable form
  const handleDeliverableSubmit = useCallback(
    async (data: CreateDeliverableInput | UpdateDeliverableInput) => {
      try {
        if (editingDeliverable && selectedSponsor && currentDeal) {
          await updateDeliverable(selectedSponsor.id, currentDeal.id, editingDeliverable.id, data);
        } else if (selectedSponsor && currentDeal) {
          await createDeliverable(selectedSponsor.id, currentDeal.id, data as CreateDeliverableInput);
        }
        setShowDeliverableForm(false);
        setEditingDeliverable(null);
        setCurrentDeal(null);
      } catch (err) {
        console.error('Failed to save deliverable:', err);
      }
    },
    [selectedSponsor, currentDeal, editingDeliverable, createDeliverable, updateDeliverable]
  );

  // Handle delete sponsor
  const handleDeleteSponsor = useCallback(
    async (sponsor: Sponsor) => {
      if (!confirm(`Delete "${sponsor.name}"? This will remove all associated deals and deliverables.`)) {
        return;
      }
      try {
        await deleteSponsor(sponsor.id);
        if (selectedSponsor?.id === sponsor.id) {
          setSelectedSponsor(null);
        }
      } catch (err) {
        console.error('Failed to delete sponsor:', err);
      }
    },
    [deleteSponsor, selectedSponsor]
  );

  // Handle delete deal
  const handleDeleteDeal = useCallback(
    async (deal: SponsorDeal) => {
      if (!selectedSponsor) return;
      if (!confirm(`Delete deal "${deal.title}"? This will remove all associated deliverables.`)) {
        return;
      }
      try {
        await deleteDeal(selectedSponsor.id, deal.id);
      } catch (err) {
        console.error('Failed to delete deal:', err);
      }
    },
    [selectedSponsor, deleteDeal]
  );

  // Handle toggle deliverable status
  const handleToggleDeliverableStatus = useCallback(
    async (deal: SponsorDeal, deliverableId: string) => {
      if (!selectedSponsor) return;
      const deliverable = deal.deliverables?.find((d) => d.id === deliverableId);
      if (!deliverable) return;

      const newStatus = deliverable.status === 'approved' ? 'pending' : 'approved';
      try {
        await updateDeliverable(selectedSponsor.id, deal.id, deliverableId, { status: newStatus });
      } catch (err) {
        console.error('Failed to toggle deliverable status:', err);
      }
    },
    [selectedSponsor, updateDeliverable]
  );

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">Failed to load sponsor data: {error}</p>
          <button
            onClick={refetch}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Sponsor CRM"
          description="Manage brand relationships, track deals, and monitor deliverables"
        />
        <button
          onClick={() => {
            setEditingSponsor(null);
            setShowSponsorForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Sponsor
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50">Status:</span>
          <div className="flex items-center gap-1 bg-gray-900/50 border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                statusFilter === 'all'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white'
              )}
            >
              All
            </button>
            {SPONSOR_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  statusFilter === status
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white'
                )}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Overview */}
      <PipelineOverview
        pipeline={pipeline}
        onStageClick={setStageFilter}
        selectedStage={stageFilter}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sponsor List */}
        <div className={cn(selectedSponsor ? 'lg:col-span-1' : 'lg:col-span-3')}>
          {!isLoading && filteredSponsors.length === 0 ? (
            <DashboardEmptyState
              icon={Briefcase}
              title="No sponsors yet"
              description="Start by adding your first brand partner"
              action={{
                label: 'Add Sponsor',
                onClick: () => {
                  setEditingSponsor(null);
                  setShowSponsorForm(true);
                },
              }}
            />
          ) : (
            <SponsorList
              sponsors={filteredSponsors}
              onSelect={setSelectedSponsor}
              onEdit={(sponsor) => {
                setEditingSponsor(sponsor);
                setShowSponsorForm(true);
              }}
              onDelete={handleDeleteSponsor}
              selectedId={selectedSponsor?.id}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Selected Sponsor Panel */}
        {selectedSponsor && (
          <div className="lg:col-span-2 space-y-6">
            {/* Panel Header */}
            <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedSponsor.name}</h3>
                {selectedSponsor.company && (
                  <p className="text-sm text-white/50">{selectedSponsor.company}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingDeal(null);
                    setShowDealForm(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg text-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Deal
                </button>
                <button
                  onClick={() => setSelectedSponsor(null)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Deals List */}
            <div>
              <h4 className="text-sm font-medium text-white/70 mb-3">Deals</h4>
              <DealList
                deals={selectedSponsor.deals ?? []}
                sponsorId={selectedSponsor.id}
                onEdit={(deal) => {
                  setEditingDeal(deal);
                  setShowDealForm(true);
                }}
                onDelete={handleDeleteDeal}
                onAddDeliverable={(deal) => {
                  setCurrentDeal(deal);
                  setEditingDeliverable(null);
                  setShowDeliverableForm(true);
                }}
                onEditDeliverable={(deal, deliverableId) => {
                  const deliverable = deal.deliverables?.find((d) => d.id === deliverableId);
                  if (deliverable) {
                    setCurrentDeal(deal);
                    setEditingDeliverable(deliverable);
                    setShowDeliverableForm(true);
                  }
                }}
                onDeleteDeliverable={async (deal, deliverableId) => {
                  if (!confirm('Delete this deliverable?')) return;
                  try {
                    await deleteDeliverable(selectedSponsor.id, deal.id, deliverableId);
                  } catch (err) {
                    console.error('Failed to delete deliverable:', err);
                  }
                }}
                onToggleDeliverableStatus={(deal, deliverableId) =>
                  handleToggleDeliverableStatus(deal, deliverableId)
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Sponsor Form Modal */}
      <SponsorForm
        isOpen={showSponsorForm}
        onClose={() => {
          setShowSponsorForm(false);
          setEditingSponsor(null);
        }}
        onSubmit={handleSponsorSubmit}
        sponsor={editingSponsor}
        isLoading={isMutating}
      />

      {/* Deal Form Modal */}
      <DealForm
        isOpen={showDealForm}
        onClose={() => {
          setShowDealForm(false);
          setEditingDeal(null);
        }}
        onSubmit={handleDealSubmit}
        deal={editingDeal}
        isLoading={isMutating}
      />

      {/* Deliverable Form Modal */}
      <DeliverableForm
        isOpen={showDeliverableForm}
        onClose={() => {
          setShowDeliverableForm(false);
          setEditingDeliverable(null);
          setCurrentDeal(null);
        }}
        onSubmit={handleDeliverableSubmit}
        deliverable={editingDeliverable}
        isLoading={isMutating}
      />
    </div>
  );
}
