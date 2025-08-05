import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import ProjectService, { CreateProjectSchema, UpdateProjectSchema } from '../services/project';
import { apiResponse } from '../utils/apiResponse';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @route   GET /api/projects
 * @desc    Get all projects for the authenticated user
 * @access  Private
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      type, 
      search, 
      page = '1', 
      limit = '10',
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;
    
    const result = await ProjectService.getUserProjects(req.user!.id, {
      type: type as string,
      search: search as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any
    });
    
    return apiResponse.success(res, result, 'Projects retrieved successfully');
  } catch (error) {
    console.error('Error fetching projects:', error);
    return apiResponse.error(res, 'Failed to fetch projects');
  }
});

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const project = await ProjectService.create(req.user!.id, req.body);
    return apiResponse.created(res, project, 'Project created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid project data', error.errors);
    }
    console.error('Error creating project:', error);
    return apiResponse.error(res, 'Failed to create project');
  }
});

/**
 * @route   GET /api/projects/statistics
 * @desc    Get project statistics for the user
 * @access  Private
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await ProjectService.getStatistics(req.user!.id);
    return apiResponse.success(res, stats, 'Statistics retrieved successfully');
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return apiResponse.error(res, 'Failed to fetch statistics');
  }
});

/**
 * @route   GET /api/projects/search
 * @desc    Search projects
 * @access  Private
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return apiResponse.badRequest(res, 'Search query is required');
    }
    
    const projects = await ProjectService.search(req.user!.id, q);
    return apiResponse.success(res, projects, 'Search completed successfully');
  } catch (error) {
    console.error('Error searching projects:', error);
    return apiResponse.error(res, 'Failed to search projects');
  }
});

/**
 * @route   GET /api/projects/:id
 * @desc    Get a single project by ID
 * @access  Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await ProjectService.getById(req.params.id, req.user!.id);
    
    if (!project) {
      return apiResponse.notFound(res, 'Project not found');
    }
    
    return apiResponse.success(res, project, 'Project retrieved successfully');
  } catch (error) {
    console.error('Error fetching project:', error);
    return apiResponse.error(res, 'Failed to fetch project');
  }
});

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project
 * @access  Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const project = await ProjectService.update(
      req.params.id,
      req.user!.id,
      req.body
    );
    
    return apiResponse.success(res, project, 'Project updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid project data', error.errors);
    }
    if ((error as Error).message === 'Project not found') {
      return apiResponse.notFound(res, 'Project not found');
    }
    console.error('Error updating project:', error);
    return apiResponse.error(res, 'Failed to update project');
  }
});

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project
 * @access  Private
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ProjectService.delete(req.params.id, req.user!.id);
    return apiResponse.success(res, null, 'Project deleted successfully');
  } catch (error) {
    if ((error as Error).message === 'Project not found') {
      return apiResponse.notFound(res, 'Project not found');
    }
    console.error('Error deleting project:', error);
    return apiResponse.error(res, 'Failed to delete project');
  }
});

/**
 * @route   POST /api/projects/:id/clone
 * @desc    Clone a project
 * @access  Private
 */
router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const project = await ProjectService.clone(req.params.id, req.user!.id);
    return apiResponse.created(res, project, 'Project cloned successfully');
  } catch (error) {
    if ((error as Error).message === 'Project not found') {
      return apiResponse.notFound(res, 'Project not found');
    }
    console.error('Error cloning project:', error);
    return apiResponse.error(res, 'Failed to clone project');
  }
});

/**
 * @route   POST /api/projects/:id/items
 * @desc    Add item to project
 * @access  Private
 */
router.post('/:id/items', async (req: Request, res: Response) => {
  try {
    const { title, description, type, data, completed } = req.body;
    
    if (!title) {
      return apiResponse.badRequest(res, 'Item title is required');
    }
    
    const project = await ProjectService.addItem(
      req.params.id,
      req.user!.id,
      { title, description, type, data, completed }
    );
    
    return apiResponse.success(res, project, 'Item added successfully');
  } catch (error) {
    if ((error as Error).message === 'Project not found') {
      return apiResponse.notFound(res, 'Project not found');
    }
    console.error('Error adding item:', error);
    return apiResponse.error(res, 'Failed to add item');
  }
});

/**
 * @route   PUT /api/projects/:id/items/:itemId
 * @desc    Update project item
 * @access  Private
 */
router.put('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const project = await ProjectService.updateItem(
      req.params.id,
      req.user!.id,
      req.params.itemId,
      req.body
    );
    
    return apiResponse.success(res, project, 'Item updated successfully');
  } catch (error) {
    if ((error as Error).message === 'Project not found') {
      return apiResponse.notFound(res, 'Project not found');
    }
    if ((error as Error).message === 'Item not found') {
      return apiResponse.notFound(res, 'Item not found');
    }
    console.error('Error updating item:', error);
    return apiResponse.error(res, 'Failed to update item');
  }
});

/**
 * @route   DELETE /api/projects/:id/items/:itemId
 * @desc    Delete project item
 * @access  Private
 */
router.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const project = await ProjectService.deleteItem(
      req.params.id,
      req.user!.id,
      req.params.itemId
    );
    
    return apiResponse.success(res, project, 'Item deleted successfully');
  } catch (error) {
    if ((error as Error).message === 'Project not found') {
      return apiResponse.notFound(res, 'Project not found');
    }
    console.error('Error deleting item:', error);
    return apiResponse.error(res, 'Failed to delete item');
  }
});

export default router;