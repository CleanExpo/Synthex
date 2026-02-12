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

/**
 * Known safe error messages that can be shown to users
 * These don't expose internal system details
 */
const SAFE_ERROR_PATTERNS = [
  /not found/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid.*token/i,
  /expired/i,
  /missing.*required/i,
  /validation.*failed/i,
  /already exists/i,
  /rate limit/i,
  /too many requests/i,
  /permission denied/i,
  /access denied/i,
  /not authenticated/i,
  /invalid credentials/i,
  /session expired/i,
  /invalid input/i,
  /bad request/i,
  /conflict/i,
];

/**
 * Error messages that indicate internal system issues and should be hidden
 */
const UNSAFE_ERROR_PATTERNS = [
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /prisma/i,
  /database/i,
  /sql/i,
  /connection/i,
  /socket/i,
  /internal server/i,
  /undefined is not/i,
  /cannot read property/i,
  /is not a function/i,
  /stack trace/i,
  /at\s+\w+\s+\(/i, // Stack trace patterns
  /node_modules/i,
  /\.ts:\d+:\d+/i, // TypeScript file references
  /\.js:\d+:\d+/i, // JavaScript file references
  /secret/i,
  /password/i,
  /token/i,
  /key/i,
  /credential/i,
];

/**
 * Sanitize error message for API responses
 * In production: hides internal details, shows generic messages
 * In development: shows full error details for debugging
 *
 * @param error - The error to sanitize
 * @param fallbackMessage - Message to show if error is unsafe (default: 'An error occurred')
 * @returns Safe error message for API response
 */
export function sanitizeErrorForResponse(
  error: unknown,
  fallbackMessage = 'An error occurred'
): string {
  const message = getErrorMessage(error);

  // In development, show full error details
  if (process.env.NODE_ENV === 'development') {
    return message;
  }

  // Check if error message contains unsafe patterns
  for (const pattern of UNSAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return fallbackMessage;
    }
  }

  // Check if error message matches known safe patterns
  for (const pattern of SAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return message;
    }
  }

  // Default: if message is short and doesn't look like a stack trace, allow it
  // Otherwise, return fallback
  if (message.length < 100 && !message.includes('\n') && !message.includes('    at ')) {
    return message;
  }

  return fallbackMessage;
}

/**
 * Create a sanitized error response object for API endpoints
 *
 * @param error - The error to process
 * @param fallbackMessage - Default message for production
 * @returns Object safe for API response
 */
export function createSafeErrorResponse(
  error: unknown,
  fallbackMessage = 'An error occurred'
): { error: string; details?: string } {
  const safeMessage = sanitizeErrorForResponse(error, fallbackMessage);

  // In development, include original message as details if different
  if (process.env.NODE_ENV === 'development') {
    const originalMessage = getErrorMessage(error);
    if (originalMessage !== safeMessage) {
      return { error: safeMessage, details: originalMessage };
    }
  }

  return { error: safeMessage };
}
