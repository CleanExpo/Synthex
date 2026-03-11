/**
 * Sponsor CRM Types & Constants — Client-safe
 *
 * @description Types and static constants for the Sponsor CRM.
 * No server-only imports (no prisma, no ioredis).
 * The full SponsorService lives in sponsor-service.ts (server-only).
 */

// ============================================================================
// TYPES
// ============================================================================

export type SponsorStatus = 'lead' | 'active' | 'past';
export type DealStage = 'negotiation' | 'contracted' | 'in_progress' | 'delivered' | 'paid' | 'cancelled';
export type DeliverableType = 'post' | 'story' | 'reel' | 'video' | 'mention' | 'review' | 'other';
export type DeliverableStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

// ============================================================================
// CONSTANTS
// ============================================================================

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

// ============================================================================
// INTERFACES
// ============================================================================

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
