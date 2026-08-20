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
      .catch(() => undefined);
  } catch {
    void 0;
  }

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
    void 0;
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    return;
  }

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

  try {
    const { validateEnv, SecurityLevel } = await import('@/lib/env');

    const result = validateEnv();

    const criticalErrors = result.errors.filter(
      e => e.securityLevel === SecurityLevel.CRITICAL
    );
    const nonCriticalErrors = result.errors.filter(
      e => e.securityLevel !== SecurityLevel.CRITICAL
    );

    console.info(
      `[env-validator] Validated ${result.configured.length}/${result.configured.length + result.errors.length} env vars`
    );

    for (const error of nonCriticalErrors) {
      console.warn(
        `[env-validator] WARNING: ${error.key} - ${error.message}${error.suggestion ? ` (${error.suggestion})` : ''}`
      );
    }

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
      return;
    }

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

  try {
    const { validateEncryptionKeys } =
      await import('@/lib/security/encryption-keys');
    const report = validateEncryptionKeys();

    if (report.ok) {
      console.info(
        '[encryption-keys] All encryption keys passed format + round-trip self-test'
      );
    } else {
      for (const check of report.checks) {
        if (!check.ok) {
          console.error(
            `[encryption-keys] CRITICAL: ${check.key} (${check.purpose}) — ${check.reason}`
          );
        }
      }
      console.error(
        `[encryption-keys] ${report.failedRequired.length} encryption key(s) failed self-test ` +
          `(${report.failedRequired.join(', ')}). A wrong/rotated key SILENTLY DROPS every ` +
          `connected account — stored tokens cannot be decrypted. Fix these immediately. ` +
          `Server is starting anyway; connection reads will report a key mismatch.`
      );
    }
  } catch (selfTestError) {
    const msg =
      selfTestError instanceof Error
        ? selfTestError.message
        : String(selfTestError);
    console.error(
      `[encryption-keys] Self-test module failed to load or run: ${msg}`
    );
  }

  try {
    const { bootstrapNrpgPipeline } =
      await import('@/app/lib/nrpg-pipeline-bootstrap');
    bootstrapNrpgPipeline();
  } catch (bootErr) {
    const msg = bootErr instanceof Error ? bootErr.message : String(bootErr);
    console.error(`[nrpg-pipeline] bootstrap failed: ${msg}`);
  }
}
