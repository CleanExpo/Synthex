/**
 * Monetization API Contract Tests
 *
 * Validates revenue, sponsors, affiliates, and billing schemas.
 * Covers v1.4 Creator Monetization additions.
 *
 * @module tests/contract/monetization.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  revenueEntrySchema,
  sponsorSchema,
  affiliateSchema,
  revenueResponseSchema,
  sponsorResponseSchema,
  affiliateResponseSchema,
  errorResponseSchema,
} from '@/lib/schemas';

describe('Monetization API Contract Tests', () => {
  describe('Revenue Entry Schema', () => {
    it('should validate revenue entry with number amount', () => {
      const entry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        amount: 1500.50,
        currency: 'USD',
        source: 'sponsorship',
        platform: 'youtube',
        date: '2025-06-15T00:00:00.000Z',
        status: 'completed',
      };

      const result = revenueEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should validate revenue entry with string amount (Decimal)', () => {
      const entry = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        amount: '2500.00',
        currency: 'USD',
        source: 'affiliate',
      };

      const result = revenueEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should validate minimal revenue entry', () => {
      const entry = {
        id: '1',
        amount: 0,
      };

      const result = revenueEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });
  });

  describe('Sponsor Schema', () => {
    it('should validate full sponsor record', () => {
      const sponsor = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Acme Corp',
        contactEmail: 'sponsor@acme.com',
        status: 'active',
        totalDeals: 3,
        totalRevenue: 15000.00,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const result = sponsorSchema.safeParse(sponsor);
      expect(result.success).toBe(true);
    });

    it('should validate sponsor with Decimal revenue', () => {
      const sponsor = {
        id: '2',
        name: 'BigBrand Inc',
        totalRevenue: '25000.50',
        status: 'prospect',
      };

      const result = sponsorSchema.safeParse(sponsor);
      expect(result.success).toBe(true);
    });

    it('should validate sponsor without optional fields', () => {
      const sponsor = {
        id: '3',
        name: 'New Sponsor',
      };

      const result = sponsorSchema.safeParse(sponsor);
      expect(result.success).toBe(true);
    });

    it('should reject sponsor without name', () => {
      const invalid = { id: '4' };
      const result = sponsorSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Affiliate Schema', () => {
    it('should validate full affiliate link', () => {
      const affiliate = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Product Promo',
        shortCode: 'promo2025',
        destinationUrl: 'https://example.com/product?ref=synthex',
        clicks: 1500,
        conversions: 75,
        revenue: 3750.00,
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const result = affiliateSchema.safeParse(affiliate);
      expect(result.success).toBe(true);
    });

    it('should validate affiliate with zero stats', () => {
      const affiliate = {
        id: '2',
        name: 'New Link',
        shortCode: 'new2025',
        clicks: 0,
        conversions: 0,
        revenue: 0,
        isActive: true,
      };

      const result = affiliateSchema.safeParse(affiliate);
      expect(result.success).toBe(true);
    });

    it('should validate inactive affiliate', () => {
      const affiliate = {
        id: '3',
        isActive: false,
      };

      const result = affiliateSchema.safeParse(affiliate);
      expect(result.success).toBe(true);
    });
  });

  describe('Revenue List Response', () => {
    it('should validate paginated revenue response', () => {
      const response = {
        success: true,
        data: [
          { id: '1', amount: 500, source: 'sponsorship', date: '2025-01-15' },
          { id: '2', amount: '1200.50', source: 'affiliate', date: '2025-01-20' },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      const result = revenueResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty revenue response', () => {
      const response = {
        success: true,
        data: [],
      };

      const result = revenueResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Sponsor List Response', () => {
    it('should validate paginated sponsor response', () => {
      const response = {
        success: true,
        data: [
          { id: '1', name: 'Sponsor A', status: 'active', totalDeals: 2 },
          { id: '2', name: 'Sponsor B', status: 'prospect' },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      const result = sponsorResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Affiliate List Response', () => {
    it('should validate paginated affiliate response', () => {
      const response = {
        success: true,
        data: [
          { id: '1', name: 'Link A', shortCode: 'linkA', clicks: 100, isActive: true },
          { id: '2', name: 'Link B', shortCode: 'linkB', clicks: 50, isActive: false },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      const result = affiliateResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Responses', () => {
    it('should validate payment error', () => {
      const error = { error: 'Payment failed', message: 'Card declined' };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate subscription error', () => {
      const error = { error: 'Subscription required', code: 'SUBSCRIPTION_NEEDED' };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });
});
