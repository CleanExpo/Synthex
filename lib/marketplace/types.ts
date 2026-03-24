/**
 * Marketplace Types
 *
 * Core type definitions shared across all marketplace channel integrations.
 * All channels (Shopify, eBay, Facebook Commerce) use these types.
 *
 * UNI-1580 / UNI-1581 / UNI-1582 — Marketplace Phase A1
 */

// Core product listing type — shared across all channels
export interface MarketplaceListing {
  id: string;
  channelListingId: string; // platform-specific ID
  sku: string;
  title: string;
  description: string;
  price: number; // in cents
  currency: string;
  stockQuantity: number;
  status: 'active' | 'inactive' | 'sold_out' | 'deleted';
  images: string[];
  categories: string[];
  attributes: Record<string, string>;
  channelData: Record<string, unknown>; // platform-specific metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceOrder {
  id: string;
  channelOrderId: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: MarketplaceAddress;
  };
  lineItems: MarketplaceOrderLineItem[];
  totalCents: number;
  currency: string;
  shippingCents: number;
  taxCents: number;
  channelData: Record<string, unknown>;
  placedAt: Date;
  updatedAt: Date;
}

export interface MarketplaceOrderLineItem {
  listingId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface MarketplaceAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string; // ISO 3166-1 alpha-2
}

export interface MarketplaceCredentials {
  [key: string]: string; // channel-specific credential bag
}

export interface MarketplaceSyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface MarketplaceChannelConfig {
  channelId: string; // e.g. 'shopify', 'ebay', 'facebook'
  displayName: string;
  oauthRequired: boolean;
  credentialFields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url';
    required: boolean;
    helpText?: string;
  }[];
}
