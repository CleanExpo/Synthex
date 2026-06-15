/**
 * Tasks Bulk Operations API
 *
 * Bulk update and delete operations for tasks.
 *
 * @module app/api/tasks/bulk/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

const bulkUpdateSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  updates: z.object({
    status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    category: z.string().max(50).optional(),
    assigneeId: z.string().optional().nullable(),
  }),
});

const bulkDeleteSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
});

const reorderSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
      status: z.string().optional(),
      columnId: z.string().optional(),
    })
  ),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

/**
 * Brand-scoped ownership filter for Task queries.
 *
 * A multi-business owner who switches their active brand must only see/mutate
 * the tasks belonging to that brand — not every task they own across ALL their
 * brands. Scope by BOTH the user (ownership) AND the active brand
 * (organizationId), while preserving legacy tasks created before brand-scoping
 * existed (organizationId === null) so nothing the user legitimately owns
 * disappears.
 *
 * - effectiveOrgId set (multi-business owner on a brand, or single-org user):
 *     { userId, OR: [{ organizationId: effectiveOrgId }, { organizationId: null }] }
 * - no org context (legacy user with no organisation): { userId }
 */
function buildTaskOwnershipWhere(
  userId: string,
  effectiveOrgId: string | null
): Record<string, unknown> {
  if (!effectiveOrgId) {
    return { userId };
  }
  return {
    userId,
    OR: [{ organizationId: effectiveOrgId }, { organizationId: null }],
  };
}

// =============================================================================
// PATCH - Bulk Update Tasks
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Check if this is a reorder operation
    if (body.tasks) {
      const validation = reorderSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation Error', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { tasks } = validation.data;

      // Verify ownership of all tasks (scoped to the active brand)
      const taskIds = tasks.map(t => t.id);
      const effectiveOrgId = await getEffectiveOrganizationId(userId);
      const existingTasks = await prisma.task.findMany({
        where: {
          id: { in: taskIds },
          ...buildTaskOwnershipWhere(userId, effectiveOrgId),
        },
        select: { id: true },
      });

      if (existingTasks.length !== taskIds.length) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Some tasks not found or not owned' },
          { status: 403 }
        );
      }

      // Update each task's order atomically
      await prisma.$transaction(
        tasks.map(task =>
          prisma.task.update({
            where: { id: task.id },
            data: {
              order: task.order,
              ...(task.status && { status: task.status }),
              ...(task.columnId && { columnId: task.columnId }),
            },
          })
        )
      );

      return NextResponse.json({ success: true, updated: tasks.length });
    }

    // Standard bulk update
    const validation = bulkUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { taskIds, updates } = validation.data;

    // Verify ownership of all tasks (scoped to the active brand)
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    const ownershipWhere = buildTaskOwnershipWhere(userId, effectiveOrgId);
    const existingTasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, ...ownershipWhere },
      select: { id: true },
    });

    if (existingTasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Some tasks not found or not owned' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.status === 'done') {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds }, ...ownershipWhere },
      data: updateData,
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    logger.error('Error bulk updating tasks:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to bulk update tasks',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Bulk Delete Tasks
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { taskIds } = validation.data;

    // Verify ownership of all tasks (scoped to the active brand)
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    const ownershipWhere = buildTaskOwnershipWhere(userId, effectiveOrgId);
    const existingTasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, ...ownershipWhere },
      select: { id: true },
    });

    if (existingTasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Some tasks not found or not owned' },
        { status: 403 }
      );
    }

    const result = await prisma.task.deleteMany({
      where: { id: { in: taskIds }, ...ownershipWhere },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    logger.error('Error bulk deleting tasks:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to bulk delete tasks',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
