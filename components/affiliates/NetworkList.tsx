'use client';

/**
 * Network List
 *
 * @description Card grid of configured affiliate networks with stats and actions.
 */

import { cn } from '@/lib/utils';
import { Globe, Edit, Trash2, Link, DollarSign, ToggleLeft, ToggleRight } from '@/components/icons';
import type { AffiliateNetwork } from '@/hooks/useAffiliateLinks';
import { NETWORK_LABELS, NETWORK_COLORS, type NetworkSlug } from '@/hooks/useAffiliateLinks';

interface NetworkListProps {
  networks: AffiliateNetwork[];
  onEdit?: (network: AffiliateNetwork) => void;
  onDelete?: (network: AffiliateNetwork) => void;
  isLoading?: boolean;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" />
              <div>
                <div className="w-28 h-5 bg-white/5 rounded animate-pulse mb-2" />
                <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NetworkCard({
  network,
  onEdit,
  onDelete,
}: {
  network: AffiliateNetwork;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const linkCount = network._count?.links ?? 0;
  const color = NETWORK_COLORS[network.slug as NetworkSlug] || NETWORK_COLORS.custom;

  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-5 transition-all hover:border-white/20 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Network Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Globe className="h-5 w-5" style={{ color }} />
          </div>
          <div>
            <h4 className="font-semibold text-white">{network.name}</h4>
            <p className="text-sm text-white/50">
              {NETWORK_LABELS[network.slug as NetworkSlug] || network.slug}
            </p>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="flex items-center gap-1">
          {network.isActive ? (
            <ToggleRight className="h-5 w-5 text-emerald-400" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-white/30" />
          )}
          <span className={cn(
            'text-xs font-medium',
            network.isActive ? 'text-emerald-400' : 'text-white/30'
          )}>
            {network.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-white/60">
        <div className="flex items-center gap-1.5">
          <Link className="h-4 w-4" />
          <span>{linkCount} links</span>
        </div>
        {network.commissionRate !== null && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            <span>{network.commissionRate}% commission</span>
          </div>
        )}
      </div>

      {/* Tracking ID */}
      {network.trackingId && (
        <div className="mt-3 text-xs text-white/40 truncate">
          ID: {network.trackingId}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Edit className="h-4 w-4" />
          <span>Edit</span>
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

export function NetworkList({
  networks,
  onEdit,
  onDelete,
  isLoading,
  className,
}: NetworkListProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (networks.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-8 text-center', className)}>
        <Globe className="h-10 w-10 text-white/20 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white mb-1">No networks configured</h3>
        <p className="text-white/50 text-sm">Add an affiliate network to start tracking links.</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {networks.map((network) => (
        <NetworkCard
          key={network.id}
          network={network}
          onEdit={() => onEdit?.(network)}
          onDelete={() => onDelete?.(network)}
        />
      ))}
    </div>
  );
}

export default NetworkList;
