/**
 * Service Token Validator
 *
 * Validates cross-product service-to-service requests using a shared
 * secret token passed in the X-Service-Token header.
 *
 * Usage in API routes:
 *   const serviceAuth = validateServiceToken(request);
 *   if (!serviceAuth.valid) {
 *     // Fall back to user auth, or reject
 *   }
 *
 * Env required:
 *   SYNTHEX_SERVICE_TOKEN — shared secret (rotate quarterly)
 */

import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

export interface ServiceAuthResult {
  valid: boolean;
  sourceApp?: string;
  error?: string;
}

const SERVICE_TOKEN = process.env.SYNTHEX_SERVICE_TOKEN;

/**
 * Validate a cross-product service request.
 * Checks X-Service-Token header against SYNTHEX_SERVICE_TOKEN env var.
 */
export function validateServiceToken(request: NextRequest): ServiceAuthResult {
  if (!SERVICE_TOKEN) {
    return {
      valid: false,
      error: 'Service token not configured on this server',
    };
  }

  const token = request.headers.get('x-service-token');
  if (!token) {
    return {
      valid: false,
      error: 'Missing X-Service-Token header',
    };
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(SERVICE_TOKEN);
  const actual = Buffer.from(token);

  if (expected.length !== actual.length) {
    return {
      valid: false,
      error: 'Invalid service token',
    };
  }

  try {
    if (!timingSafeEqual(expected, actual)) {
      return {
        valid: false,
        error: 'Invalid service token',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid service token',
    };
  }

  const sourceApp = request.headers.get('x-source-app') ?? 'unknown';

  return {
    valid: true,
    sourceApp,
  };
}

/**
 * Check if a request is from an allowed cross-product source.
 * Currently allows: restoreassist
 */
export function isAllowedServiceSource(sourceApp: string): boolean {
  const allowed = new Set(['restoreassist']);
  return allowed.has(sourceApp.toLowerCase());
}
