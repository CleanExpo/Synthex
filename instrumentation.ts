/**
 * Next.js Instrumentation Hook
 *
 * Runs once at server startup. Validates environment variables using
 * the canonical EnvValidator to fail fast on missing critical credentials.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

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
  // This prevents startup crashes while maintaining cryptographic security.
  if (!process.env.OAUTH_STATE_SECRET && process.env.JWT_SECRET) {
    const crypto = await import(/* webpackIgnore: true */ 'node:crypto');
    process.env.OAUTH_STATE_SECRET = crypto
      .createHash('sha256')
      .update(process.env.JWT_SECRET + ':oauth-state-secret')
      .digest('base64');
    console.warn(
      '[env-validator] OAUTH_STATE_SECRET not set — derived from JWT_SECRET. Set it explicitly for production: openssl rand -base64 32'
    );
  }

  const { EnvValidator, SecurityLevel } = await import(
    '@/lib/security/env-validator'
  );

  const validator = EnvValidator.getInstance();

  // Validate without throwing internally — we handle the throw logic here
  const result = validator.validate(false);

  // Separate CRITICAL errors from non-critical
  const criticalErrors = result.errors.filter(
    (e) => e.securityLevel === SecurityLevel.CRITICAL
  );
  const nonCriticalErrors = result.errors.filter(
    (e) => e.securityLevel !== SecurityLevel.CRITICAL
  );

  // Log summary
  console.log(
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

  // CRITICAL errors prevent startup
  if (criticalErrors.length > 0) {
    for (const error of criticalErrors) {
      console.error(
        `[env-validator] CRITICAL: ${error.key} - ${error.message}${error.suggestion ? ` (${error.suggestion})` : ''}`
      );
    }

    throw new Error(
      `Environment validation failed: ${criticalErrors.length} critical variable(s) missing or invalid (${criticalErrors.map((e) => e.key).join(', ')}). Server cannot start safely.`
    );
  }

  // If we get here, all critical vars are present
  if (result.isValid) {
    console.log('[env-validator] All required environment variables validated successfully');
  } else {
    console.warn(
      `[env-validator] Server starting with ${nonCriticalErrors.length} non-critical validation issue(s)`
    );
  }

  // Verify database connectivity at startup — truly fire-and-forget (no await).
  // register() must return fast to avoid hanging the Lambda cold start.
  // The db check runs in the background; its result is logged but never awaited.
  if (process.env.DATABASE_URL) {
    (async () => {
      try {
        const { prisma } = await import('@/lib/prisma');
        await Promise.race([
          (prisma as any).$queryRaw`SELECT 1`,
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]);
        console.log('[db-check] Database connection verified successfully');
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        console.warn(`[db-check] Database connection check failed: ${msg}`);
      }
    })();
    // No await — register() returns immediately; db check runs in background.
  }
}
