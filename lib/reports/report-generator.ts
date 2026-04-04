/**
 * Report Generator Service
 *
 * Generates PDF, CSV, and JSON reports for marketing analytics
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Type definitions for jsPDF (server-side compatible)
interface ReportData {
  summary: {
    title: string;
    dateRange: { start: string; end: string };
    generatedAt: string;
    totalMetrics: number;
  };
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  type: 'metrics' | 'table' | 'chart' | 'text';
  data: Record<string, unknown> | unknown[];
}

// Validation schemas
const GenerateReportSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['campaign', 'analytics', 'ab-test', 'psychology', 'comprehensive']),
  format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  filters: z.object({
    campaignIds: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
  }).optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

export class ReportGenerator {
  /**
   * Generate a report based on type and parameters
   */
  async generateReport(
    userId: string,
    input: GenerateReportInput
  ): Promise<{ reportId: string; status: string }> {
    const validation = GenerateReportSchema.safeParse(input);
    if (!validation.success) {
      throw new Error(`Validation failed: ${validation.error.message}`);
    }

    const { name, type, format, dateRange, filters } = validation.data;

    // Create report record
    const report = await prisma.report.create({
      data: {
        userId,
        name,
        type,
        format,
        status: 'pending',
        dateRange: dateRange ?? Prisma.JsonNull,
        filters: filters ?? Prisma.JsonNull,
      },
    });

    // Start async generation
    this.processReport(report.id, type, format, dateRange, filters).catch(error => {
      console.error('Report generation failed:', error);
      prisma.report.update({
        where: { id: report.id },
        data: { status: 'failed' },
      });
    });

    return { reportId: report.id, status: 'pending' };
  }

  /**
   * Process report generation (async)
   */
  private async processReport(
    reportId: string,
    type: string,
    format: string,
    dateRange?: { start: string; end: string },
    filters?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Update status to generating
      await prisma.report.update({
        where: { id: reportId },
        data: { status: 'generating' },
      });

      // Gather report data based on type
      const reportData = await this.gatherReportData(type, dateRange, filters);

      // Generate file based on format
      let fileContent: string;
      let contentType: string;

      switch (format) {
        case 'csv':
          fileContent = this.generateCSV(reportData);
          contentType = 'text/csv';
          break;
        case 'json':
          fileContent = JSON.stringify(reportData, null, 2);
          contentType = 'application/json';
          break;
        case 'pdf':
        default:
          fileContent = await this.generatePDFContent(reportData);
          contentType = 'application/pdf';
          break;
      }

      // Store report data and update status
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'completed',
          data: reportData as object,
          fileSize: fileContent.length,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch (error) {
      console.error('Report processing error:', error);
      await prisma.report.update({
        where: { id: reportId },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  /**
   * Gather data for report based on type
   */
  private async gatherReportData(
    type: string,
    dateRange?: { start: string; end: string },
    filters?: Record<string, unknown>
  ): Promise<ReportData> {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = dateRange?.start ? new Date(dateRange.start) : defaultStart;
    const end = dateRange?.end ? new Date(dateRange.end) : now;

    const sections: ReportSection[] = [];

    switch (type) {
      case 'campaign':
        sections.push(...await this.gatherCampaignData(start, end, filters));
        break;
      case 'analytics':
        sections.push(...await this.gatherAnalyticsData(start, end, filters));
        break;
      case 'ab-test':
        sections.push(...await this.gatherABTestData(start, end, filters));
        break;
      case 'psychology':
        sections.push(...await this.gatherPsychologyData(start, end, filters));
        break;
      case 'comprehensive':
        sections.push(...await this.gatherCampaignData(start, end, filters));
        sections.push(...await this.gatherAnalyticsData(start, end, filters));
        sections.push(...await this.gatherABTestData(start, end, filters));
        sections.push(...await this.gatherPsychologyData(start, end, filters));
        break;
    }

    return {
      summary: {
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
        generatedAt: now.toISOString(),
        totalMetrics: sections.reduce((sum, s) => sum + (Array.isArray(s.data) ? s.data.length : 1), 0),
      },
      sections,
    };
  }

  /**
   * Gather campaign performance data
   */
  private async gatherCampaignData(
    start: Date,
    end: Date,
    filters?: Record<string, unknown>
  ): Promise<ReportSection[]> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(filters?.campaignIds ? { id: { in: filters.campaignIds as string[] } } : {}),
      },
      include: {
        posts: true,
      },
      take: 100,
    });

    const campaignMetrics = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      platform: c.platform,
      postsCount: c.posts.length,
      createdAt: c.createdAt.toISOString(),
    }));

    const statusBreakdown = campaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      {
        title: 'Campaign Overview',
        type: 'metrics',
        data: {
          totalCampaigns: campaigns.length,
          activeCampaigns: campaigns.filter(c => c.status === 'active').length,
          statusBreakdown,
        },
      },
      {
        title: 'Campaign Details',
        type: 'table',
        data: campaignMetrics,
      },
    ];
  }

  /**
   * Gather analytics event data
   */
  private async gatherAnalyticsData(
    start: Date,
    end: Date,
    filters?: Record<string, unknown>
  ): Promise<ReportSection[]> {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        timestamp: { gte: start, lte: end },
        ...(filters?.platforms ? { platform: { in: filters.platforms as string[] } } : {}),
      },
      take: 1000,
    });

    const eventsByType = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsByPlatform = events.reduce((acc, e) => {
      const platform = e.platform || 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      {
        title: 'Analytics Summary',
        type: 'metrics',
        data: {
          totalEvents: events.length,
          uniqueSessions: new Set(events.map(e => e.sessionId)).size,
          eventsByType,
          eventsByPlatform,
        },
      },
    ];
  }

  /**
   * Gather A/B test data
   */
  private async gatherABTestData(
    start: Date,
    end: Date,
    filters?: Record<string, unknown>
  ): Promise<ReportSection[]> {
    const tests = await prisma.aBTest.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        variants: true,
        results: true,
      },
      take: 50,
    });

    const testSummaries = tests.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      winner: t.winner,
      confidence: t.confidence,
      variantsCount: t.variants.length,
      totalImpressions: t.variants.reduce((sum, v) => sum + v.impressions, 0),
      totalConversions: t.variants.reduce((sum, v) => sum + v.conversions, 0),
    }));

    return [
      {
        title: 'A/B Testing Summary',
        type: 'metrics',
        data: {
          totalTests: tests.length,
          completedTests: tests.filter(t => t.status === 'completed').length,
          averageConfidence: tests.length > 0
            ? tests.reduce((sum, t) => sum + t.confidence, 0) / tests.length
            : 0,
        },
      },
      {
        title: 'Test Details',
        type: 'table',
        data: testSummaries,
      },
    ];
  }

  /**
   * Gather psychology metrics data
   */
  private async gatherPsychologyData(
    start: Date,
    end: Date,
    filters?: Record<string, unknown>
  ): Promise<ReportSection[]> {
    const metrics = await prisma.psychologyMetric.findMany({
      where: {
        testedAt: { gte: start, lte: end },
      },
      take: 200,
    });

    const principleUsage = metrics.reduce((acc, m) => {
      acc[m.principleUsed] = (acc[m.principleUsed] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgMetrics = {
      engagement: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + Number(m.engagementScore), 0) / metrics.length
        : 0,
      conversion: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + Number(m.conversionRate), 0) / metrics.length
        : 0,
      recall: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + Number(m.recallScore), 0) / metrics.length
        : 0,
    };

    return [
      {
        title: 'Psychology Effectiveness',
        type: 'metrics',
        data: {
          totalAnalyses: metrics.length,
          principleUsage,
          averageMetrics: avgMetrics,
        },
      },
    ];
  }

  /**
   * Generate CSV content from report data
   */
  private generateCSV(data: ReportData): string {
    const lines: string[] = [];

    // Header
    lines.push(`"${data.summary.title}"`);
    lines.push(`"Date Range","${data.summary.dateRange.start}","${data.summary.dateRange.end}"`);
    lines.push(`"Generated","${data.summary.generatedAt}"`);
    lines.push('');

    // Sections
    for (const section of data.sections) {
      lines.push(`"${section.title}"`);

      if (Array.isArray(section.data)) {
        if (section.data.length > 0) {
          const headers = Object.keys(section.data[0] as object);
          lines.push(headers.map(h => `"${h}"`).join(','));

          for (const row of section.data) {
            const values = headers.map(h => `"${(row as Record<string, unknown>)[h] || ''}"`);
            lines.push(values.join(','));
          }
        }
      } else {
        for (const [key, value] of Object.entries(section.data)) {
          const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
          lines.push(`"${key}","${valueStr}"`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate PDF-ready content (returns base64 for client-side rendering)
   */
  private async generatePDFContent(data: ReportData): Promise<string> {
    // Since jsPDF requires browser APIs, we return structured data
    // that can be converted to PDF on the client or via a headless browser
    return JSON.stringify({
      type: 'pdf-data',
      version: '1.0',
      content: data,
      instructions: {
        title: data.summary.title,
        orientation: 'portrait',
        format: 'a4',
        sections: data.sections.map(s => ({
          title: s.title,
          type: s.type,
        })),
      },
    });
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string, userId: string): Promise<{
    id: string;
    name: string;
    type: string;
    status: string;
    format: string;
    data: ReportData | null;
    generatedAt: Date | null;
    createdAt: Date;
  } | null> {
    const report = await prisma.report.findFirst({
      where: { id: reportId, userId },
    });

    if (!report) return null;

    return {
      id: report.id,
      name: report.name,
      type: report.type,
      status: report.status,
      format: report.format,
      data: report.data as ReportData | null,
      generatedAt: report.generatedAt,
      createdAt: report.createdAt,
    };
  }

  /**
   * List user's reports
   */
  async listReports(
    userId: string,
    options: { limit?: number; offset?: number; type?: string } = {}
  ): Promise<{
    reports: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      format: string;
      generatedAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const { limit = 20, offset = 0, type } = options;

    const where = {
      userId,
      ...(type ? { type } : {}),
    };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          format: true,
          generatedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.report.count({ where }),
    ]);

    return { reports, total };
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    const result = await prisma.report.deleteMany({
      where: { id: reportId, userId },
    });

    return result.count > 0;
  }
}

// Export singleton instance
export const reportGenerator = new ReportGenerator();
