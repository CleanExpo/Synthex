/**
 * ROI Service
 *
 * @description Calculates return on investment for content creation
 * by tracking time and money investments against revenue.
 *
 * @module lib/roi/roi-service
 */

import { prisma } from '@/lib/prisma';
import { RevenueService } from '@/lib/revenue/revenue-service';
import { Decimal } from '@prisma/client/runtime/library';
import type { CampaignROIWeights } from '@/lib/bayesian/surfaces/campaign-roi';

// =============================================================================
// TYPES
// =============================================================================

export type InvestmentType = 'time' | 'money';
export type InvestmentCategory = 'creation' | 'equipment' | 'software' | 'promotion' | 'other';

export const INVESTMENT_TYPES: InvestmentType[] = ['time', 'money'];
export const INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  'creation',
  'equipment',
  'software',
  'promotion',
  'other',
];

export const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  creation: 'Content Creation',
  equipment: 'Equipment',
  software: 'Software & Tools',
  promotion: 'Promotion & Ads',
  other: 'Other',
};

export interface ContentInvestment {
  id: string;
  userId: string;
  type: InvestmentType;
  category: InvestmentCategory;
  amount: number;
  currency: string | null;
  description: string | null;
  platform: string | null;
  postId: string | null;
  investedAt: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ROIMetrics {
  totalRevenue: number;
  totalMoneyInvested: number;
  totalHoursInvested: number;
  overallROI: number; // percentage
  roiPerHour: number; // revenue per hour
  netProfit: number;
  currency: string;
}

export interface PlatformROI {
  platform: string;
  revenue: number;
  moneyInvested: number;
  hoursInvested: number;
  roi: number;
  roiPerHour: number;
}

export interface ROIReport {
  overall: ROIMetrics;
  byPlatform: PlatformROI[];
  byCategory: Record<InvestmentCategory, number>;
  investmentCount: number;
  generatedAt: string;
}

export interface InvestmentFilters {
  type?: InvestmentType;
  category?: InvestmentCategory;
  platform?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateInvestmentInput {
  type: InvestmentType;
  category: InvestmentCategory;
  amount: number;
  currency?: string;
  description?: string;
  platform?: string;
  postId?: string;
  investedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateInvestmentInput {
  type?: InvestmentType;
  category?: InvestmentCategory;
  amount?: number;
  currency?: string | null;
  description?: string | null;
  platform?: string | null;
  postId?: string | null;
  investedAt?: Date;
  metadata?: Record<string, unknown> | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function decimalToNumber(decimal: Decimal | null): number {
  return decimal ? parseFloat(decimal.toString()) : 0;
}

function toContentInvestment(dbEntry: {
  id: string;
  userId: string;
  type: string;
  category: string;
  amount: Decimal;
  currency: string | null;
  description: string | null;
  platform: string | null;
  postId: string | null;
  investedAt: Date;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ContentInvestment {
  return {
    id: dbEntry.id,
    userId: dbEntry.userId,
    type: dbEntry.type as InvestmentType,
    category: dbEntry.category as InvestmentCategory,
    amount: decimalToNumber(dbEntry.amount),
    currency: dbEntry.currency,
    description: dbEntry.description,
    platform: dbEntry.platform,
    postId: dbEntry.postId,
    investedAt: dbEntry.investedAt,
    metadata: dbEntry.metadata as Record<string, unknown> | null,
    createdAt: dbEntry.createdAt,
    updatedAt: dbEntry.updatedAt,
  };
}

// =============================================================================
// ROI SERVICE CLASS
// =============================================================================

export class ROIService {
  private revenueService: RevenueService;

  constructor() {
    this.revenueService = new RevenueService();
  }

  /**
   * Get investments for a user with optional filters
   */
  async getInvestments(userId: string, filters?: InvestmentFilters): Promise<ContentInvestment[]> {
    const where: Record<string, unknown> = { userId };

    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.platform) {
      where.platform = filters.platform;
    }
    if (filters?.startDate || filters?.endDate) {
      where.investedAt = {};
      if (filters.startDate) {
        (where.investedAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.investedAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const investments = await prisma.contentInvestment.findMany({
      where,
      orderBy: { investedAt: 'desc' },
    });

    return investments.map(toContentInvestment);
  }

  /**
   * Get a single investment by ID
   */
  async getInvestment(id: string, userId: string): Promise<ContentInvestment | null> {
    const investment = await prisma.contentInvestment.findFirst({
      where: { id, userId },
    });

    return investment ? toContentInvestment(investment) : null;
  }

  /**
   * Create a new investment
   */
  async createInvestment(userId: string, data: CreateInvestmentInput): Promise<ContentInvestment> {
    const investment = await prisma.contentInvestment.create({
      data: {
        userId,
        type: data.type,
        category: data.category,
        amount: data.amount,
        currency: data.type === 'money' ? (data.currency || 'USD') : null,
        description: data.description || null,
        platform: data.platform || null,
        postId: data.postId || null,
        investedAt: data.investedAt,
        metadata: (data.metadata as object) || undefined,
      },
    });

    return toContentInvestment(investment);
  }

  /**
   * Update an existing investment
   */
  async updateInvestment(
    id: string,
    userId: string,
    data: UpdateInvestmentInput
  ): Promise<ContentInvestment> {
    // Verify ownership
    const existing = await prisma.contentInvestment.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Investment not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.postId !== undefined) updateData.postId = data.postId;
    if (data.investedAt !== undefined) updateData.investedAt = data.investedAt;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as object;

    const investment = await prisma.contentInvestment.update({
      where: { id },
      data: updateData,
    });

    return toContentInvestment(investment);
  }

  /**
   * Delete an investment
   */
  async deleteInvestment(id: string, userId: string): Promise<void> {
    const existing = await prisma.contentInvestment.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Investment not found');
    }

    await prisma.contentInvestment.delete({
      where: { id },
    });
  }

  // Mapping from platform name (lowercase) to CampaignROIWeights key
  private static readonly PLATFORM_TO_WEIGHT: Record<string, keyof CampaignROIWeights> = {
    youtube:   'youtubeAllocation',
    instagram: 'instagramAllocation',
    tiktok:    'tiktokAllocation',
    twitter:   'twitterAllocation',
    facebook:  'facebookAllocation',
    linkedin:  'linkedinAllocation',
    pinterest: 'pinterestAllocation',
    reddit:    'redditAllocation',
  };

  /**
   * Calculate ROI report.
   * When allocationWeights are provided (via BO), platforms are sorted by
   * roi × allocationWeight descending, surfacing platforms the BO has learned
   * are the highest-value allocation targets.
   */
  async calculateROI(
    userId: string,
    filters?: InvestmentFilters,
    allocationWeights?: CampaignROIWeights,
  ): Promise<ROIReport> {
    // Get investments
    const investments = await this.getInvestments(userId, filters);

    // Get revenue data with same filters
    const revenueSummary = await this.revenueService.getSummary(userId, {
      platform: filters?.platform,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });

    // Calculate total time and money invested
    let totalHoursInvested = 0;
    let totalMoneyInvested = 0;
    const byCategory: Record<InvestmentCategory, number> = {
      creation: 0,
      equipment: 0,
      software: 0,
      promotion: 0,
      other: 0,
    };
    const platformInvestments: Record<string, { money: number; hours: number }> = {};

    for (const inv of investments) {
      if (inv.type === 'time') {
        totalHoursInvested += inv.amount;
      } else {
        totalMoneyInvested += inv.amount;
      }

      byCategory[inv.category] += inv.amount;

      if (inv.platform) {
        if (!platformInvestments[inv.platform]) {
          platformInvestments[inv.platform] = { money: 0, hours: 0 };
        }
        if (inv.type === 'time') {
          platformInvestments[inv.platform].hours += inv.amount;
        } else {
          platformInvestments[inv.platform].money += inv.amount;
        }
      }
    }

    // Calculate overall metrics
    const totalRevenue = revenueSummary.total;
    const netProfit = totalRevenue - totalMoneyInvested;
    const overallROI = totalMoneyInvested > 0
      ? ((totalRevenue - totalMoneyInvested) / totalMoneyInvested) * 100
      : totalRevenue > 0 ? 100 : 0;
    const roiPerHour = totalHoursInvested > 0
      ? totalRevenue / totalHoursInvested
      : 0;

    // Calculate platform ROI
    const byPlatform: PlatformROI[] = [];
    const platformRevenue = revenueSummary.byPlatform;

    // Combine platforms from both revenue and investments
    const allPlatforms = new Set([
      ...Object.keys(platformRevenue),
      ...Object.keys(platformInvestments),
    ]);

    for (const platform of allPlatforms) {
      const revenue = platformRevenue[platform] || 0;
      const investment = platformInvestments[platform] || { money: 0, hours: 0 };

      const platformROI = investment.money > 0
        ? ((revenue - investment.money) / investment.money) * 100
        : revenue > 0 ? 100 : 0;
      const platformRoiPerHour = investment.hours > 0
        ? revenue / investment.hours
        : 0;

      byPlatform.push({
        platform,
        revenue,
        moneyInvested: investment.money,
        hoursInvested: investment.hours,
        roi: Math.round(platformROI * 100) / 100,
        roiPerHour: Math.round(platformRoiPerHour * 100) / 100,
      });
    }

    // Sort by ROI descending, weighted by BO allocation multipliers when available
    byPlatform.sort((a, b) => {
      const wKeyA = ROIService.PLATFORM_TO_WEIGHT[a.platform.toLowerCase()];
      const wKeyB = ROIService.PLATFORM_TO_WEIGHT[b.platform.toLowerCase()];
      const wA = (wKeyA && allocationWeights) ? (allocationWeights[wKeyA] ?? 1.0) : 1.0;
      const wB = (wKeyB && allocationWeights) ? (allocationWeights[wKeyB] ?? 1.0) : 1.0;
      return (b.roi * wB) - (a.roi * wA);
    });

    return {
      overall: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalMoneyInvested: Math.round(totalMoneyInvested * 100) / 100,
        totalHoursInvested: Math.round(totalHoursInvested * 10) / 10,
        overallROI: Math.round(overallROI * 100) / 100,
        roiPerHour: Math.round(roiPerHour * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        currency: revenueSummary.currency,
      },
      byPlatform,
      byCategory,
      investmentCount: investments.length,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default ROIService;
