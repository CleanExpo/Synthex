/**
 * Report Templates API Route
 *
 * @description Manages report templates for reusable configurations:
 * - GET: List templates (system + user)
 * - POST: Create custom template
 * - PATCH: Update template
 * - DELETE: Delete template
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 on database errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Report template database record */
interface ReportTemplateRecord {
  id: string;
  userId: string | null;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  category: string;
  reportType: string;
  metrics: string[];
  dimensions?: string[] | null;
  filters?: unknown; // JsonValue from Prisma
  visualizations?: unknown; // JsonValue from Prisma
  layout?: unknown; // JsonValue from Prisma
  branding?: unknown; // JsonValue from Prisma
  isPublic: boolean;
  isSystem: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Template query where clause */
interface TemplateWhereClause {
  OR?: Array<{ userId?: string; organizationId?: string | null; isPublic?: boolean }>;
  category?: string;
}

/** Extended Prisma client with report template model */
interface ExtendedPrismaClient {
  reportTemplate?: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<ReportTemplateRecord | null>;
    findUnique: (args: { where: { id: string } }) => Promise<ReportTemplateRecord | null>;
    findMany: (args: { where: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number }) => Promise<ReportTemplateRecord[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<ReportTemplateRecord>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<ReportTemplateRecord>;
    delete: (args: { where: { id: string } }) => Promise<void>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
}

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['performance', 'engagement', 'growth', 'content', 'custom']),
  reportType: z.enum(['overview', 'engagement', 'content', 'audience', 'campaigns', 'growth', 'custom']),
  metrics: z.array(z.string()).min(1),
  dimensions: z.array(z.string()).optional(),
  filters: z.record(z.unknown()).optional(),
  visualizations: z.array(z.object({
    type: z.enum(['line', 'bar', 'pie', 'area', 'table', 'metric', 'heatmap']),
    title: z.string(),
    metrics: z.array(z.string()),
    dimensions: z.array(z.string()).optional(),
  })).optional(),
  layout: z.object({
    columns: z.number().min(1).max(4).optional(),
    sections: z.array(z.object({
      title: z.string(),
      components: z.array(z.string()),
    })).optional(),
  }).optional(),
  branding: z.object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    fontFamily: z.string().optional(),
  }).optional(),
  isPublic: z.boolean().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

// ============================================================================
// SYSTEM TEMPLATES
// ============================================================================

const SYSTEM_TEMPLATES = [
  {
    id: 'system-weekly-overview',
    name: 'Weekly Performance Overview',
    description: 'Comprehensive weekly summary of all platform performance metrics',
    category: 'performance',
    reportType: 'overview',
    metrics: ['impressions', 'engagements', 'followers', 'reach', 'engagement_rate'],
    dimensions: ['platform', 'day'],
    visualizations: [
      { type: 'line', title: 'Daily Performance', metrics: ['impressions', 'engagements'], dimensions: ['day'] },
      { type: 'bar', title: 'Platform Comparison', metrics: ['followers', 'reach'], dimensions: ['platform'] },
      { type: 'metric', title: 'Key Metrics', metrics: ['engagement_rate'], dimensions: [] },
    ],
    isSystem: true,
    isPublic: true,
  },
  {
    id: 'system-monthly-engagement',
    name: 'Monthly Engagement Report',
    description: 'Deep dive into audience engagement patterns and trends',
    category: 'engagement',
    reportType: 'engagement',
    metrics: ['likes', 'comments', 'shares', 'saves', 'engagement_rate', 'avg_response_time'],
    dimensions: ['platform', 'content_type', 'week'],
    visualizations: [
      { type: 'area', title: 'Engagement Trend', metrics: ['likes', 'comments', 'shares'], dimensions: ['week'] },
      { type: 'pie', title: 'Engagement by Type', metrics: ['likes', 'comments', 'shares'], dimensions: [] },
      { type: 'heatmap', title: 'Best Posting Times', metrics: ['engagement_rate'], dimensions: ['day', 'hour'] },
    ],
    isSystem: true,
    isPublic: true,
  },
  {
    id: 'system-content-performance',
    name: 'Content Performance Analysis',
    description: 'Analyze which content types and topics perform best',
    category: 'content',
    reportType: 'content',
    metrics: ['impressions', 'engagements', 'clicks', 'saves', 'shares'],
    dimensions: ['content_type', 'topic', 'platform'],
    visualizations: [
      { type: 'bar', title: 'Top Performing Content', metrics: ['engagements'], dimensions: ['content_type'] },
      { type: 'table', title: 'Content Details', metrics: ['impressions', 'engagements', 'clicks'], dimensions: ['title'] },
    ],
    isSystem: true,
    isPublic: true,
  },
  {
    id: 'system-audience-growth',
    name: 'Audience Growth Report',
    description: 'Track follower growth and audience demographics over time',
    category: 'growth',
    reportType: 'audience',
    metrics: ['followers', 'new_followers', 'unfollows', 'net_growth', 'growth_rate'],
    dimensions: ['platform', 'week', 'source'],
    visualizations: [
      { type: 'line', title: 'Follower Growth', metrics: ['followers', 'new_followers'], dimensions: ['week'] },
      { type: 'bar', title: 'Growth by Platform', metrics: ['net_growth'], dimensions: ['platform'] },
    ],
    isSystem: true,
    isPublic: true,
  },
  {
    id: 'system-campaign-roi',
    name: 'Campaign ROI Report',
    description: 'Measure campaign performance and return on investment',
    category: 'performance',
    reportType: 'campaigns',
    metrics: ['impressions', 'clicks', 'conversions', 'revenue', 'cost', 'roi', 'cpc', 'cpm'],
    dimensions: ['campaign', 'platform', 'ad_set'],
    visualizations: [
      { type: 'bar', title: 'Campaign Performance', metrics: ['impressions', 'clicks', 'conversions'], dimensions: ['campaign'] },
      { type: 'metric', title: 'ROI Summary', metrics: ['roi', 'revenue', 'cost'], dimensions: [] },
      { type: 'table', title: 'Campaign Details', metrics: ['impressions', 'clicks', 'cpc', 'roi'], dimensions: ['campaign'] },
    ],
    isSystem: true,
    isPublic: true,
  },
];

// ============================================================================
// GET /api/reports/templates
// List available templates
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const includeSystem = searchParams.get('includeSystem') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // Build query for user/org templates
    const where: TemplateWhereClause = {
      OR: [
        { userId },
        { organizationId: user?.organizationId, isPublic: true },
      ],
    };

    if (category) {
      where.category = category;
    }

    // Fetch custom templates
    const [customTemplates, total] = await Promise.all([
      extendedPrisma.reportTemplate?.findMany({
        where,
        orderBy: { usageCount: 'desc' },
        take: limit,
        skip: offset,
      }) || [],
      extendedPrisma.reportTemplate?.count({ where }) || 0,
    ]);

    // Combine with system templates if requested
    let templates: Array<ReportTemplateRecord | typeof SYSTEM_TEMPLATES[number]> = customTemplates || [];
    if (includeSystem && offset === 0) {
      const filteredSystem = category
        ? SYSTEM_TEMPLATES.filter(t => t.category === category)
        : SYSTEM_TEMPLATES;
      templates = [...filteredSystem, ...templates];
    }

    return NextResponse.json({
      templates,
      total: total + (includeSystem ? SYSTEM_TEMPLATES.length : 0),
      hasMore: (customTemplates?.length || 0) === limit,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/reports/templates
// Create a new template
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const body = await request.json();

    // Validate input
    const validation = createTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // Create template
    const template = await extendedPrisma.reportTemplate?.create({
      data: {
        userId,
        organizationId: user?.organizationId,
        name: data.name,
        description: data.description,
        category: data.category,
        reportType: data.reportType,
        metrics: data.metrics,
        dimensions: data.dimensions || [],
        filters: data.filters,
        visualizations: data.visualizations,
        layout: data.layout,
        branding: data.branding,
        isPublic: data.isPublic || false,
        isSystem: false,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'report.template.create',
        resource: 'report_template',
        resourceId: template?.id,
        category: 'data',
        outcome: 'success',
        details: { name: data.name, category: data.category },
      },
    });

    return NextResponse.json({
      template,
      created: true,
    });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/reports/templates
// Update a template
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Check if it's a system template
    if (templateId.startsWith('system-')) {
      return NextResponse.json(
        { error: 'System templates cannot be modified' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await extendedPrisma.reportTemplate?.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to update this template' },
        { status: 403 }
      );
    }

    // Update
    const template = await extendedPrisma.reportTemplate?.update({
      where: { id: templateId },
      data: {
        ...validation.data,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      template,
      updated: true,
    });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/reports/templates
// Delete a template
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const userId = security.context.userId!;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Check if it's a system template
    if (templateId.startsWith('system-')) {
      return NextResponse.json(
        { error: 'System templates cannot be deleted' },
        { status: 403 }
      );
    }

    // Verify ownership
    const existing = await extendedPrisma.reportTemplate?.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this template' },
        { status: 403 }
      );
    }

    // Delete
    await extendedPrisma.reportTemplate?.delete({
      where: { id: templateId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'report.template.delete',
        resource: 'report_template',
        resourceId: templateId,
        category: 'data',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
