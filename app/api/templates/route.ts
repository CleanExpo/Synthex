import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  category: z.enum(['marketing', 'engagement', 'educational', 'promotional', 'personal']),
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads'])),
  structure: z.object({
    hook: z.string(),
    body: z.string(),
    cta: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    mediaType: z.enum(['image', 'video', 'carousel', 'text']).optional(),
  }),
  variables: z.array(z.string()).optional().default([]),
  tips: z.array(z.string()).optional().default([]),
});

const listQuerySchema = z.object({
  category: z.enum(['marketing', 'engagement', 'educational', 'promotional', 'personal']).optional(),
  platform: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /api/templates
 * List templates (user's + public + system)
 */
async function handleGet(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = listQuerySchema.safeParse({
      category: searchParams.get('category') || undefined,
      platform: searchParams.get('platform') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: queryResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { category, platform, search, limit, offset } = queryResult.data;
    const userId = request.userId;

    // Get user's organization if any
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // Build where clause
    const where: Record<string, unknown> = {
      OR: [
        { userId }, // User's own templates
        { isPublic: true }, // Public templates
        { isSystem: true }, // System templates
        ...(user?.organizationId ? [{ organizationId: user.organizationId }] : []), // Org templates
      ],
    };

    // Apply filters
    if (category) {
      where.category = category;
    }

    if (platform) {
      where.platforms = { has: platform };
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Execute queries
    const [templates, total] = await Promise.all([
      prisma.promptTemplate.findMany({
        where,
        orderBy: [
          { isSystem: 'desc' }, // System templates first
          { usageCount: 'desc' }, // Then by popularity
          { createdAt: 'desc' }, // Then by newest
        ],
        skip: offset,
        take: limit,
      }),
      prisma.promptTemplate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      templates,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Create a new user template
 */
async function handlePost(request: AuthenticatedRequest) {
  try {
    const body = await request.json();

    const validationResult = createTemplateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const userId = request.userId;
    const data = validationResult.data;

    // Get user's organization if any
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    const template = await prisma.promptTemplate.create({
      data: {
        userId,
        organizationId: user?.organizationId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        category: data.category,
        platforms: data.platforms,
        structure: data.structure,
        variables: data.variables,
        tips: data.tips,
        isPublic: false,
        isSystem: false,
      },
    });

    return NextResponse.json({
      success: true,
      template,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
