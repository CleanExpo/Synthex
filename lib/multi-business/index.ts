/**
 * Multi-Business Owner System
 *
 * Barrel export for all multi-business functionality.
 *
 * OVERVIEW:
 * This module enables enterprise users (multi-business owners) to manage
 * multiple organizations from a single SYNTHEX account. Each organization
 * operates independently with its own subscription, data, and team members.
 *
 * CORE FEATURES:
 * - Business ownership management (create, remove, list)
 * - Organization context switching
 * - Cross-business analytics and KPI aggregation
 * - Automatic data scoping for queries
 * - Per-business billing tracking
 *
 * USAGE EXAMPLE:
 * ```typescript
 * import {
 *   isMultiBusinessOwner,
 *   getOwnedBusinesses,
 *   setActiveOrganization,
 *   getEffectiveQueryFilter
 * } from '@/lib/multi-business';
 *
 * // Check if user is multi-business owner
 * const isOwner = await isMultiBusinessOwner(userId);
 *
 * // Get all owned businesses with stats
 * const businesses = await getOwnedBusinesses(userId, true);
 *
 * // Switch context to specific business
 * await setActiveOrganization(userId, organizationId);
 *
 * // Use in queries to automatically scope data
 * const filter = await getEffectiveQueryFilter(userId);
 * const posts = await prisma.post.findMany({
 *   where: { ...filter, status: 'published' }
 * });
 * ```
 *
 * DATABASE SCHEMA:
 * - User.isMultiBusinessOwner: Boolean flag
 * - User.activeOrganizationId: Current business context
 * - BusinessOwnership: Junction table (ownerId, organizationId)
 * - Organization: Standard org table
 */

// Type exports
export type {
  OwnedBusiness,
  BusinessQuickStats,
  CrossBusinessAggregation,
  CreateBusinessParams,
  EffectiveQueryFilter,
  OwnershipValidation,
} from './types';

// Owner utility exports
export {
  isMultiBusinessOwner,
  getOwnedBusinesses,
  getActiveOrganizationId,
  setActiveOrganization,
  createChildBusiness,
  removeChildBusiness,
  getCrossBusinessStats,
} from './owner-utils';

// Business scope exports
export {
  getEffectiveOrganizationId,
  getEffectiveQueryFilter,
  hasOrganizationAccess,
  getAccessibleOrganizationIds,
} from './business-scope';
