import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for updates (all fields optional)
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
  category: z.enum(['marketing', 'engagement', 'educational', 'promotional', 'personal']).optional(),
  platforms: z.array(z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads'])).optional(),
  structure: z.object({
    hook: z.string(),
    body: z.string(),
    cta: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    mediaType: z.enum(['image', 'video', 'carousel', 'text']).optional(),
  }).optional(),
  variables: z.array(z.string()).optional(),
  tips: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

/**
 * GET /api/templates/[id]
 * Get a single template by ID
 */
async function handleGet(
  request: AuthenticatedRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  try {
    const { id } = (await context?.params) ?? {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing template ID' },
        { status: 400 }
      );
    }
    const userId = request.userId;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    const template = await prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check access: owner, org member, public, or system
    const hasAccess =
      template.userId === userId ||
      template.isPublic ||
      template.isSystem ||
      (user?.organizationId && template.organizationId === user.organizationId);

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/templates/[id]
 * Update a template (owner only)
 */
async function handlePut(
  request: AuthenticatedRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  try {
    const { id } = (await context?.params) ?? {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing template ID' },
        { status: 400 }
      );
    }
    const userId = request.userId;
    const body = await request.json();

    const validationResult = updateTemplateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check template exists and user owns it
    const existingTemplate = await prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Only owner can update (system templates cannot be updated)
    if (existingTemplate.isSystem) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be modified' },
        { status: 403 }
      );
    }

    if (existingTemplate.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You can only update your own templates' },
        { status: 403 }
      );
    }

    const data = validationResult.data;

    const template = await prisma.promptTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.platforms !== undefined && { platforms: data.platforms }),
        ...(data.structure !== undefined && { structure: data.structure }),
        ...(data.variables !== undefined && { variables: data.variables }),
        ...(data.tips !== undefined && { tips: data.tips }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id]
 * Delete a template (owner only)
 */
async function handleDelete(
  request: AuthenticatedRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  try {
    const { id } = (await context?.params) ?? {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing template ID' },
        { status: 400 }
      );
    }
    const userId = request.userId;

    // Check template exists and user owns it
    const existingTemplate = await prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // System templates cannot be deleted
    if (existingTemplate.isSystem) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be deleted' },
        { status: 403 }
      );
    }

    // Only owner can delete
    if (existingTemplate.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own templates' },
        { status: 403 }
      );
    }

    await prisma.promptTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
