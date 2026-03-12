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

  // Initialize Sentry here — NOT in sentry.server.config.ts — to prevent
  // Lambda cold-start hangs. The Sentry webpack plugin auto-requires
  // sentry.server.config.ts during the bundle-load phase (before the event
  // loop is ready). OTel hooks (require-in-the-middle) hang the Lambda for
  // 10+ seconds when called that early. Running init here (post-bundle-load,
  // inside the Next.js instrumentation hook) is the recommended pattern.
  try {
    const Sentry = await import('@sentry/nextjs');
    const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!SENTRY_DSN) {
      console.warn('[Sentry] SENTRY_DSN not configured - server error tracking disabled');
    }
    Sentry.init({
      dsn: SENTRY_DSN || undefined,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
      initialScope: {
        tags: { component: 'backend', runtime: 'node' },
      },
      beforeSend(event) {
        if (event.exception) {
          event.extra = {
            ...event.extra,
            nodeVersion: process.version,
            platform: process.platform,
          };
        }
        return event;
      },
      ignoreErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'],
    });
    console.log('[sentry] Initialized successfully');
  } catch (sentryErr) {
    console.warn('[sentry] Init failed:', sentryErr instanceof Error ? sentryErr.message : String(sentryErr));
  }

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

  // Verify database connectivity at startup — fire-and-forget with a 3 s cap.
  //
  // WHY fire-and-forget: register() blocks the Lambda cold start. An unbounded
  // await here caused all Node.js Lambda functions to hang for 10 s+ (the full
  // pg connectionTimeoutMillis) before responding to any request, making every
  // cold-start smoke-test fail with a 10 s abort. Serverless Lambdas must start
  // fast; move the DB check off the critical path.
  //
  // The 3 s timeout is a safety belt — if the pg pool connects quickly the log
  // still fires; if it takes longer we log a warning and move on.
  if (process.env.DATABASE_URL) {
    const dbCheckPromise = (async () => {
      try {
        const { prisma } = await import(/* webpackIgnore: true */ '@/lib/prisma');
        if (prisma) {
          await prisma.$queryRaw`SELECT 1`;
          console.log('[db-check] Database connection verified successfully');
        }
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`[db-check] Database connection check failed: ${msg}`);
      }
    })();

    // Race against a 3 s guard — startup must not block on DB latency.
    await Promise.race([
      dbCheckPromise,
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn('[db-check] Database check exceeded 3 s — proceeding with startup');
          resolve();
        }, 3000)
      ),
    ]);
  }
}
