/**
 * Tasks API
 *
 * CRUD operations for task management with Kanban/List views.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/tasks/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

const listTasksQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  status: z.enum(['todo', 'in-progress', 'review', 'done', 'all']).optional().default('all'),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'all']).optional().default('all'),
  category: z.string().optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'priority', 'order']).optional().default('order'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  dueDate: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(50).optional(),
  estimatedTime: z.number().min(0).optional(),
  columnId: z.string().optional(),
  order: z.number().optional(),
  assigneeId: z.string().optional(),
  campaignId: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
  category: z.string().max(50).optional().nullable(),
  estimatedTime: z.number().min(0).optional().nullable(),
  actualTime: z.number().min(0).optional(),
  progress: z.number().min(0).max(100).optional(),
  columnId: z.string().optional(),
  order: z.number().optional(),
  assigneeId: z.string().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

async function getUserId(request: NextRequest): Promise<string | null> {
  return getUserIdFromRequest(request);
}

// =============================================================================
// GET - List Tasks
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const validation = listTasksQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, status, priority, category, sortBy, sortOrder } = validation.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { userId };

    if (status !== 'all') {
      where.status = status;
    }

    if (priority !== 'all') {
      where.priority = priority;
    }

    if (category) {
      where.category = category;
    }

    // Get total count
    const total = await prisma.task.count({ where });

    // Get tasks
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });

    return NextResponse.json({
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Task
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createTaskSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get max order for positioning
    const maxOrder = await prisma.task.aggregate({
      where: { userId, status: data.status },
      _max: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        ...data,
        userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        order: data.order ?? (maxOrder._max.order ?? 0) + 1,
      },
    });

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Task
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Task ID is required' },
        { status: 400 }
      );
    }

    const validation = updateTaskSchema.safeParse(updateData);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingTask || existingTask.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Task not found' },
        { status: 404 }
      );
    }

    const data = validation.data;

    // Handle status change to 'done'
    const updatePayload: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updatePayload.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.completedAt !== undefined) {
      updatePayload.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }
    if (data.status === 'done' && !data.completedAt) {
      updatePayload.completedAt = new Date();
      updatePayload.progress = 100;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updatePayload,
    });

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Task
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingTask || existingTask.userId !== userId) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Task not found' },
        { status: 404 }
      );
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
