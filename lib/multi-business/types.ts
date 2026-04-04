/**
 * Multi-Business Owner System - Type Definitions
 *
 * Type definitions for multi-business ownership functionality in SYNTHEX.
 * Enables enterprise users to manage multiple organizations from a single account.
 */

/**
 * Quick statistics for a single business
 */
export interface BusinessQuickStats {
  totalCampaigns: number;
  totalPosts: number;
  activePlatforms: number;
  totalEngagement: number;
}

/**
 * Represents a single business owned by a multi-business owner
 */
export interface OwnedBusiness {
  /** BusinessOwnership ID */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Organization name */
  organizationName: string;
  /** Organization slug (URL-friendly) */
  organizationSlug: string;
  /** Custom display name (optional, fallback to organizationName) */
  displayName: string | null;
  /** Whether this business is currently active */
  isActive: boolean;
  /** Billing status: 'active', 'past_due', 'cancelled' */
  billingStatus: string;
  /** Monthly subscription rate for this business */
  monthlyRate: number;
  /** Quick stats (optional, only included when requested) */
  stats?: BusinessQuickStats;
  /** Created timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Aggregated statistics across all owned businesses
 */
export interface CrossBusinessAggregation {
  /** Total number of businesses owned */
  totalBusinesses: number;
  /** Number of active businesses (isActive=true) */
  activeBusinesses: number;
  /** Total campaigns across all businesses */
  totalCampaigns: number;
  /** Total posts across all businesses */
  totalPosts: number;
  /** Total engagement across all businesses */
  totalEngagement: number;
  /** Total monthly spend (sum of monthlyRate for active businesses) */
  totalMonthlySpend: number;
  /** Individual business data with stats */
  perBusiness: OwnedBusiness[];
}

/**
 * Parameters for creating a new child business
 */
export interface CreateBusinessParams {
  /** Business name (will be used to generate slug) */
  name: string;
  /** Optional display name (defaults to name) */
  displayName?: string;
  /** Monthly rate (defaults to $249) */
  monthlyRate?: number;
}

/**
 * Effective query filter for scoping data queries
 */
export interface EffectiveQueryFilter {
  /** User ID filter (for regular users) */
  userId?: string;
  /** Organization ID filter (for multi-business owners viewing specific org) */
  organizationId?: string;
}

/**
 * Business ownership validation result
 */
export interface OwnershipValidation {
  /** Whether the user owns this business */
  isOwner: boolean;
  /** The BusinessOwnership record if owned */
  ownership?: OwnedBusiness;
  /** Error message if validation failed */
  error?: string;
}
