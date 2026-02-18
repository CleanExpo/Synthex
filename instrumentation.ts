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

  // Verify database connectivity at startup (catches stale credentials immediately)
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import(/* webpackIgnore: true */ 'pg');
      const url = new URL(process.env.DATABASE_URL);
      const pool = new Pool({
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: url.pathname.replace(/^\//, ''),
        user: url.username,
        password: decodeURIComponent(url.password),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        max: 1,
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      console.log('[db-check] Database connection verified successfully');
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      if (msg.includes('SCRAM') || msg.includes('password') || msg.includes('authentication')) {
        console.error(
          `[db-check] DATABASE AUTHENTICATION FAILED: ${msg}\n` +
          `[db-check] ACTION REQUIRED: The database password in DATABASE_URL does not match Supabase.\n` +
          `[db-check] FIX: Go to Supabase Dashboard → Settings → Database → copy the password,\n` +
          `[db-check]      then update DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.\n` +
          `[db-check]      Current DATABASE_URL host: ${new URL(process.env.DATABASE_URL).hostname}`
        );
      } else {
        console.error(`[db-check] Database connection failed: ${msg}`);
      }
      // Don't throw - let the app start so it can serve error pages instead of crashing
    }
  }
}
