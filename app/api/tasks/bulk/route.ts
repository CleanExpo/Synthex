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
  tasks: z.array(z.object({
    id: z.string(),
    order: z.number(),
    status: z.string().optional(),
    columnId: z.string().optional(),
  })),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// =============================================================================
// PATCH - Bulk Update Tasks
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
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

      // Verify ownership of all tasks
      const taskIds = tasks.map(t => t.id);
      const existingTasks = await prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, userId: true },
      });

      const allOwned = existingTasks.every(t => t.userId === userId);
      if (!allOwned || existingTasks.length !== taskIds.length) {
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

    // Verify ownership of all tasks
    const existingTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, userId: true },
    });

    const allOwned = existingTasks.every(t => t.userId === userId);
    if (!allOwned || existingTasks.length !== taskIds.length) {
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
      where: { id: { in: taskIds } },
      data: updateData,
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to bulk update tasks' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Bulk Delete Tasks
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
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

    // Verify ownership of all tasks
    const existingTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, userId: true },
    });

    const allOwned = existingTasks.every(t => t.userId === userId);
    if (!allOwned || existingTasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Some tasks not found or not owned' },
        { status: 403 }
      );
    }

    const result = await prisma.task.deleteMany({
      where: { id: { in: taskIds } },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Error bulk deleting tasks:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to bulk delete tasks' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
