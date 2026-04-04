/**
 * Affiliate Link Types & Constants — Client-safe
 *
 * @description Types and static constants for the Affiliate Link system.
 * No server-only imports (no prisma, no ioredis, no crypto).
 * The full AffiliateLinkService lives in affiliate-link-service.ts (server-only).
 */

// ============================================================================
// TYPES
// ============================================================================

export type NetworkSlug = 'amazon' | 'shareasale' | 'cj' | 'impact' | 'rakuten' | 'awin' | 'custom';

// ============================================================================
// CONSTANTS
// ============================================================================

export const NETWORK_SLUGS: NetworkSlug[] = ['amazon', 'shareasale', 'cj', 'impact', 'rakuten', 'awin', 'custom'];

export const NETWORK_LABELS: Record<NetworkSlug, string> = {
  amazon: 'Amazon Associates',
  shareasale: 'ShareASale',
  cj: 'CJ Affiliate',
  impact: 'Impact',
  rakuten: 'Rakuten Advertising',
  awin: 'Awin',
  custom: 'Custom',
};

export const NETWORK_COLORS: Record<NetworkSlug, string> = {
  amazon: '#FF9900',
  shareasale: '#00A36C',
  cj: '#0066CC',
  impact: '#6366F1',
  rakuten: '#BF0000',
  awin: '#00A0D0',
  custom: '#6B7280',
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface AffiliateNetwork {
  id: string;
  userId: string;
  name: string;
  slug: NetworkSlug;
  apiKey: string | null;
  trackingId: string | null;
  isActive: boolean;
  commissionRate: number | null;
  createdAt: Date;
  updatedAt: Date;
  links?: AffiliateLink[];
  _count?: { links: number };
}

export interface AffiliateLink {
  id: string;
  userId: string;
  networkId: string | null;
  name: string;
  originalUrl: string;
  affiliateUrl: string;
  shortCode: string | null;
  clickCount: number;
  conversionCount: number;
  totalRevenue: number;
  productName: string | null;
  productImage: string | null;
  category: string | null;
  tags: string[];
  autoInsert: boolean;
  keywords: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  network?: AffiliateNetwork;
}

export interface AffiliateLinkClick {
  id: string;
  linkId: string;
  ipHash: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  converted: boolean;
  revenue: number | null;
  orderId: string | null;
  createdAt: Date;
}

export interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  networkBreakdown: {
    networkId: string | null;
    networkName: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }[];
  topLinks: {
    id: string;
    name: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }[];
}

export interface CreateNetworkInput {
  name: string;
  slug: NetworkSlug;
  apiKey?: string;
  trackingId?: string;
  isActive?: boolean;
  commissionRate?: number;
}

export interface UpdateNetworkInput {
  name?: string;
  apiKey?: string | null;
  trackingId?: string | null;
  isActive?: boolean;
  commissionRate?: number | null;
}

export interface CreateLinkInput {
  networkId?: string;
  name: string;
  originalUrl: string;
  affiliateUrl: string;
  shortCode?: string;
  productName?: string;
  productImage?: string;
  category?: string;
  tags?: string[];
  autoInsert?: boolean;
  keywords?: string[];
  isActive?: boolean;
}

export interface UpdateLinkInput {
  networkId?: string | null;
  name?: string;
  originalUrl?: string;
  affiliateUrl?: string;
  shortCode?: string | null;
  productName?: string | null;
  productImage?: string | null;
  category?: string | null;
  tags?: string[];
  autoInsert?: boolean;
  keywords?: string[];
  isActive?: boolean;
}

export interface TrackClickInput {
  ipHash?: string;
  userAgent?: string;
  referer?: string;
  country?: string;
}

export interface RecordConversionInput {
  orderId?: string;
  revenue: number;
}

export interface LinkFilters {
  networkId?: string;
  category?: string;
  activeOnly?: boolean;
  autoInsertOnly?: boolean;
}

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}
