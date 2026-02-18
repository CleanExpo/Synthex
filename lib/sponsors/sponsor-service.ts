/**
 * Sponsor Service
 *
 * @description Handles sponsor CRM operations including sponsors, deals, and deliverables.
 * Enables creators to manage brand relationships, track deals, and monitor deliverables.
 *
 * @module lib/sponsors/sponsor-service
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// =============================================================================
// TYPES
// =============================================================================

export type SponsorStatus = 'lead' | 'active' | 'past';
export type DealStage = 'negotiation' | 'contracted' | 'in_progress' | 'delivered' | 'paid' | 'cancelled';
export type DeliverableType = 'post' | 'story' | 'reel' | 'video' | 'mention' | 'review' | 'other';
export type DeliverableStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

export const SPONSOR_STATUSES: SponsorStatus[] = ['lead', 'active', 'past'];
export const DEAL_STAGES: DealStage[] = ['negotiation', 'contracted', 'in_progress', 'delivered', 'paid', 'cancelled'];
export const DELIVERABLE_TYPES: DeliverableType[] = ['post', 'story', 'reel', 'video', 'mention', 'review', 'other'];
export const DELIVERABLE_STATUSES: DeliverableStatus[] = ['pending', 'in_progress', 'submitted', 'approved', 'rejected'];

export const STATUS_LABELS: Record<SponsorStatus, string> = {
  lead: 'Lead',
  active: 'Active',
  past: 'Past',
};

export const STAGE_LABELS: Record<DealStage, string> = {
  negotiation: 'Negotiation',
  contracted: 'Contracted',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export const TYPE_LABELS: Record<DeliverableType, string> = {
  post: 'Post',
  story: 'Story',
  reel: 'Reel',
  video: 'Video',
  mention: 'Mention',
  review: 'Review',
  other: 'Other',
};

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

// =============================================================================
// INTERFACES
// =============================================================================

export interface Sponsor {
  id: string;
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo: string | null;
  status: SponsorStatus;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deals?: SponsorDeal[];
}

export interface SponsorDeal {
  id: string;
  sponsorId: string;
  title: string;
  description: string | null;
  value: number;
  currency: string;
  stage: DealStage;
  startDate: Date | null;
  endDate: Date | null;
  paidAt: Date | null;
  revenueEntryId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  sponsor?: Sponsor;
  deliverables?: DealDeliverable[];
}

export interface DealDeliverable {
  id: string;
  dealId: string;
  title: string;
  description: string | null;
  type: DeliverableType;
  platform: string | null;
  status: DeliverableStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  contentUrl: string | null;
  postId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deal?: SponsorDeal;
}

export interface PipelineSummary {
  dealsByStage: Record<DealStage, number>;
  totalValue: number;
  upcomingDeliverables: DealDeliverable[];
  recentDeals: SponsorDeal[];
}

// =============================================================================
// INPUT INTERFACES
// =============================================================================

export interface CreateSponsorInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string;
  status?: SponsorStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSponsorInput {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo?: string | null;
  status?: SponsorStatus;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateDealInput {
  title: string;
  description?: string;
  value: number;
  currency?: string;
  stage?: DealStage;
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateDealInput {
  title?: string;
  description?: string | null;
  value?: number;
  currency?: string;
  stage?: DealStage;
  startDate?: Date | null;
  endDate?: Date | null;
  paidAt?: Date | null;
  revenueEntryId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateDeliverableInput {
  title: string;
  description?: string;
  type: DeliverableType;
  platform?: string;
  status?: DeliverableStatus;
  dueDate?: Date;
  contentUrl?: string;
  postId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDeliverableInput {
  title?: string;
  description?: string | null;
  type?: DeliverableType;
  platform?: string | null;
  status?: DeliverableStatus;
  dueDate?: Date | null;
  completedAt?: Date | null;
  contentUrl?: string | null;
  postId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SponsorFilters {
  status?: SponsorStatus;
}

export interface DealFilters {
  stage?: DealStage;
  sponsorId?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function decimalToNumber(decimal: Decimal | null): number {
  return decimal ? parseFloat(decimal.toString()) : 0;
}

function toSponsor(dbSponsor: {
  id: string;
  userId: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo: string | null;
  status: string;
  notes: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deals?: unknown[];
}): Sponsor {
  return {
    id: dbSponsor.id,
    userId: dbSponsor.userId,
    name: dbSponsor.name,
    company: dbSponsor.company,
    email: dbSponsor.email,
    phone: dbSponsor.phone,
    website: dbSponsor.website,
    logo: dbSponsor.logo,
    status: dbSponsor.status as SponsorStatus,
    notes: dbSponsor.notes,
    metadata: dbSponsor.metadata as Record<string, unknown> | null,
    createdAt: dbSponsor.createdAt,
    updatedAt: dbSponsor.updatedAt,
    deals: dbSponsor.deals ? (dbSponsor.deals as unknown[]).map((d) => toDeal(d as DealDbRecord)) : undefined,
  };
}

type DealDbRecord = {
  id: string;
  sponsorId: string;
  title: string;
  description: string | null;
  value: Decimal;
  currency: string;
  stage: string;
  startDate: Date | null;
  endDate: Date | null;
  paidAt: Date | null;
  revenueEntryId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deliverables?: unknown[];
};

function toDeal(dbDeal: DealDbRecord): SponsorDeal {
  return {
    id: dbDeal.id,
    sponsorId: dbDeal.sponsorId,
    title: dbDeal.title,
    description: dbDeal.description,
    value: decimalToNumber(dbDeal.value),
    currency: dbDeal.currency,
    stage: dbDeal.stage as DealStage,
    startDate: dbDeal.startDate,
    endDate: dbDeal.endDate,
    paidAt: dbDeal.paidAt,
    revenueEntryId: dbDeal.revenueEntryId,
    metadata: dbDeal.metadata as Record<string, unknown> | null,
    createdAt: dbDeal.createdAt,
    updatedAt: dbDeal.updatedAt,
    deliverables: dbDeal.deliverables
      ? (dbDeal.deliverables as unknown[]).map((d) => toDeliverable(d as DeliverableDbRecord))
      : undefined,
  };
}

type DeliverableDbRecord = {
  id: string;
  dealId: string;
  title: string;
  description: string | null;
  type: string;
  platform: string | null;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  contentUrl: string | null;
  postId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toDeliverable(dbDeliverable: DeliverableDbRecord): DealDeliverable {
  return {
    id: dbDeliverable.id,
    dealId: dbDeliverable.dealId,
    title: dbDeliverable.title,
    description: dbDeliverable.description,
    type: dbDeliverable.type as DeliverableType,
    platform: dbDeliverable.platform,
    status: dbDeliverable.status as DeliverableStatus,
    dueDate: dbDeliverable.dueDate,
    completedAt: dbDeliverable.completedAt,
    contentUrl: dbDeliverable.contentUrl,
    postId: dbDeliverable.postId,
    metadata: dbDeliverable.metadata as Record<string, unknown> | null,
    createdAt: dbDeliverable.createdAt,
    updatedAt: dbDeliverable.updatedAt,
  };
}

// =============================================================================
// SPONSOR SERVICE CLASS
// =============================================================================

export class SponsorService {
  // ===========================================================================
  // SPONSORS
  // ===========================================================================

  /**
   * Get sponsors for a user with optional filters
   */
  async getSponsors(userId: string, filters?: SponsorFilters): Promise<Sponsor[]> {
    const where: Record<string, unknown> = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }

    const sponsors = await prisma.sponsor.findMany({
      where,
      include: {
        deals: {
          include: {
            deliverables: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return sponsors.map((s) => toSponsor(s as unknown as Parameters<typeof toSponsor>[0]));
  }

  /**
   * Get a single sponsor by ID
   */
  async getSponsor(id: string, userId: string): Promise<Sponsor | null> {
    const sponsor = await prisma.sponsor.findFirst({
      where: { id, userId },
      include: {
        deals: {
          include: {
            deliverables: true,
          },
        },
      },
    });

    return sponsor ? toSponsor(sponsor as unknown as Parameters<typeof toSponsor>[0]) : null;
  }

  /**
   * Create a new sponsor
   */
  async createSponsor(userId: string, data: CreateSponsorInput): Promise<Sponsor> {
    const sponsor = await prisma.sponsor.create({
      data: {
        userId,
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        logo: data.logo || null,
        status: data.status || 'lead',
        notes: data.notes || null,
        metadata: (data.metadata as object) || undefined,
      },
    });

    return toSponsor(sponsor as unknown as Parameters<typeof toSponsor>[0]);
  }

  /**
   * Update an existing sponsor
   */
  async updateSponsor(id: string, userId: string, data: UpdateSponsorInput): Promise<Sponsor> {
    // Verify ownership
    const existing = await prisma.sponsor.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Sponsor not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as object;

    const sponsor = await prisma.sponsor.update({
      where: { id },
      data: updateData,
    });

    return toSponsor(sponsor as unknown as Parameters<typeof toSponsor>[0]);
  }

  /**
   * Delete a sponsor
   */
  async deleteSponsor(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await prisma.sponsor.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Sponsor not found');
    }

    await prisma.sponsor.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // DEALS
  // ===========================================================================

  /**
   * Get deals for a user with optional filters
   */
  async getDeals(userId: string, filters?: DealFilters): Promise<SponsorDeal[]> {
    const where: Record<string, unknown> = {
      sponsor: { userId },
    };

    if (filters?.stage) {
      where.stage = filters.stage;
    }
    if (filters?.sponsorId) {
      where.sponsorId = filters.sponsorId;
    }

    const deals = await prisma.sponsorDeal.findMany({
      where,
      include: {
        deliverables: true,
        sponsor: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return deals.map((d) => toDeal(d as unknown as DealDbRecord));
  }

  /**
   * Get a single deal by ID
   */
  async getDeal(id: string, userId: string): Promise<SponsorDeal | null> {
    const deal = await prisma.sponsorDeal.findFirst({
      where: {
        id,
        sponsor: { userId },
      },
      include: {
        deliverables: true,
        sponsor: true,
      },
    });

    return deal ? toDeal(deal as unknown as DealDbRecord) : null;
  }

  /**
   * Create a new deal for a sponsor
   */
  async createDeal(userId: string, sponsorId: string, data: CreateDealInput): Promise<SponsorDeal> {
    // Verify sponsor ownership
    const sponsor = await prisma.sponsor.findFirst({
      where: { id: sponsorId, userId },
    });

    if (!sponsor) {
      throw new Error('Sponsor not found');
    }

    const deal = await prisma.sponsorDeal.create({
      data: {
        sponsorId,
        title: data.title,
        description: data.description || null,
        value: data.value,
        currency: data.currency || 'USD',
        stage: data.stage || 'negotiation',
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        metadata: (data.metadata as object) || undefined,
      },
    });

    return toDeal(deal as unknown as DealDbRecord);
  }

  /**
   * Update an existing deal
   */
  async updateDeal(id: string, userId: string, data: UpdateDealInput): Promise<SponsorDeal> {
    // Verify ownership through sponsor
    const existing = await prisma.sponsorDeal.findFirst({
      where: {
        id,
        sponsor: { userId },
      },
    });

    if (!existing) {
      throw new Error('Deal not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.stage !== undefined) updateData.stage = data.stage;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.paidAt !== undefined) updateData.paidAt = data.paidAt;
    if (data.revenueEntryId !== undefined) updateData.revenueEntryId = data.revenueEntryId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as object;

    const deal = await prisma.sponsorDeal.update({
      where: { id },
      data: updateData,
    });

    return toDeal(deal as unknown as DealDbRecord);
  }

  /**
   * Delete a deal
   */
  async deleteDeal(id: string, userId: string): Promise<void> {
    // Verify ownership through sponsor
    const existing = await prisma.sponsorDeal.findFirst({
      where: {
        id,
        sponsor: { userId },
      },
    });

    if (!existing) {
      throw new Error('Deal not found');
    }

    await prisma.sponsorDeal.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // DELIVERABLES
  // ===========================================================================

  /**
   * Get deliverables for a deal
   */
  async getDeliverables(dealId: string, userId: string): Promise<DealDeliverable[]> {
    // Verify deal ownership
    const deal = await prisma.sponsorDeal.findFirst({
      where: {
        id: dealId,
        sponsor: { userId },
      },
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    const deliverables = await prisma.dealDeliverable.findMany({
      where: { dealId },
      orderBy: { dueDate: 'asc' },
    });

    return deliverables.map((d) => toDeliverable(d as unknown as DeliverableDbRecord));
  }

  /**
   * Create a new deliverable for a deal
   */
  async createDeliverable(dealId: string, userId: string, data: CreateDeliverableInput): Promise<DealDeliverable> {
    // Verify deal ownership
    const deal = await prisma.sponsorDeal.findFirst({
      where: {
        id: dealId,
        sponsor: { userId },
      },
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    const deliverable = await prisma.dealDeliverable.create({
      data: {
        dealId,
        title: data.title,
        description: data.description || null,
        type: data.type,
        platform: data.platform || null,
        status: data.status || 'pending',
        dueDate: data.dueDate || null,
        contentUrl: data.contentUrl || null,
        postId: data.postId || null,
        metadata: (data.metadata as object) || undefined,
      },
    });

    return toDeliverable(deliverable as unknown as DeliverableDbRecord);
  }

  /**
   * Update an existing deliverable
   */
  async updateDeliverable(id: string, userId: string, data: UpdateDeliverableInput): Promise<DealDeliverable> {
    // Verify ownership through deal and sponsor
    const existing = await prisma.dealDeliverable.findFirst({
      where: {
        id,
        deal: {
          sponsor: { userId },
        },
      },
    });

    if (!existing) {
      throw new Error('Deliverable not found');
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.contentUrl !== undefined) updateData.contentUrl = data.contentUrl;
    if (data.postId !== undefined) updateData.postId = data.postId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as object;

    const deliverable = await prisma.dealDeliverable.update({
      where: { id },
      data: updateData,
    });

    return toDeliverable(deliverable as unknown as DeliverableDbRecord);
  }

  /**
   * Delete a deliverable
   */
  async deleteDeliverable(id: string, userId: string): Promise<void> {
    // Verify ownership through deal and sponsor
    const existing = await prisma.dealDeliverable.findFirst({
      where: {
        id,
        deal: {
          sponsor: { userId },
        },
      },
    });

    if (!existing) {
      throw new Error('Deliverable not found');
    }

    await prisma.dealDeliverable.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // PIPELINE SUMMARY
  // ===========================================================================

  /**
   * Get pipeline summary with deal counts by stage and upcoming deliverables
   */
  async getPipelineSummary(userId: string): Promise<PipelineSummary> {
    // Get all deals for user
    const deals = await prisma.sponsorDeal.findMany({
      where: {
        sponsor: { userId },
        stage: { not: 'cancelled' },
      },
      include: {
        deliverables: true,
      },
    });

    // Count deals by stage
    const dealsByStage: Record<DealStage, number> = {
      negotiation: 0,
      contracted: 0,
      in_progress: 0,
      delivered: 0,
      paid: 0,
      cancelled: 0,
    };

    let totalValue = 0;

    for (const deal of deals) {
      const stage = deal.stage as DealStage;
      dealsByStage[stage]++;
      // Count active deal value (not cancelled or paid)
      if (!['cancelled', 'paid'].includes(deal.stage)) {
        totalValue += decimalToNumber(deal.value);
      }
    }

    // Get upcoming deliverables (due within 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingDeliverables = await prisma.dealDeliverable.findMany({
      where: {
        deal: {
          sponsor: { userId },
        },
        status: { in: ['pending', 'in_progress'] },
        dueDate: {
          gte: now,
          lte: weekFromNow,
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    // Get recent deals (last 5)
    const recentDeals = await prisma.sponsorDeal.findMany({
      where: {
        sponsor: { userId },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return {
      dealsByStage,
      totalValue: Math.round(totalValue * 100) / 100,
      upcomingDeliverables: upcomingDeliverables.map((d) => toDeliverable(d as unknown as DeliverableDbRecord)),
      recentDeals: recentDeals.map((d) => toDeal(d as unknown as DealDbRecord)),
    };
  }
}

export default SponsorService;
