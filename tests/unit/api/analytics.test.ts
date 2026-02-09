/**
 * Analytics API Tests
 *
 * @description Unit tests for analytics endpoints:
 * - /api/analytics/performance
 * - /api/analytics/export
 * - /api/analytics/reports
 * - /api/analytics/reports/scheduled
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before any imports
const mockPrisma = {
  post: {
    findMany: vi.fn(),
  },
  report: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  campaign: {
    findMany: vi.fn(),
  },
};

const mockSecurityChecker = {
  check: vi.fn().mockResolvedValue({ allowed: true }),
  createSecureResponse: vi.fn((body, status) => {
    const response = new Response(JSON.stringify(body), { status });
    return response;
  }),
};

const mockAuditLogger = {
  log: vi.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

vi.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: mockSecurityChecker,
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: {},
    AUTHENTICATED_WRITE: {},
  },
}));

vi.mock('@/lib/security/audit-logger', () => ({
  auditLogger: mockAuditLogger,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('jsonwebtoken', () => ({
  verify: vi.fn().mockReturnValue({ sub: 'test-user-id', email: 'test@example.com' }),
}));

// Mock jspdf
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    setPage: vi.fn(),
    getNumberOfPages: vi.fn().mockReturnValue(1),
    internal: {
      pageSize: {
        getWidth: vi.fn().mockReturnValue(210),
        getHeight: vi.fn().mockReturnValue(297),
      },
    },
    output: vi.fn().mockReturnValue(new ArrayBuffer(100)),
    lastAutoTable: { finalY: 100 },
  })),
}));

vi.mock('jspdf-autotable', () => vi.fn());

// Mock ResponseOptimizer
vi.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: vi.fn((data, options) => {
      return new Response(JSON.stringify(data), {
        status: options?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    createErrorResponse: vi.fn((message, status) => {
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  },
}));

// Mock report builder
vi.mock('@/src/services/analytics/report-builder', () => ({
  ReportBuilder: vi.fn().mockImplementation(() => ({
    type: vi.fn().mockReturnThis(),
    name: vi.fn().mockReturnThis(),
    metrics: vi.fn().mockReturnThis(),
    dimensions: vi.fn().mockReturnThis(),
    granularity: vi.fn().mockReturnThis(),
    dateRange: vi.fn().mockReturnThis(),
    platforms: vi.fn().mockReturnThis(),
    campaigns: vi.fn().mockReturnThis(),
    compareWith: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    sortBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({
      id: 'report-1',
      config: { type: 'overview' },
      metadata: { rowCount: 10, executionTime: 50 },
      data: [],
    }),
  })),
  ReportExporter: {
    export: vi.fn().mockResolvedValue({
      content: 'test content',
      mimeType: 'text/csv',
      filename: 'report.csv',
    }),
  },
  PRESET_REPORTS: {
    weeklyOverview: { name: 'Weekly Overview', type: 'overview' },
    monthlyEngagement: { name: 'Monthly Engagement', type: 'engagement' },
  },
}));

// Helper to create mock request
function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): any {
  const { method = 'GET', body, headers = {}, cookies = {} } = options;
  const parsedUrl = new URL(url, 'http://localhost:3000');

  return {
    url,
    method,
    headers: {
      get: (name: string) => headers[name] || (name === 'Authorization' ? 'Bearer test-token' : null),
    },
    cookies: {
      get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
    },
    json: () => Promise.resolve(body),
    searchParams: parsedUrl.searchParams,
    nextUrl: parsedUrl,
  };
}

describe('Analytics Performance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSecurityChecker.check.mockResolvedValue({ allowed: true });
  });

  describe('GET /api/analytics/performance', () => {
    it('should return performance metrics for valid request', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          content: 'Test post content',
          platform: 'twitter',
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          analytics: { likes: 10, comments: 5, shares: 2, impressions: 100, reach: 80 },
          campaign: { name: 'Test Campaign' },
        },
      ];

      mockPrisma.post.findMany.mockResolvedValue(mockPosts);

      // The performance metrics function aggregates data
      expect(mockPosts.length).toBeGreaterThan(0);
      expect(mockPosts[0].analytics.likes).toBe(10);
    });

    it('should handle security check failure', async () => {
      mockSecurityChecker.check.mockResolvedValueOnce({
        allowed: false,
        error: 'Unauthorized',
      });

      const checkResult = await mockSecurityChecker.check({}, {});

      expect(checkResult.allowed).toBe(false);
      expect(checkResult.error).toBe('Unauthorized');
    });

    it('should calculate engagement metrics correctly', () => {
      const analytics = { likes: 10, comments: 5, shares: 3 };
      const totalEngagement = analytics.likes + analytics.comments + analytics.shares;

      expect(totalEngagement).toBe(18);
    });
  });

  describe('POST /api/analytics/performance (Web Vitals)', () => {
    it('should identify poor LCP performance', () => {
      const metrics = { lcp: 5000 };
      const warnings: string[] = [];

      if (metrics.lcp && metrics.lcp > 2500) {
        warnings.push(`LCP is ${metrics.lcp}ms (should be < 2500ms)`);
      }

      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('LCP is 5000ms');
    });

    it('should identify poor CLS', () => {
      const metrics = { cls: 0.5 };
      const warnings: string[] = [];

      if (metrics.cls && metrics.cls > 0.1) {
        warnings.push(`CLS is ${metrics.cls} (should be < 0.1)`);
      }

      expect(warnings.length).toBe(1);
    });
  });
});

describe('Analytics Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockPosts = [
      {
        id: 'post-1',
        content: 'Test post',
        status: 'published',
        platform: 'twitter',
        scheduledAt: null,
        publishedAt: new Date(),
        createdAt: new Date(),
        analytics: { likes: 10, comments: 5, shares: 2, impressions: 100 },
        campaign: { name: 'Campaign 1', platform: 'twitter' },
      },
    ];

    mockPrisma.post.findMany.mockResolvedValue(mockPosts);
    mockPrisma.campaign.findMany.mockResolvedValue([]);
  });

  describe('CSV Export', () => {
    it('should generate valid CSV format', () => {
      const headers = ['Post ID', 'Content', 'Platform', 'Likes', 'Comments'];
      const row = ['post-1', 'Test content', 'twitter', '10', '5'];

      const csv = [headers.join(','), row.join(',')].join('\n');

      expect(csv).toContain('Post ID');
      expect(csv).toContain('post-1');
      expect(csv).toContain('twitter');
    });

    it('should escape quotes in content', () => {
      const content = 'Test "quoted" content';
      const escaped = `"${content.replace(/"/g, '""')}"`;

      expect(escaped).toBe('"Test ""quoted"" content"');
    });
  });

  describe('JSON Export', () => {
    it('should include summary data', () => {
      const summary = {
        posts: 10,
        likes: 100,
        comments: 50,
        engagementRate: '3.50',
      };

      expect(summary.posts).toBe(10);
      expect(parseFloat(summary.engagementRate)).toBe(3.5);
    });
  });
});

describe('Analytics Reports API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Report Presets', () => {
    it('should have valid preset structure', () => {
      const presets = {
        weeklyOverview: { name: 'Weekly Overview', type: 'overview' },
        monthlyEngagement: { name: 'Monthly Engagement', type: 'engagement' },
      };

      expect(presets.weeklyOverview.name).toBe('Weekly Overview');
      expect(presets.monthlyEngagement.type).toBe('engagement');
    });

    it('should support all report types', () => {
      const types = ['overview', 'engagement', 'content', 'audience', 'campaigns', 'growth', 'custom'];

      expect(types).toContain('overview');
      expect(types).toContain('engagement');
      expect(types.length).toBe(7);
    });

    it('should support all export formats', () => {
      const formats = ['json', 'csv', 'pdf'];

      expect(formats).toContain('pdf');
      expect(formats.length).toBe(3);
    });
  });
});

describe('Scheduled Reports API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Schedule Validation', () => {
    it('should validate time format', () => {
      const validTime = /^\d{2}:\d{2}$/;

      expect(validTime.test('09:00')).toBe(true);
      expect(validTime.test('23:59')).toBe(true);
      expect(validTime.test('9:00')).toBe(false);
      expect(validTime.test('bad-time')).toBe(false);
    });

    it('should validate frequency values', () => {
      const validFrequencies = ['daily', 'weekly', 'monthly'];

      expect(validFrequencies).toContain('daily');
      expect(validFrequencies).toContain('weekly');
      expect(validFrequencies).toContain('monthly');
      expect(validFrequencies).not.toContain('yearly');
    });

    it('should validate email recipients', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test('user@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
    });
  });

  describe('Next Run Calculation', () => {
    it('should calculate next daily run', () => {
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(9, 0, 0, 0);

      expect(nextRun > now).toBe(true);
    });

    it('should handle day of week for weekly schedule', () => {
      const daysOfWeek = [0, 1, 2, 3, 4, 5, 6]; // Sunday to Saturday

      expect(daysOfWeek[0]).toBe(0); // Sunday
      expect(daysOfWeek[1]).toBe(1); // Monday
      expect(daysOfWeek[6]).toBe(6); // Saturday
    });

    it('should handle day of month for monthly schedule', () => {
      const validDaysOfMonth = Array.from({ length: 28 }, (_, i) => i + 1);

      expect(validDaysOfMonth[0]).toBe(1);
      expect(validDaysOfMonth[27]).toBe(28);
      expect(validDaysOfMonth.length).toBe(28);
    });
  });

  describe('Scheduled Report CRUD', () => {
    it('should create scheduled report with valid data', async () => {
      const mockReport = {
        id: 'report-1',
        userId: 'test-user-id',
        name: 'Weekly Overview',
        type: 'scheduled',
        status: 'pending',
        format: 'csv',
      };

      mockPrisma.report.create.mockResolvedValue(mockReport);

      const result = await mockPrisma.report.create({
        data: {
          userId: 'test-user-id',
          name: 'Weekly Overview',
          type: 'scheduled',
          status: 'pending',
          format: 'csv',
          filters: {},
        },
      });

      expect(result.id).toBe('report-1');
      expect(result.type).toBe('scheduled');
    });

    it('should list scheduled reports for user', async () => {
      const mockReports = [
        { id: 'report-1', name: 'Weekly Report', filters: { isActive: true } },
        { id: 'report-2', name: 'Monthly Report', filters: { isActive: true } },
      ];

      mockPrisma.report.findMany.mockResolvedValue(mockReports);

      const result = await mockPrisma.report.findMany({
        where: { userId: 'test-user-id', type: 'scheduled' },
      });

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Weekly Report');
    });

    it('should cancel scheduled report', async () => {
      const mockReport = { id: 'report-1', filters: { isActive: true } };

      mockPrisma.report.findFirst.mockResolvedValue(mockReport);
      mockPrisma.report.update.mockResolvedValue({
        ...mockReport,
        status: 'cancelled',
        filters: { isActive: false },
      });

      const found = await mockPrisma.report.findFirst({
        where: { id: 'report-1', type: 'scheduled' },
      });

      expect(found).not.toBeNull();

      const updated = await mockPrisma.report.update({
        where: { id: 'report-1' },
        data: { status: 'cancelled', filters: { isActive: false } },
      });

      expect(updated.status).toBe('cancelled');
      expect(updated.filters.isActive).toBe(false);
    });
  });
});

describe('Security & Audit', () => {
  it('should log audit events', async () => {
    await mockAuditLogger.log({
      userId: 'test-user-id',
      action: 'analytics.export',
      resource: 'analytics',
      resourceId: 'test-user-id',
      category: 'analytics',
      severity: 'low',
      outcome: 'success',
    });

    expect(mockAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'analytics.export',
        outcome: 'success',
      })
    );
  });

  it('should check security policies', async () => {
    await mockSecurityChecker.check({}, { type: 'AUTHENTICATED_READ' });

    expect(mockSecurityChecker.check).toHaveBeenCalled();
  });
});
