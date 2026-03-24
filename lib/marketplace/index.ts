/**
 * Marketplace module — public exports
 *
 * Import types and the base class from here; channel implementations will
 * also be re-exported here as they are built (UNI-1580 Shopify, UNI-1582 eBay,
 * UNI-1581 Facebook Commerce).
 *
 * UNI-1580 / UNI-1581 / UNI-1582 — Marketplace Phase A1
 */

export type {
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceOrderLineItem,
  MarketplaceAddress,
  MarketplaceCredentials,
  MarketplaceSyncResult,
  MarketplaceChannelConfig,
} from './types';

export { BaseMarketplaceChannel } from './base-channel';

// Channel IDs — extend this as new channels are added
export const MARKETPLACE_CHANNELS = ['shopify', 'ebay', 'facebook'] as const;
export type MarketplaceChannelId = (typeof MARKETPLACE_CHANNELS)[number];
