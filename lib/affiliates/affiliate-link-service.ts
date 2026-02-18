/**
 * Affiliate Link Service
 *
 * @description Handles affiliate link management including networks, links, and click tracking.
 * Enables creators to manage affiliate partnerships, track performance, and auto-insert links.
 *
 * @module lib/affiliates/affiliate-link-service
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export type NetworkSlug = 'amazon' | 'shareasale' | 'cj' | 'impact' | 'rakuten' | 'awin' | 'custom';

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

// =============================================================================
// INTERFACES
// =============================================================================

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

// =============================================================================
// INPUT INTERFACES
// =============================================================================

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

// =============================================================================
// HELPERS
// =============================================================================

function convertDecimalToNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function convertNetwork(network: any): AffiliateNetwork {
  return {
    ...network,
    commissionRate: convertDecimalToNumber(network.commissionRate),
    links: network.links?.map(convertLink),
  };
}

function convertLink(link: any): AffiliateLink {
  return {
    ...link,
    totalRevenue: Number(link.totalRevenue || 0),
    network: link.network ? convertNetwork(link.network) : undefined,
  };
}

function convertClick(click: any): AffiliateLinkClick {
  return {
    ...click,
    revenue: convertDecimalToNumber(click.revenue),
  };
}

// =============================================================================
// NETWORK SERVICE
// =============================================================================

export class AffiliateLinkService {
  // ---------------------------------------------------------------------------
  // NETWORK METHODS
  // ---------------------------------------------------------------------------

  /**
   * List all affiliate networks for a user
   */
  static async listNetworks(userId: string): Promise<AffiliateNetwork[]> {
    const networks = await prisma.affiliateNetwork.findMany({
      where: { userId },
      include: {
        _count: { select: { links: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return networks.map(convertNetwork);
  }

  /**
   * Get a single network by ID
   */
  static async getNetwork(userId: string, networkId: string): Promise<AffiliateNetwork | null> {
    const network = await prisma.affiliateNetwork.findFirst({
      where: { id: networkId, userId },
      include: {
        _count: { select: { links: true } },
      },
    });

    return network ? convertNetwork(network) : null;
  }

  /**
   * Create a new affiliate network
   */
  static async createNetwork(userId: string, data: CreateNetworkInput): Promise<AffiliateNetwork> {
    const network = await prisma.affiliateNetwork.create({
      data: {
        userId,
        name: data.name,
        slug: data.slug,
        apiKey: data.apiKey,
        trackingId: data.trackingId,
        isActive: data.isActive ?? true,
        commissionRate: data.commissionRate,
      },
      include: {
        _count: { select: { links: true } },
      },
    });

    return convertNetwork(network);
  }

  /**
   * Update an affiliate network
   */
  static async updateNetwork(
    userId: string,
    networkId: string,
    data: UpdateNetworkInput
  ): Promise<AffiliateNetwork> {
    const network = await prisma.affiliateNetwork.update({
      where: { id: networkId, userId },
      data: {
        name: data.name,
        apiKey: data.apiKey,
        trackingId: data.trackingId,
        isActive: data.isActive,
        commissionRate: data.commissionRate,
      },
      include: {
        _count: { select: { links: true } },
      },
    });

    return convertNetwork(network);
  }

  /**
   * Delete an affiliate network
   */
  static async deleteNetwork(userId: string, networkId: string): Promise<void> {
    await prisma.affiliateNetwork.delete({
      where: { id: networkId, userId },
    });
  }

  // ---------------------------------------------------------------------------
  // LINK METHODS
  // ---------------------------------------------------------------------------

  /**
   * List all affiliate links for a user
   */
  static async listLinks(userId: string, filters?: LinkFilters): Promise<AffiliateLink[]> {
    const where: any = { userId };

    if (filters?.networkId) {
      where.networkId = filters.networkId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.activeOnly) {
      where.isActive = true;
    }
    if (filters?.autoInsertOnly) {
      where.autoInsert = true;
    }

    const links = await prisma.affiliateLink.findMany({
      where,
      include: { network: true },
      orderBy: { createdAt: 'desc' },
    });

    return links.map(convertLink);
  }

  /**
   * Get a single link by ID
   */
  static async getLink(userId: string, linkId: string): Promise<AffiliateLink | null> {
    const link = await prisma.affiliateLink.findFirst({
      where: { id: linkId, userId },
      include: { network: true },
    });

    return link ? convertLink(link) : null;
  }

  /**
   * Get a link by short code (for redirect)
   */
  static async getLinkByShortCode(shortCode: string): Promise<AffiliateLink | null> {
    const link = await prisma.affiliateLink.findUnique({
      where: { shortCode },
      include: { network: true },
    });

    return link ? convertLink(link) : null;
  }

  /**
   * Generate a unique short code
   */
  static async generateShortCode(): Promise<string> {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await prisma.affiliateLink.findUnique({
        where: { shortCode: code },
      });

      if (!existing) {
        return code;
      }
      attempts++;
    }

    // Fallback to UUID-based code
    return crypto.randomUUID().slice(0, 8);
  }

  /**
   * Create a new affiliate link
   */
  static async createLink(userId: string, data: CreateLinkInput): Promise<AffiliateLink> {
    const shortCode = data.shortCode || (await this.generateShortCode());

    const link = await prisma.affiliateLink.create({
      data: {
        userId,
        networkId: data.networkId,
        name: data.name,
        originalUrl: data.originalUrl,
        affiliateUrl: data.affiliateUrl,
        shortCode,
        productName: data.productName,
        productImage: data.productImage,
        category: data.category,
        tags: data.tags || [],
        autoInsert: data.autoInsert ?? false,
        keywords: data.keywords || [],
        isActive: data.isActive ?? true,
      },
      include: { network: true },
    });

    return convertLink(link);
  }

  /**
   * Update an affiliate link
   */
  static async updateLink(userId: string, linkId: string, data: UpdateLinkInput): Promise<AffiliateLink> {
    const link = await prisma.affiliateLink.update({
      where: { id: linkId, userId },
      data: {
        networkId: data.networkId,
        name: data.name,
        originalUrl: data.originalUrl,
        affiliateUrl: data.affiliateUrl,
        shortCode: data.shortCode,
        productName: data.productName,
        productImage: data.productImage,
        category: data.category,
        tags: data.tags,
        autoInsert: data.autoInsert,
        keywords: data.keywords,
        isActive: data.isActive,
      },
      include: { network: true },
    });

    return convertLink(link);
  }

  /**
   * Delete an affiliate link
   */
  static async deleteLink(userId: string, linkId: string): Promise<void> {
    await prisma.affiliateLink.delete({
      where: { id: linkId, userId },
    });
  }

  // ---------------------------------------------------------------------------
  // TRACKING METHODS
  // ---------------------------------------------------------------------------

  /**
   * Track a click on an affiliate link
   */
  static async trackClick(linkId: string, data: TrackClickInput): Promise<AffiliateLinkClick> {
    // Create click record and increment counter in transaction
    const [click] = await prisma.$transaction([
      prisma.affiliateLinkClick.create({
        data: {
          linkId,
          ipHash: data.ipHash,
          userAgent: data.userAgent,
          referer: data.referer,
          country: data.country,
        },
      }),
      prisma.affiliateLink.update({
        where: { id: linkId },
        data: { clickCount: { increment: 1 } },
      }),
    ]);

    return convertClick(click);
  }

  /**
   * Record a conversion for an affiliate link
   */
  static async recordConversion(linkId: string, data: RecordConversionInput): Promise<void> {
    await prisma.$transaction([
      prisma.affiliateLinkClick.updateMany({
        where: {
          linkId,
          converted: false,
          orderId: data.orderId || null,
        },
        data: {
          converted: true,
          revenue: data.revenue,
          orderId: data.orderId,
        },
      }),
      prisma.affiliateLink.update({
        where: { id: linkId },
        data: {
          conversionCount: { increment: 1 },
          totalRevenue: { increment: data.revenue },
        },
      }),
    ]);
  }

  /**
   * Get click history for a link
   */
  static async getLinkClicks(
    userId: string,
    linkId: string,
    dateRange?: DateRange
  ): Promise<AffiliateLinkClick[]> {
    // Verify ownership
    const link = await prisma.affiliateLink.findFirst({
      where: { id: linkId, userId },
    });

    if (!link) {
      throw new Error('Link not found');
    }

    const where: any = { linkId };

    if (dateRange?.startDate) {
      where.createdAt = { gte: dateRange.startDate };
    }
    if (dateRange?.endDate) {
      where.createdAt = { ...where.createdAt, lte: dateRange.endDate };
    }

    const clicks = await prisma.affiliateLinkClick.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return clicks.map(convertClick);
  }

  // ---------------------------------------------------------------------------
  // AUTO-INSERTION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Find links that match keywords in content
   */
  static async findMatchingLinks(userId: string, content: string): Promise<AffiliateLink[]> {
    const links = await prisma.affiliateLink.findMany({
      where: {
        userId,
        isActive: true,
        autoInsert: true,
        keywords: { isEmpty: false },
      },
      include: { network: true },
    });

    const contentLower = content.toLowerCase();
    const matchingLinks = links.filter((link) =>
      link.keywords.some((keyword) => contentLower.includes(keyword.toLowerCase()))
    );

    return matchingLinks.map(convertLink);
  }

  /**
   * Insert affiliate links into content
   */
  static async insertAffiliateLinks(
    userId: string,
    content: string,
    options?: { maxLinks?: number; useShortCodes?: boolean }
  ): Promise<{ content: string; insertedLinks: string[] }> {
    const maxLinks = options?.maxLinks ?? 5;
    const useShortCodes = options?.useShortCodes ?? false;

    const matchingLinks = await this.findMatchingLinks(userId, content);
    const insertedLinks: string[] = [];
    let modifiedContent = content;

    for (const link of matchingLinks.slice(0, maxLinks)) {
      for (const keyword of link.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        if (regex.test(modifiedContent)) {
          const url = useShortCodes && link.shortCode
            ? `/go/${link.shortCode}`
            : link.affiliateUrl;

          modifiedContent = modifiedContent.replace(
            regex,
            `[${keyword}](${url})`
          );
          insertedLinks.push(link.id);
          break; // Only insert once per link
        }
      }
    }

    return { content: modifiedContent, insertedLinks: [...new Set(insertedLinks)] };
  }

  // ---------------------------------------------------------------------------
  // AGGREGATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get aggregate affiliate stats
   */
  static async getAffiliateStats(userId: string, dateRange?: DateRange): Promise<AffiliateStats> {
    const links = await prisma.affiliateLink.findMany({
      where: { userId },
      include: { network: true },
    });

    // Calculate totals
    const totalClicks = links.reduce((sum, link) => sum + link.clickCount, 0);
    const totalConversions = links.reduce((sum, link) => sum + link.conversionCount, 0);
    const totalRevenue = links.reduce((sum, link) => sum + Number(link.totalRevenue || 0), 0);
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    // Group by network
    const networkMap = new Map<string | null, {
      networkId: string | null;
      networkName: string;
      clicks: number;
      conversions: number;
      revenue: number;
    }>();

    for (const link of links) {
      const key = link.networkId;
      const existing = networkMap.get(key) || {
        networkId: link.networkId,
        networkName: link.network?.name || 'No Network',
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };

      existing.clicks += link.clickCount;
      existing.conversions += link.conversionCount;
      existing.revenue += Number(link.totalRevenue || 0);
      networkMap.set(key, existing);
    }

    // Top performing links
    const topLinks = [...links]
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, 10)
      .map((link) => ({
        id: link.id,
        name: link.name,
        clicks: link.clickCount,
        conversions: link.conversionCount,
        revenue: Number(link.totalRevenue || 0),
      }));

    return {
      totalClicks,
      totalConversions,
      totalRevenue,
      conversionRate,
      networkBreakdown: Array.from(networkMap.values()),
      topLinks,
    };
  }
}

export default AffiliateLinkService;
