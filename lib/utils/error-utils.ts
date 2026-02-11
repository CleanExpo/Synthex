/**
 * Error handling utilities for type-safe error handling
 * Replaces catch (error: any) pattern with proper type safety
 */

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}

/**
 * Check if error is an Axios-like error with response
 */
export function isAxiosError(error: unknown): error is {
  response?: {
    status: number;
    data: unknown;
  };
  request?: unknown;
  message: string;
} {
  return (
    error !== null &&
    typeof error === 'object' &&
    ('response' in error || 'request' in error)
  );
}

/**
 * Check if error has a specific status code (for HTTP errors)
 */
export function hasStatusCode(error: unknown, status: number): boolean {
  if (isAxiosError(error) && error.response) {
    return error.response.status === status;
  }
  return false;
}

/**
 * Extract error details for logging (safe for production)
 */
export function getErrorDetails(error: unknown): {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
} {
  const details: {
    message: string;
    name?: string;
    stack?: string;
    code?: string;
  } = {
    message: getErrorMessage(error),
  };

  if (error instanceof Error) {
    details.name = error.name;
    if (process.env.NODE_ENV !== 'production') {
      details.stack = error.stack;
    }
  }

  if (error && typeof error === 'object' && 'code' in error) {
    details.code = String((error as { code: unknown }).code);
  }

  return details;
}
