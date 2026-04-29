/**
 * Next.js Instrumentation Hook
 *
 * Runs once at server startup. Validates environment variables using
 * the canonical EnvValidator. NEVER throws — logs CRITICAL failures
 * and continues so the Lambda can respond (and surface the error in logs).
 *
 * KEY RULE: register() must never throw or hang.
 * Throwing an async Error from register() causes an unhandled rejection
 * that kills the Lambda process before it handles any request (confirmed
 * Phase 114-02: this was the root cause of the cold-start hang).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/**
 * onRequestError — fires on every unhandled server-side error in production.
 *
 * Uses dynamic import so AlertManager is never loaded at cold-start time.
 * Never throws — an uncaught throw here would crash the Lambda.
 */
export async function onRequestError(
  error: unknown,
  _request: unknown,
  _context: unknown
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.ALERT_SLACK_WEBHOOK_URL) return;

  try {
    const { AlertManager } = await import('@/lib/alerts/notification-channels');
    const msg = error instanceof Error ? error.message : String(error);
    AlertManager.getInstance()
      .error('Unhandled server error', msg, 'instrumentation/onRequestError')
      .catch(() => {
        // fire-and-forget — never let a failed alert propagate
      });
  } catch {
    // Never throw from onRequestError
  }

  // Also route to Axiom via the error tracker (ships structured payload, fire-and-forget)
  try {
    const { trackError, ErrorSeverity, ErrorCategory } =
      await import('@/lib/observability/error-tracker');
    const err = error instanceof Error ? error : new Error(String(error));
    trackError(err, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.INTERNAL,
      operation: 'instrumentation/onRequestError',
    });
  } catch {
    // Never throw from onRequestError
  }
}

export async function register() {
  // Only validate in Node.js runtime (not Edge — env vars may be incomplete there)
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Skip validation in test environment (uses .env.test with minimal vars)
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // NOTE: Sentry server-side init intentionally omitted here.
  // @sentry/nextjs Sentry.init() loads require-in-the-middle / import-in-the-middle
  // OTel hooks which hang the Node.js Lambda cold start for 10+ seconds even when
  // called inside register() (post-bundle-load). The webpack plugin was removed from
  // next.config.mjs for the same reason. Client-side Sentry remains active via
  // sentry.client.config.ts. Server error capture can be re-enabled once the
  // @sentry/nextjs OTel cold-start issue is resolved upstream.

  // Derive OAUTH_STATE_SECRET from JWT_SECRET if not explicitly set.
  // Uses globalThis.crypto.subtle (Web Crypto API) — available in both Node.js 16+
  // and Edge Runtime, so Turbopack does not flag it as an incompatible module.
  if (!process.env.OAUTH_STATE_SECRET && process.env.JWT_SECRET) {
    const encoder = new TextEncoder();
    const data = encoder.encode(process.env.JWT_SECRET + ':oauth-state-secret');
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashBytes = Array.from(new Uint8Array(hashBuffer));
    process.env.OAUTH_STATE_SECRET = btoa(
      hashBytes.map(b => String.fromCharCode(b)).join('')
    );
    console.warn(
      '[env-validator] OAUTH_STATE_SECRET not set — derived from JWT_SECRET. Set it explicitly for production: openssl rand -base64 32'
    );
  }

  // Wrap ALL validation logic in try-catch.
  // register() MUST NOT throw — a throw causes an unhandled rejection that kills
  // the Lambda process before it can handle any request (Phase 114-02 root cause).
  try {
    const { EnvValidator, SecurityLevel } =
      await import('@/lib/security/env-validator');

    const validator = EnvValidator.getInstance();

    // Validate without throwing internally — we handle logging here
    const result = validator.validate(false);

    // Separate CRITICAL errors from non-critical
    const criticalErrors = result.errors.filter(
      e => e.securityLevel === SecurityLevel.CRITICAL
    );
    const nonCriticalErrors = result.errors.filter(
      e => e.securityLevel !== SecurityLevel.CRITICAL
    );

    // Log summary
    console.info(
      `[env-validator] Validated ${result.summary.configured.length}/${result.summary.totalRequired + result.summary.totalOptional} env vars`
    );

    // Log non-critical errors as warnings (allow startup)
    for (const error of nonCriticalErrors) {
      console.warn(
        `[env-validator] WARNING: ${error.key} - ${error.message}${error.suggestion ? ` (${error.suggestion})` : ''}`
      );
    }

    // Log warnings for missing optional SECRET/INTERNAL vars
    for (const warning of result.warnings) {
      console.warn(
        `[env-validator] WARNING: ${warning.key} - ${warning.message}${warning.impact ? ` (${warning.impact})` : ''}`
      );
    }

    // CRITICAL errors: log loudly but DO NOT throw.
    // Throwing here kills the Lambda — the app will fail in more obvious ways
    // (DB errors, auth failures) which surface in logs with proper context.
    if (criticalErrors.length > 0) {
      for (const error of criticalErrors) {
        console.error(
          `[env-validator] CRITICAL: ${error.key} - ${error.message}${error.suggestion ? ` (${error.suggestion})` : ''}`
        );
      }
      console.error(
        `[env-validator] ${criticalErrors.length} critical env var(s) missing or invalid (${criticalErrors.map(e => e.key).join(', ')}). ` +
          `Server is starting anyway — individual requests will fail. Fix these immediately.`
      );
      // DO NOT throw — return gracefully so the Lambda process stays alive.
      return;
    }

    // All critical vars present
    if (result.isValid) {
      console.info(
        '[env-validator] All required environment variables validated successfully'
      );
    } else {
      console.warn(
        `[env-validator] Server starting with ${nonCriticalErrors.length} non-critical validation issue(s)`
      );
    }
  } catch (validationError) {
    // Catch any unexpected error in the validation logic itself.
    // Log and continue — never propagate.
    const msg =
      validationError instanceof Error
        ? validationError.message
        : String(validationError);
    console.error(
      `[env-validator] Validation module failed to load or run: ${msg}`
    );
    console.error(
      '[env-validator] Skipping env validation — server will start but may be misconfigured.'
    );
  }

  // ─── SYN-834 NRPG → DR pipeline subscription ─────────────────────────
  // Wrapped in try-catch + dynamic import for the same Lambda-cold-start
  // safety reasons as the env validator above. NEVER throws.
  try {
    const { bootstrapNrpgPipeline } =
      await import('@/app/lib/nrpg-pipeline-bootstrap');
    bootstrapNrpgPipeline();
  } catch (bootErr) {
    const msg = bootErr instanceof Error ? bootErr.message : String(bootErr);
    console.error(`[nrpg-pipeline] bootstrap failed: ${msg}`);
    // Do NOT propagate — the rest of the app must still respond.
  }

  // NOTE: Database connectivity check intentionally omitted from instrumentation.ts.
  //
  // WHY: instrumentation.ts is compiled for ALL runtimes (Node.js + Edge). Importing
  // @/lib/prisma triggers the pg → pg-connection-string → pgpass → split2 chain which
  // requires Node.js built-ins (fs, path, stream, net, crypto, dns) unavailable in the
  // Edge runtime webpack compilation context, causing a build failure.
  //
  // The startup DB check was fire-and-forget with no effect on app behaviour.
  // Use GET /api/health/live (which includes a real db ping) for liveness monitoring.
}
