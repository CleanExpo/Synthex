/**
 * Request Validation Middleware
 *
 * Provides standardized request validation using Zod schemas.
 * Handles body, query parameters, and path parameters.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NODE_ENV: Environment mode (PUBLIC)
 *
 * @module middleware/validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidatedRequest<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format Zod errors into a consistent structure
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Create error response for validation failures
 */
function createValidationErrorResponse(errors: ValidationError[]): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation Error',
      message: 'Request validation failed',
      details: errors,
      timestamp: new Date().toISOString(),
    },
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: 'body',
          message: 'Invalid JSON body',
          code: 'invalid_json',
        },
      ],
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const { searchParams } = new URL(request.url);
    const query: Record<string, string | string[]> = {};

    searchParams.forEach((value, key) => {
      if (query[key]) {
        // Handle array parameters
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    });

    const result = schema.safeParse(query);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: 'query',
          message: 'Failed to parse query parameters',
          code: 'parse_error',
        },
      ],
    };
  }
}

/**
 * Validate path parameters against a Zod schema
 */
export function validateParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(params);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

// =============================================================================
// Middleware Wrapper
// =============================================================================

interface ValidationSchemas<TBody, TQuery, TParams> {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}

type RouteHandler<TBody, TQuery, TParams> = (
  request: NextRequest,
  validated: ValidatedRequest<TBody, TQuery, TParams>,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Create a validated route handler
 *
 * @example
 * ```ts
 * import { withValidation } from '@/middleware/validate';
 * import { createPostSchema } from '@/lib/schemas';
 *
 * export const POST = withValidation(
 *   { body: createPostSchema },
 *   async (request, { body }) => {
 *     // body is fully typed and validated
 *     const post = await createPost(body);
 *     return NextResponse.json(post);
 *   }
 * );
 * ```
 */
export function withValidation<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(
  schemas: ValidationSchemas<TBody, TQuery, TParams>,
  handler: RouteHandler<TBody, TQuery, TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const validated: ValidatedRequest<TBody, TQuery, TParams> = {
      body: undefined as TBody,
      query: undefined as TQuery,
      params: undefined as TParams,
    };

    // Validate body if schema provided
    if (schemas.body) {
      const bodyResult = await validateBody(request, schemas.body);
      if (!bodyResult.success) {
        return createValidationErrorResponse(bodyResult.errors!);
      }
      validated.body = bodyResult.data!;
    }

    // Validate query if schema provided
    if (schemas.query) {
      const queryResult = validateQuery(request, schemas.query);
      if (!queryResult.success) {
        return createValidationErrorResponse(queryResult.errors!);
      }
      validated.query = queryResult.data!;
    }

    // Validate params if schema provided
    if (schemas.params && context?.params) {
      const paramsResult = validateParams(context.params, schemas.params);
      if (!paramsResult.success) {
        return createValidationErrorResponse(paramsResult.errors!);
      }
      validated.params = paramsResult.data!;
    }

    return handler(request, validated, context);
  };
}

// =============================================================================
// Pre-built Validators
// =============================================================================

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // UUID parameter
  uuidParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Pagination query
  pagination: z.object({
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
  }),

  // Sort query
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // Search query
  search: z.object({
    q: z.string().max(200).optional(),
    search: z.string().max(200).optional(),
  }),

  // Date range query
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

/**
 * Combine multiple schemas for query parameters
 */
export function combineQuerySchemas<T extends z.ZodRawShape[]>(
  ...schemas: { shape: T[number] }[]
) {
  const combined: z.ZodRawShape = {};

  for (const schema of schemas) {
    Object.assign(combined, schema.shape);
  }

  return z.object(combined);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Strip unknown fields from request body
 */
export async function sanitizeBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch {
    return null;
  }
}

/**
 * Check if value is a valid UUID
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Coerce string to boolean
 */
export function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return Boolean(value);
}

/**
 * Parse comma-separated string to array
 */
export function parseArrayParam(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// =============================================================================
// Type Exports
// =============================================================================

export type { ZodSchema, ZodError };
