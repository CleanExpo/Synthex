'use client';

/**
 * Affiliate Links Dashboard
 *
 * @description Manage affiliate networks, links, and view analytics.
 */

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { StatsOverview } from '@/components/affiliates/StatsOverview';
import { NetworkList } from '@/components/affiliates/NetworkList';
import { NetworkForm } from '@/components/affiliates/NetworkForm';
import { LinkList } from '@/components/affiliates/LinkList';
import { LinkForm } from '@/components/affiliates/LinkForm';
import { useAffiliateLinks } from '@/hooks/useAffiliateLinks';
import type {
  AffiliateNetwork,
  AffiliateLink,
  CreateNetworkInput,
  UpdateNetworkInput,
  CreateLinkInput,
  UpdateLinkInput,
} from '@/hooks/useAffiliateLinks';
import { cn } from '@/lib/utils';
import { Plus, Link as LinkIcon, Globe, RefreshCw, ChevronDown, ChevronUp, X } from '@/components/icons';

export default function AffiliatesPage() {
  // Data hook
  const {
    networks,
    links,
    stats,
    isLoading,
    error,
    isMutating,
    refetch,
    createNetwork,
    updateNetwork,
    deleteNetwork,
    createLink,
    updateLink,
    deleteLink,
  } = useAffiliateLinks();

  // Filter state
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);

  // UI state
  const [showNetworks, setShowNetworks] = useState(true);
  const [selectedLink, setSelectedLink] = useState<AffiliateLink | null>(null);

  // Modal state
  const [showNetworkForm, setShowNetworkForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<AffiliateNetwork | null>(null);
  const [editingLink, setEditingLink] = useState<AffiliateLink | null>(null);

  // Filter links by network
  const filteredLinks = networkFilter
    ? links.filter((link) => link.networkId === networkFilter)
    : links;

  // Handle network form
  const handleNetworkSubmit = useCallback(
    async (data: CreateNetworkInput | UpdateNetworkInput) => {
      try {
        if (editingNetwork) {
          await updateNetwork(editingNetwork.id, data);
        } else {
          await createNetwork(data as CreateNetworkInput);
        }
        setShowNetworkForm(false);
        setEditingNetwork(null);
      } catch (err) {
        console.error('Failed to save network:', err);
      }
    },
    [editingNetwork, createNetwork, updateNetwork]
  );

  // Handle link form
  const handleLinkSubmit = useCallback(
    async (data: CreateLinkInput | UpdateLinkInput) => {
      try {
        if (editingLink) {
          await updateLink(editingLink.id, data);
        } else {
          await createLink(data as CreateLinkInput);
        }
        setShowLinkForm(false);
        setEditingLink(null);
      } catch (err) {
        console.error('Failed to save link:', err);
      }
    },
    [editingLink, createLink, updateLink]
  );

  // Handle delete network
  const handleDeleteNetwork = useCallback(
    async (network: AffiliateNetwork) => {
      if (!confirm(`Delete "${network.name}"? This will unlink all associated affiliate links.`)) {
        return;
      }
      try {
        await deleteNetwork(network.id);
      } catch (err) {
        console.error('Failed to delete network:', err);
      }
    },
    [deleteNetwork]
  );

  // Handle delete link
  const handleDeleteLink = useCallback(
    async (link: AffiliateLink) => {
      if (!confirm(`Delete "${link.name}"? This action cannot be undone.`)) {
        return;
      }
      try {
        await deleteLink(link.id);
        if (selectedLink?.id === link.id) {
          setSelectedLink(null);
        }
      } catch (err) {
        console.error('Failed to delete link:', err);
      }
    },
    [deleteLink, selectedLink]
  );

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">Failed to load affiliate data: {error}</p>
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
          title="Affiliate Links"
          description="Manage affiliate networks, track links, and monitor performance"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingNetwork(null);
              setShowNetworkForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
          >
            <Globe className="h-4 w-4" />
            Add Network
          </button>
          <button
            onClick={() => {
              setEditingLink(null);
              setShowLinkForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Link
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <StatsOverview stats={stats} isLoading={isLoading} />

      {/* Networks Section */}
      <div className="bg-gray-900/30 border border-white/10 rounded-xl">
        <button
          onClick={() => setShowNetworks(!showNetworks)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-white/50" />
            <span className="font-medium text-white">Networks</span>
            <span className="text-sm text-white/40">({networks.length})</span>
          </div>
          {showNetworks ? (
            <ChevronUp className="h-5 w-5 text-white/40" />
          ) : (
            <ChevronDown className="h-5 w-5 text-white/40" />
          )}
        </button>
        {showNetworks && (
          <div className="px-4 pb-4">
            <NetworkList
              networks={networks}
              onEdit={(network) => {
                setEditingNetwork(network);
                setShowNetworkForm(true);
              }}
              onDelete={handleDeleteNetwork}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Links Section */}
      <div className="space-y-4">
        {/* Filter */}
        {networks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50">Filter:</span>
            <div className="flex items-center gap-1 bg-gray-900/50 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setNetworkFilter(null)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  networkFilter === null
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white'
                )}
              >
                All
              </button>
              {networks.map((network) => (
                <button
                  key={network.id}
                  onClick={() => setNetworkFilter(network.id)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    networkFilter === network.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white'
                  )}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Links Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={cn(selectedLink ? 'lg:col-span-2' : 'lg:col-span-3')}>
            {!isLoading && filteredLinks.length === 0 ? (
              <DashboardEmptyState
                icon={LinkIcon}
                title="No affiliate links yet"
                description="Start by adding your first affiliate link"
                action={{
                  label: 'Add Link',
                  onClick: () => {
                    setEditingLink(null);
                    setShowLinkForm(true);
                  },
                }}
              />
            ) : (
              <LinkList
                links={filteredLinks}
                onSelect={setSelectedLink}
                onEdit={(link) => {
                  setEditingLink(link);
                  setShowLinkForm(true);
                }}
                onDelete={handleDeleteLink}
                selectedId={selectedLink?.id}
                isLoading={isLoading}
              />
            )}
          </div>

          {/* Selected Link Panel */}
          {selectedLink && (
            <div className="lg:col-span-1">
              <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">{selectedLink.name}</h3>
                  <button
                    onClick={() => setSelectedLink(null)}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-lg font-bold text-white">{selectedLink.clickCount}</div>
                    <div className="text-xs text-white/50">Clicks</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-lg font-bold text-emerald-400">
                      ${selectedLink.totalRevenue.toFixed(0)}
                    </div>
                    <div className="text-xs text-white/50">Revenue</div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 text-sm">
                  {selectedLink.productName && (
                    <div>
                      <span className="text-white/50">Product:</span>
                      <span className="text-white ml-2">{selectedLink.productName}</span>
                    </div>
                  )}
                  {selectedLink.category && (
                    <div>
                      <span className="text-white/50">Category:</span>
                      <span className="text-white ml-2">{selectedLink.category}</span>
                    </div>
                  )}
                  {selectedLink.network && (
                    <div>
                      <span className="text-white/50">Network:</span>
                      <span className="text-white ml-2">{selectedLink.network.name}</span>
                    </div>
                  )}
                  {selectedLink.shortCode && (
                    <div>
                      <span className="text-white/50">Short URL:</span>
                      <span className="text-cyan-400 ml-2">/go/{selectedLink.shortCode}</span>
                    </div>
                  )}
                </div>

                {/* Keywords */}
                {selectedLink.autoInsert && selectedLink.keywords.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-white/50 mb-2">Auto-Insert Keywords:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedLink.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      setEditingLink(selectedLink);
                      setShowLinkForm(true);
                    }}
                    className="flex-1 px-3 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-center"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => window.open(selectedLink.affiliateUrl, '_blank')}
                    className="flex-1 px-3 py-2 text-sm text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors text-center"
                  >
                    Open URL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Form Modal */}
      <NetworkForm
        isOpen={showNetworkForm}
        onClose={() => {
          setShowNetworkForm(false);
          setEditingNetwork(null);
        }}
        onSubmit={handleNetworkSubmit}
        network={editingNetwork}
        isLoading={isMutating}
      />

      {/* Link Form Modal */}
      <LinkForm
        isOpen={showLinkForm}
        onClose={() => {
          setShowLinkForm(false);
          setEditingLink(null);
        }}
        onSubmit={handleLinkSubmit}
        link={editingLink}
        networks={networks}
        isLoading={isMutating}
      />
    </div>
  );
}
