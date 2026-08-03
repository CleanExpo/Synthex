import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { RateLimiter } from '@/lib/rate-limit/rate-limiter';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  GoalApprovalRejectedError,
  IntentScapeNotFoundError,
  VisionExpansionRejectedError,
} from './engine';
import {
  MarkdownArtifactIntegrityError,
  MarkdownArtifactStorageError,
  MarkdownArtifactValidationError,
} from './markdown-store';
import {
  IntentScapeExpansionConflictError,
  IntentScapeStaleContextError,
} from './prisma-repository';
import { IntentScapeContextVersionConflictError } from './runtime';
import { IntentScapeSourceValidationError } from './source-ingestion';

export async function authenticateIntentScapeRequest(
  request: NextRequest,
  mode: 'read' | 'write'
): Promise<
  | { allowed: true; userId: string; organizationId: string }
  | { allowed: false; response: NextResponse }
> {
  const security = await APISecurityChecker.check(
    request,
    mode === 'write'
      ? DEFAULT_POLICIES.AUTHENTICATED_WRITE
      : DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed || !security.context.userId) {
    return {
      allowed: false,
      response: APISecurityChecker.createSecureResponse(
        { error: security.error ?? 'Authentication required' },
        401
      ),
    };
  }

  const organizationId = await getEffectiveOrganizationId(
    security.context.userId
  );
  if (!organizationId) {
    return {
      allowed: false,
      response: APISecurityChecker.createSecureResponse(
        { error: 'No active organisation found' },
        403
      ),
    };
  }
  return {
    allowed: true,
    userId: security.context.userId,
    organizationId,
  };
}

export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new z.ZodError([
      {
        code: 'custom',
        path: [],
        message: 'Request body must be valid JSON.',
      },
    ]);
  }
}

export function intentScapeErrorResponse(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Validation failed', details: error.flatten().fieldErrors },
      400
    );
  }
  if (error instanceof IntentScapeNotFoundError) {
    return APISecurityChecker.createSecureResponse(
      { error: 'IntentScape resource not found' },
      404
    );
  }
  if (
    error instanceof IntentScapeStaleContextError ||
    error instanceof IntentScapeContextVersionConflictError ||
    error instanceof IntentScapeExpansionConflictError
  ) {
    return APISecurityChecker.createSecureResponse(
      { error: error.message },
      409
    );
  }
  if (error instanceof GoalApprovalRejectedError) {
    return APISecurityChecker.createSecureResponse(
      { error: error.message },
      422
    );
  }
  if (error instanceof VisionExpansionRejectedError) {
    return APISecurityChecker.createSecureResponse(
      {
        error: error.message,
        attempts: error.attempts.map(attempt => ({
          attempt: attempt.attempt,
          status: attempt.status,
          rejectionReasons: attempt.rejectionReasons,
        })),
      },
      422
    );
  }
  if (error instanceof MarkdownArtifactValidationError) {
    return APISecurityChecker.createSecureResponse(
      { error: error.message },
      400
    );
  }
  if (error instanceof IntentScapeSourceValidationError) {
    return APISecurityChecker.createSecureResponse(
      { error: error.message },
      400
    );
  }
  if (error instanceof MarkdownArtifactStorageError) {
    logger.error('IntentScape private Markdown storage unavailable', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Private knowledge storage is temporarily unavailable' },
      503
    );
  }
  if (error instanceof MarkdownArtifactIntegrityError) {
    logger.error('IntentScape Markdown integrity failure', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Knowledge integrity verification failed' },
      500
    );
  }

  logger.error('IntentScape request failed', { error });
  return APISecurityChecker.createSecureResponse(
    { error: 'IntentScape request failed' },
    500
  );
}

export async function withIntentScapeExpansionLimit(
  request: NextRequest,
  userId: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const limiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: 3,
    identifier: () => `intentscape-expansion:${userId}`,
  });
  const result = await limiter.check(request);
  if (!result.allowed) {
    return APISecurityChecker.createSecureResponse(
      {
        error: 'Vision expansion rate limit exceeded',
        retryAfter: new Date(result.resetTime).toISOString(),
      },
      429
    );
  }
  const response = await handler();
  response.headers.set('X-RateLimit-Limit', '3');
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set(
    'X-RateLimit-Reset',
    new Date(result.resetTime).toISOString()
  );
  return response;
}
