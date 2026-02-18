'use client';

/**
 * Affiliate Link List
 *
 * @description Card grid of affiliate links with stats and actions.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Link as LinkIcon,
  ExternalLink,
  Edit,
  Trash2,
  MousePointer,
  DollarSign,
  Copy,
  Check,
  Zap,
  Image,
} from '@/components/icons';
import type { AffiliateLink } from '@/hooks/useAffiliateLinks';
import { NETWORK_LABELS, NETWORK_COLORS, type NetworkSlug } from '@/hooks/useAffiliateLinks';

interface LinkListProps {
  links: AffiliateLink[];
  onSelect?: (link: AffiliateLink) => void;
  onEdit?: (link: AffiliateLink) => void;
  onDelete?: (link: AffiliateLink) => void;
  selectedId?: string;
  isLoading?: boolean;
  className?: string;
}

type SortKey = 'recent' | 'clicks' | 'revenue';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-16 h-16 rounded-lg bg-white/5 animate-pulse" />
            <div className="flex-1">
              <div className="w-32 h-5 bg-white/5 rounded animate-pulse mb-2" />
              <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
            <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkCard({
  link,
  onSelect,
  onEdit,
  onDelete,
  isSelected,
}: {
  link: AffiliateLink;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const networkColor = link.network
    ? NETWORK_COLORS[link.network.slug as NetworkSlug] || NETWORK_COLORS.custom
    : NETWORK_COLORS.custom;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = link.shortCode
      ? `${window.location.origin}/go/${link.shortCode}`
      : link.affiliateUrl;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'bg-gray-900/50 border rounded-xl p-5 transition-all cursor-pointer group',
        isSelected
          ? 'border-cyan-500/50 ring-1 ring-cyan-500/30'
          : 'border-white/10 hover:border-white/20'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {/* Product Image */}
        {link.productImage ? (
          <img
            src={link.productImage}
            alt={link.productName || link.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
            <Image className="h-6 w-6 text-white/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white truncate">{link.name}</h4>
          {link.productName && (
            <p className="text-sm text-white/50 truncate">{link.productName}</p>
          )}
          {/* Network Badge */}
          {link.network && (
            <span
              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: `${networkColor}20`,
                color: networkColor,
              }}
            >
              {NETWORK_LABELS[link.network.slug as NetworkSlug] || link.network.name}
            </span>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex flex-col items-end gap-1">
          {!link.isActive && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-500/20 text-gray-400 rounded-full">
              Inactive
            </span>
          )}
          {link.autoInsert && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
              <Zap className="h-3 w-3" />
              Auto
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-white/60">
          <MousePointer className="h-4 w-4" />
          <span>{formatNumber(link.clickCount)} clicks</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/60">
          <DollarSign className="h-4 w-4" />
          <span>{formatCurrency(link.totalRevenue)}</span>
        </div>
        {link.conversionCount > 0 && (
          <span className="text-emerald-400 text-xs">
            {link.conversionCount} conversions
          </span>
        )}
      </div>

      {/* Short Code / URL */}
      {link.shortCode && (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <LinkIcon className="h-3 w-3" />
          <span className="truncate">/go/{link.shortCode}</span>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(link.affiliateUrl, '_blank');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Open</span>
        </button>
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

export function LinkList({
  links,
  onSelect,
  onEdit,
  onDelete,
  selectedId,
  isLoading,
  className,
}: LinkListProps) {
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (links.length === 0) {
    return (
      <div className={cn('bg-gray-900/50 border border-white/10 rounded-xl p-12 text-center', className)}>
        <LinkIcon className="h-12 w-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No affiliate links yet</h3>
        <p className="text-white/50">Add your first affiliate link to start tracking.</p>
      </div>
    );
  }

  // Sort links
  const sortedLinks = [...links].sort((a, b) => {
    switch (sortBy) {
      case 'clicks':
        return b.clickCount - a.clickCount;
      case 'revenue':
        return b.totalRevenue - a.totalRevenue;
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <div className={className}>
      {/* Sort Controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-white/50">Sort by:</span>
        <div className="flex items-center gap-1 bg-gray-900/50 border border-white/10 rounded-lg p-1">
          {(['recent', 'clicks', 'revenue'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                sortBy === key
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white'
              )}
            >
              {key === 'recent' ? 'Recent' : key === 'clicks' ? 'Clicks' : 'Revenue'}
            </button>
          ))}
        </div>
      </div>

      {/* Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedLinks.map((link) => (
          <LinkCard
            key={link.id}
            link={link}
            onSelect={() => onSelect?.(link)}
            onEdit={() => onEdit?.(link)}
            onDelete={() => onDelete?.(link)}
            isSelected={selectedId === link.id}
          />
        ))}
      </div>
    </div>
  );
}

export default LinkList;
