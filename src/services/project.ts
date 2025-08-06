import { PrismaClient, type Project } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['marketing', 'content', 'analytics', 'research', 'automation']),
  data: z.any().optional()
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export interface ProjectWithMetrics extends Project {
  lastActivity?: Date;
  itemCount?: number;
  completionRate?: number;
}

export class ProjectService {
  /**
   * Create a new project
   */
  static async create(userId: string, data: z.infer<typeof CreateProjectSchema>): Promise<Project> {
    const validated = CreateProjectSchema.parse(data);
    
    return await prisma.project.create({
      data: {
        ...validated,
        userId,
        data: validated.data || {
          settings: {},
          metrics: {
            views: 0,
            edits: 0,
            shares: 0
          },
          items: []
        }
      }
    });
  }

  /**
   * Get all projects for a user
   */
  static async getUserProjects(userId: string, options?: {
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ projects: ProjectWithMetrics[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options?.sortBy || 'updatedAt';
    const sortOrder = options?.sortOrder || 'desc';
    
    const where: any = { userId };
    if (options?.type) where.type = options.type;
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } }
      ];
    }
    
    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.project.count({ where })
    ]);
    
    // Add computed metrics
    const projectsWithMetrics = projects.map((project: Project) => {
      const data = project.data as any || {};
      const items = data.items || [];
      const completedItems = items.filter((item: any) => item.completed).length;
      
      return {
        ...project,
        lastActivity: project.updatedAt,
        itemCount: items.length,
        completionRate: items.length > 0 ? (completedItems / items.length) * 100 : 0
      };
    });
    
    return { projects: projectsWithMetrics, total };
  }

  /**
   * Get a single project by ID
   */
  static async getById(id: string, userId: string): Promise<ProjectWithMetrics | null> {
    const project = await prisma.project.findFirst({
      where: { id, userId }
    });
    
    if (!project) return null;
    
    const data = project.data as any || {};
    const items = data.items || [];
    const completedItems = items.filter((item: any) => item.completed).length;
    
    return {
      ...project,
      lastActivity: project.updatedAt,
      itemCount: items.length,
      completionRate: items.length > 0 ? (completedItems / items.length) * 100 : 0
    };
  }

  /**
   * Update a project
   */
  static async update(
    id: string, 
    userId: string, 
    data: z.infer<typeof UpdateProjectSchema>
  ): Promise<Project> {
    const validated = UpdateProjectSchema.parse(data);
    
    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId }
    });
    
    if (!existing) {
      throw new Error('Project not found');
    }
    
    // Merge data if provided
    if (validated.data !== undefined) {
      const currentData = existing.data as any || {};
      validated.data = {
        ...currentData,
        ...validated.data
      };
    }
    
    return await prisma.project.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Delete a project
   */
  static async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId }
    });
    
    if (!existing) {
      throw new Error('Project not found');
    }
    
    await prisma.project.delete({
      where: { id }
    });
  }

  /**
   * Add item to project
   */
  static async addItem(
    id: string,
    userId: string,
    item: {
      title: string;
      description?: string;
      type?: string;
      data?: any;
      completed?: boolean;
    }
  ): Promise<Project> {
    const project = await this.getById(id, userId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    const data = project.data as any || {};
    const items = data.items || [];
    
    items.push({
      id: Date.now().toString(),
      ...item,
      completed: item.completed || false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return await this.update(id, userId, {
      data: {
        ...data,
        items
      }
    });
  }

  /**
   * Update project item
   */
  static async updateItem(
    projectId: string,
    userId: string,
    itemId: string,
    updates: Partial<{
      title: string;
      description: string;
      type: string;
      data: any;
      completed: boolean;
    }>
  ): Promise<Project> {
    const project = await this.getById(projectId, userId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    const data = project.data as any || {};
    const items = data.items || [];
    const itemIndex = items.findIndex((item: any) => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }
    
    items[itemIndex] = {
      ...items[itemIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    return await this.update(projectId, userId, {
      data: {
        ...data,
        items
      }
    });
  }

  /**
   * Delete project item
   */
  static async deleteItem(
    projectId: string,
    userId: string,
    itemId: string
  ): Promise<Project> {
    const project = await this.getById(projectId, userId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    const data = project.data as any || {};
    const items = (data.items || []).filter((item: any) => item.id !== itemId);
    
    return await this.update(projectId, userId, {
      data: {
        ...data,
        items
      }
    });
  }

  /**
   * Get project statistics
   */
  static async getStatistics(userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    recentlyUpdated: number;
    completionRate: number;
  }> {
    const projects = await prisma.project.findMany({
      where: { userId }
    });
    
    const byType: Record<string, number> = {};
    let totalItems = 0;
    let completedItems = 0;
    
    projects.forEach((project: Project) => {
      // Count by type
      byType[project.type] = (byType[project.type] || 0) + 1;
      
      // Count items for completion rate
      const data = project.data as any || {};
      const items = data.items || [];
      totalItems += items.length;
      completedItems += items.filter((item: any) => item.completed).length;
    });
    
    // Count recently updated (within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlyUpdated = projects.filter((p: Project) => p.updatedAt > sevenDaysAgo).length;
    
    return {
      total: projects.length,
      byType,
      recentlyUpdated,
      completionRate: totalItems > 0 ? (completedItems / totalItems) * 100 : 0
    };
  }

  /**
   * Clone a project
   */
  static async clone(id: string, userId: string): Promise<Project> {
    const original = await prisma.project.findFirst({
      where: { id, userId }
    });
    
    if (!original) {
      throw new Error('Project not found');
    }
    
    return await prisma.project.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        type: original.type,
        data: original.data as any,
        userId
      }
    });
  }

  /**
   * Search projects
   */
  static async search(userId: string, query: string): Promise<Project[]> {
    return await prisma.project.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query } },
          { description: { contains: query } }
        ]
      },
      take: 10,
      orderBy: { updatedAt: 'desc' }
    });
  }
}

export default ProjectService;