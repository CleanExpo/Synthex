import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    timestamp: string;
    version: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

export class ApiResponseHandler {
  private static readonly API_VERSION = 'v1';

  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200,
    pagination?: PaginationMeta
  ): Response {
    const metadata: ApiResponse['metadata'] = {
      timestamp: new Date().toISOString(),
      version: this.API_VERSION
    };
    
    if (pagination) {
      metadata.pagination = pagination;
    }
    
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      metadata
    };
    
    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    error: string,
    statusCode: number = 400,
    details?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      error,
      ...(details && { data: details }),
      metadata: {
        timestamp: new Date().toISOString(),
        version: this.API_VERSION
      }
    };
    
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message: string = 'Resource created successfully'): Response {
    return this.success(res, data, message, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static notFound(res: Response, resource: string = 'Resource'): Response {
    return this.error(res, `${resource} not found`, 404);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): Response {
    return this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): Response {
    return this.error(res, message, 403);
  }

  static validationError(res: Response, errors: any): Response {
    return this.error(res, 'Validation failed', 422, errors);
  }

  static serverError(res: Response, error: any): Response {
    console.error('Server error:', error);
    
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message || 'Internal server error';
    
    return this.error(res, message, 500);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): Response {
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      page,
      limit,
      total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
    
    return this.success(res, data, message, 200, pagination);
  }
}

// Export for convenience
export const ApiRes = ApiResponseHandler;