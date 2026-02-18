'use client';

/**
 * Sponsor List
 *
 * @description Card grid of sponsors with status badges and actions.
 */

import { cn } from '@/lib/utils';
import { Building2, Mail, Globe, Edit, Trash2, DollarSign, Briefcase } from '@/components/icons';
import type { Sponsor, SponsorStatus } from '@/hooks/useSponsorCRM';
import { STATUS_LABELS } from '@/hooks/useSponsorCRM';

interface SponsorListProps {
  sponsors: Sponsor[];
  onSelect?: (sponsor: Sponsor) => void;
  onEdit?: (sponsor: Sponsor) => void;
  onDelete?: (sponsor: Sponsor) => void;
  selectedId?: string;
  isLoading?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<SponsorStatus, string> = {
  lead: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  past: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
            <div className="flex-1">
              <div className="w-32 h-5 bg-white/5 rounded animate-pulse mb-2" />
              <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="w-full h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-3/4 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SponsorCard({
  sponsor,
  onSelect,
  onEdit,
  onDelete,
  isSelected,
}: {
  sponsor: Sponsor;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
}) {
  const dealCount = sponsor.deals?.length ?? 0;
  const totalValue = sponsor.deals?.reduce((sum, deal) => sum + deal.value, 0) ?? 0;

  return (
    <div
      className={cn(
        'bg-gray-900/50 border rounded-xl p-5 transition-all cursor-pointer group',
        isSelected ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' : 'border-white/10 hover:border-white/20'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          {/* Avatar/Logo */}
          {sponsor.logo ? (
            <img
              src={sponsor.logo}
              alt={sponsor.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white/50" />
            </div>
          )}
          <div>
            <h4 className="font-semibold text-white">{sponsor.name}</h4>
            {sponsor.company && (
              <p className="text-sm text-white/50">{sponsor.company}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-full border',
            STATUS_COLORS[sponsor.status]
          )}
        >
          {STATUS_LABELS[sponsor.status]}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm text-white/60">
        {sponsor.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="truncate">{sponsor.email}</span>
          </div>
        )}
        {sponsor.website && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="truncate">{sponsor.website}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-1.5 text-sm">
          <Briefcase className="h-4 w-4 text-white/40" />
          <span className="text-white/70">{dealCount} deals</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <DollarSign className="h-4 w-4 text-white/40" />
          <span className="text-white/70">{formatCurrency(totalValue)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Edit className="h-4 w-4" />
          <span>Edit</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

export function SponsorList({
  sponsors,
  onSelect,
  onEdit,
  onDelete,
  selectedId,
  isLoading,
  className,
}: SponsorListProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (sponsors.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-12 text-center', className)}>
        <Building2 className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No sponsors yet</h3>
        <p className="text-white/50">Add your first sponsor to start tracking brand relationships.</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {sponsors.map((sponsor) => (
        <SponsorCard
          key={sponsor.id}
          sponsor={sponsor}
          onSelect={() => onSelect?.(sponsor)}
          onEdit={() => onEdit?.(sponsor)}
          onDelete={() => onDelete?.(sponsor)}
          isSelected={selectedId === sponsor.id}
        />
      ))}
    </div>
  );
}

export default SponsorList;
