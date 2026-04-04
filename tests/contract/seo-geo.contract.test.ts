/**
 * SEO & GEO API Contract Tests
 *
 * Validates SEO audit, GEO analysis, author profile, and research schemas.
 * Covers v1.3 SEO & Search additions.
 *
 * @module tests/contract/seo-geo.contract.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  seoAuditSchema,
  seoAuditResponseSchema,
  geoAnalysisSchema,
  geoAnalysisResponseSchema,
  errorResponseSchema,
} from '@/lib/schemas';

describe('SEO API Contract Tests', () => {
  describe('SEO Audit Schema', () => {
    it('should validate full SEO audit', () => {
      const audit = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://example.com',
        score: 85,
        status: 'completed',
        issues: [
          {
            type: 'meta_description',
            severity: 'warning',
            message: 'Meta description too long',
            recommendation: 'Shorten to under 160 characters',
          },
          {
            type: 'heading_hierarchy',
            severity: 'error',
            message: 'Missing H1 tag',
            recommendation: 'Add a single H1 tag to the page',
          },
        ],
        createdAt: '2025-06-01T00:00:00.000Z',
      };

      const result = seoAuditSchema.safeParse(audit);
      expect(result.success).toBe(true);
    });

    it('should validate audit without issues', () => {
      const audit = {
        id: '2',
        url: 'https://example.com/perfect-page',
        score: 100,
        status: 'completed',
        issues: [],
      };

      const result = seoAuditSchema.safeParse(audit);
      expect(result.success).toBe(true);
    });

    it('should validate minimal audit', () => {
      const audit = { id: '3' };
      const result = seoAuditSchema.safeParse(audit);
      expect(result.success).toBe(true);
    });

    it('should validate score boundary values', () => {
      const auditMin = { id: '4', score: 0 };
      const auditMax = { id: '5', score: 100 };

      expect(seoAuditSchema.safeParse(auditMin).success).toBe(true);
      expect(seoAuditSchema.safeParse(auditMax).success).toBe(true);
    });

    it('should reject score out of range', () => {
      const overMax = { id: '6', score: 101 };
      const underMin = { id: '7', score: -1 };

      expect(seoAuditSchema.safeParse(overMax).success).toBe(false);
      expect(seoAuditSchema.safeParse(underMin).success).toBe(false);
    });
  });

  describe('SEO Audit Response', () => {
    it('should validate single audit response', () => {
      const response = {
        success: true,
        data: {
          id: '1',
          url: 'https://example.com',
          score: 72,
          status: 'completed',
        },
      };

      const result = seoAuditResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate audit list response', () => {
      const response = {
        success: true,
        data: [
          { id: '1', url: 'https://example.com', score: 72 },
          { id: '2', url: 'https://example.com/blog', score: 88 },
        ],
      };

      const result = seoAuditResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('GEO API Contract Tests', () => {
  describe('GEO Analysis Schema', () => {
    it('should validate full GEO analysis', () => {
      const analysis = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        query: 'best marketing automation tools',
        score: 78,
        citability: 85,
        recommendations: [
          'Add more structured data',
          'Include expert quotes',
          'Add comparison tables',
        ],
        createdAt: '2025-06-01T00:00:00.000Z',
      };

      const result = geoAnalysisSchema.safeParse(analysis);
      expect(result.success).toBe(true);
    });

    it('should validate analysis without recommendations', () => {
      const analysis = {
        id: '2',
        query: 'social media management',
        score: 45,
      };

      const result = geoAnalysisSchema.safeParse(analysis);
      expect(result.success).toBe(true);
    });

    it('should validate minimal analysis', () => {
      const analysis = { id: '3' };
      const result = geoAnalysisSchema.safeParse(analysis);
      expect(result.success).toBe(true);
    });
  });

  describe('GEO Analysis Response', () => {
    it('should validate single analysis response', () => {
      const response = {
        success: true,
        data: {
          id: '1',
          query: 'ai content tools',
          score: 82,
          citability: 90,
          recommendations: ['Add citations', 'Use structured data'],
        },
      };

      const result = geoAnalysisResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate analysis list response', () => {
      const response = {
        success: true,
        data: [
          { id: '1', query: 'query 1', score: 72 },
          { id: '2', query: 'query 2', score: 88 },
        ],
      };

      const result = geoAnalysisResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Responses', () => {
    it('should validate SEO error', () => {
      const error = { error: 'URL not accessible', message: 'Could not fetch the page' };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('should validate rate limit error', () => {
      const error = { error: 'Rate limited', code: 'RATE_LIMIT_EXCEEDED' };
      const result = errorResponseSchema.safeParse(error);
      expect(result.success).toBe(true);
    });
  });
});
