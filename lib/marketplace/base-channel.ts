/**
 * BaseMarketplaceChannel — Abstract base for all marketplace integrations.
 *
 * Each channel (Shopify, eBay, Facebook Commerce) extends this class and
 * implements the abstract methods. The orchestrator calls these methods
 * without needing to know the channel's internals.
 *
 * UNI-1580 / UNI-1581 / UNI-1582 — Marketplace Phase A1
 */

import type {
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceCredentials,
  MarketplaceSyncResult,
  MarketplaceChannelConfig,
} from './types';

export abstract class BaseMarketplaceChannel {
  protected readonly orgId: string;
  protected credentials: MarketplaceCredentials;

  constructor(orgId: string, credentials: MarketplaceCredentials) {
    this.orgId = orgId;
    this.credentials = credentials;
  }

  // ── Abstract — must implement ─────────────────────────────────────────────

  /** Channel metadata: name, required credential fields, OAuth flag */
  abstract getConfig(): MarketplaceChannelConfig;

  /** Verify credentials are valid (ping the API) */
  abstract validateCredentials(): Promise<{ valid: boolean; error?: string }>;

  /** Fetch all active listings from the channel */
  abstract fetchListings(): Promise<MarketplaceListing[]>;

  /** Push a listing to the channel (create or update) */
  abstract upsertListing(
    listing: Omit<
      MarketplaceListing,
      'channelListingId' | 'createdAt' | 'updatedAt'
    >
  ): Promise<MarketplaceListing>;

  /** Delete a listing from the channel */
  abstract deleteListing(channelListingId: string): Promise<void>;

  /** Fetch recent orders (since a given timestamp) */
  abstract fetchOrders(since?: Date): Promise<MarketplaceOrder[]>;

  /** Update stock quantity for a listing */
  abstract updateStock(
    channelListingId: string,
    quantity: number
  ): Promise<void>;

  // ── Concrete — shared logic with defaults ─────────────────────────────────

  /**
   * Sync all listings to the channel. Returns a summary.
   * Iterates through each listing, calling upsertListing, and collects errors.
   */
  async syncListings(
    listings: Omit<
      MarketplaceListing,
      'channelListingId' | 'createdAt' | 'updatedAt'
    >[]
  ): Promise<MarketplaceSyncResult> {
    const result: MarketplaceSyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const listing of listings) {
      try {
        await this.upsertListing(listing);
        result.synced++;
      } catch (err) {
        result.failed++;
        result.errors.push(
          `SKU ${listing.sku}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /** Health check — returns true if the channel API is reachable */
  async healthCheck(): Promise<boolean> {
    try {
      const { valid } = await this.validateCredentials();
      return valid;
    } catch {
      return false;
    }
  }
}
