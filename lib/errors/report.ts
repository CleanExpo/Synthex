/**
 * Production Error Reporter — SYN-533
 *
 * Wraps the existing alertManager to provide structured error reporting
 * for API routes. In production, unhandled errors are sent to Slack via
 * ALERT_SLACK_WEBHOOK_URL. In development/test, errors are logged only.
 *
 * Usage:
 *   // Report a caught error with context
 *   await reportError(err, { route: '/api/posts', userId: 'u_123' });
 *
 *   // Wrap an API route handler (catches unhandled throws)
 *   export const POST = withErrorReporting(async (req) => { ... });
 */

import { NextRequest, NextResponse } from 'next/server';
import { alertManager, AlertSeverity } from '@/lib/alerts';

export interface ErrorContext {
  route?: string;
  method?: string;
  userId?: string;
  organisationId?: string;
  /** Additional key/value pairs to include in the alert */
  extra?: Record<string, string | number | boolean | undefined>;
}

/**
 * Report an error to the alert system.
 * Never throws — safe to call from catch blocks.
 */
export async function reportError(
  error: unknown,
  context: ErrorContext = {}
): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;

  const err = error instanceof Error ? error : new Error(String(error));
  const {
    route = 'unknown',
    method = '',
    userId,
    organisationId,
    extra = {},
  } = context;

  const extraLines = Object.entries({ userId, organisationId, ...extra })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join('\n');

  const message = [
    `\`${method} ${route}\``,
    `*Error:* ${err.message}`,
    extraLines,
    err.stack
      ? `\`\`\`${err.stack.split('\n').slice(0, 6).join('\n')}\`\`\``
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await alertManager.sendAlert({
      title: `API Error — ${route}`,
      message,
      severity: AlertSeverity.ERROR,
      source: 'api-error-reporter',
    });
  } catch {
    // Never let reporting failures surface to callers
    console.error('[reportError] Failed to send alert:', err.message);
  }
}

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>;

/**
 * Higher-order function that wraps a Next.js App Router route handler.
 * Catches unhandled errors, reports them, and returns a 500 response.
 */
export function withErrorReporting(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const route = new URL(req.url).pathname;

      await reportError(error, {
        route,
        method: req.method,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
