/**
 * Revenue Service
 *
 * @description Handles revenue tracking CRUD operations and aggregations
 * for creator monetization across multiple income sources.
 *
 * @module lib/revenue/revenue-service
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// =============================================================================
// TYPES
// =============================================================================

export type RevenueSource =
  | 'sponsorship'
  | 'affiliate'
  | 'ads'
  | 'tips'
  | 'merchandise'
  | 'other';

export const REVENUE_SOURCES: RevenueSource[] = [
  'sponsorship',
  'affiliate',
  'ads',
  'tips',
  'merchandise',
  'other',
];

export const SOURCE_LABELS: Record<RevenueSource, string> = {
  sponsorship: 'Sponsorship',
  affiliate: 'Affiliate',
  ads: 'Ad Revenue',
  tips: 'Tips & Donations',
  merchandise: 'Merchandise',
  other: 'Other',
};

export interface RevenueEntry {
  id: string;
  userId: string;
  source: RevenueSource;
  amount: number;
  currency: string;
  description: string | null;
  platform: string | null;
  postId: string | null;
  brandName: string | null;
  paidAt: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueSummary {
  total: number;
  currency: string;
  bySource: Record<RevenueSource, number>;
  byPlatform: Record<string, number>;
  byMonth: Array<{ month: string; amount: number }>;
  entryCount: number;
  avgPerEntry: number;
  trend: number; // % change from previous period
}

export interface RevenueFilters {
  source?: RevenueSource;
  platform?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateRevenueInput {
  source: RevenueSource;
  amount: number;
  currency?: string;
  description?: string;
  platform?: string;
  postId?: string;
  brandName?: string;
  paidAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateRevenueInput {
  source?: RevenueSource;
  amount?: number;
  currency?: string;
  description?: string | null;
  platform?: string | null;
  postId?: string | null;
  brandName?: string | null;
  paidAt?: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown> | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function decimalToNumber(decimal: Decimal | null): number {
  return decimal ? parseFloat(decimal.toString()) : 0;
}

function toRevenueEntry(dbEntry: {
  id: string;
  userId: string;
  source: string;
  amount: Decimal;
  currency: string;
  description: string | null;
  platform: string | null;
  postId: string | null;
  brandName: string | null;
  paidAt: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): RevenueEntry {
  return {
    id: dbEntry.id,
    userId: dbEntry.userId,
    source: dbEntry.source as RevenueSource,
    amount: decimalToNumber(dbEntry.amount),
    currency: dbEntry.currency,
    description: dbEntry.description,
    platform: dbEntry.platform,
    postId: dbEntry.postId,
    brandName: dbEntry.brandName,
    paidAt: dbEntry.paidAt,
    periodStart: dbEntry.periodStart,
    periodEnd: dbEntry.periodEnd,
    metadata: dbEntry.metadata as Record<string, unknown> | null,
    createdAt: dbEntry.createdAt,
    updatedAt: dbEntry.updatedAt,
  };
}

// =============================================================================
// REVENUE SERVICE CLASS
// =============================================================================

export class RevenueService {
  /**
   * Get revenue entries for a user with optional filters
   */
  async getEntries(userId: string, filters?: RevenueFilters): Promise<RevenueEntry[]> {
    const where: Record<string, unknown> = { userId };

    if (filters?.source) {
      where.source = filters.source;
    }
    if (filters?.platform) {
      where.platform = filters.platform;
    }
    if (filters?.startDate || filters?.endDate) {
      where.paidAt = {};
      if (filters.startDate) {
        (where.paidAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.paidAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const entries = await prisma.revenueEntry.findMany({
      where,
      orderBy: { paidAt: 'desc' },
    });

    return entries.map(toRevenueEntry);
  }

  /**
   * Get revenue summary with aggregations
   */
  async getSummary(userId: string, filters?: RevenueFilters): Promise<RevenueSummary> {
    const entries = await this.getEntries(userId, filters);

    // Calculate totals
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const entryCount = entries.length;
    const avgPerEntry = entryCount > 0 ? total / entryCount : 0;

    // Group by source
    const bySource: Record<RevenueSource, number> = {
      sponsorship: 0,
      affiliate: 0,
      ads: 0,
      tips: 0,
      merchandise: 0,
      other: 0,
    };
    for (const entry of entries) {
      bySource[entry.source] += entry.amount;
    }

    // Group by platform
    const byPlatform: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.platform) {
        byPlatform[entry.platform] = (byPlatform[entry.platform] || 0) + entry.amount;
      }
    }

    // Group by month
    const monthMap = new Map<string, number>();
    for (const entry of entries) {
      const monthKey = entry.paidAt.toISOString().slice(0, 7); // YYYY-MM
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + entry.amount);
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate trend (compare current period to previous)
    const trend = await this.calculateTrend(userId, filters);

    // Determine currency (use most common or default to USD)
    const currencyCounts = new Map<string, number>();
    for (const entry of entries) {
      currencyCounts.set(entry.currency, (currencyCounts.get(entry.currency) || 0) + 1);
    }
    let currency = 'USD';
    let maxCount = 0;
    for (const [curr, count] of currencyCounts.entries()) {
      if (count > maxCount) {
        currency = curr;
        maxCount = count;
      }
    }

    return {
      total: Math.round(total * 100) / 100,
      currency,
      bySource,
      byPlatform,
      byMonth,
      entryCount,
      avgPerEntry: Math.round(avgPerEntry * 100) / 100,
      trend: Math.round(trend * 100) / 100,
    };
  }

  /**
   * Calculate trend percentage comparing current to previous period
   */
  private async calculateTrend(userId: string, filters?: RevenueFilters): Promise<number> {
    const now = new Date();
    const endDate = filters?.endDate || now;
    const startDate = filters?.startDate || new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const periodLength = endDate.getTime() - startDate.getTime();

    // Previous period
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);

    // Get current period total
    const currentEntries = await this.getEntries(userId, {
      ...filters,
      startDate,
      endDate,
    });
    const currentTotal = currentEntries.reduce((sum, e) => sum + e.amount, 0);

    // Get previous period total
    const prevEntries = await this.getEntries(userId, {
      ...filters,
      startDate: prevStart,
      endDate: prevEnd,
    });
    const prevTotal = prevEntries.reduce((sum, e) => sum + e.amount, 0);

    // Calculate percentage change
    if (prevTotal === 0) {
      return currentTotal > 0 ? 100 : 0;
    }
    return ((currentTotal - prevTotal) / prevTotal) * 100;
  }

  /**
   * Get a single entry by ID
   */
  async getEntry(id: string, userId: string): Promise<RevenueEntry | null> {
    const entry = await prisma.revenueEntry.findFirst({
      where: { id, userId },
    });

    return entry ? toRevenueEntry(entry) : null;
  }

  /**
   * Create a new revenue entry
   */
  async createEntry(userId: string, data: CreateRevenueInput): Promise<RevenueEntry> {
    const entry = await prisma.revenueEntry.create({
      data: {
        userId,
        source: data.source,
        amount: data.amount,
        currency: data.currency || 'USD',
        description: data.description || null,
        platform: data.platform || null,
        postId: data.postId || null,
        brandName: data.brandName || null,
        paidAt: data.paidAt,
        periodStart: data.periodStart || null,
        periodEnd: data.periodEnd || null,
        metadata: (data.metadata as object) || undefined,
      },
    });

    return toRevenueEntry(entry);
  }

  /**
   * Update an existing revenue entry
   */
  async updateEntry(
    id: string,
    userId: string,
    data: UpdateRevenueInput
  ): Promise<RevenueEntry> {
    // Verify ownership
    const existing = await prisma.revenueEntry.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Revenue entry not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.source !== undefined) updateData.source = data.source;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.postId !== undefined) updateData.postId = data.postId;
    if (data.brandName !== undefined) updateData.brandName = data.brandName;
    if (data.paidAt !== undefined) updateData.paidAt = data.paidAt;
    if (data.periodStart !== undefined) updateData.periodStart = data.periodStart;
    if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as object;

    const entry = await prisma.revenueEntry.update({
      where: { id },
      data: updateData,
    });

    return toRevenueEntry(entry);
  }

  /**
   * Delete a revenue entry
   */
  async deleteEntry(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await prisma.revenueEntry.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Revenue entry not found');
    }

    await prisma.revenueEntry.delete({
      where: { id },
    });
  }
}

export default RevenueService;
