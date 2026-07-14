/**
 * Server-side Sentry capture (SDK-free, cold-start-safe) — P1 observability.
 *
 * WHY THIS EXISTS / WHY NOT @sentry/nextjs:
 * The team disabled server-side Sentry because `@sentry/nextjs` (and
 * `@sentry/node`) register `require-in-the-middle` / `import-in-the-middle`
 * OpenTelemetry hooks **synchronously at module-evaluation time**. That blocks
 * the Node.js Lambda event loop for 10+ seconds on every cold start (confirmed
 * Phase 114-02), so `Sentry.init()` was removed from `instrumentation.ts` and
 * the webpack plugin was removed from `next.config.mjs`. The result: the whole
 * server flew blind on silent cron / token-refresh / publish failures.
 *
 * This module restores real server-side capture WITHOUT re-introducing that
 * hang. It speaks the Sentry "envelope" ingest protocol directly over plain
 * `fetch()` — exactly like the existing `reportToAxiom()` transport in
 * `error-tracker.ts`. There is NO SDK import, so there are NO OTel hooks and NO
 * cold-start cost. Nothing runs until the first error is actually captured.
 *
 * DESIGN CONTRACT:
 *  - DSN-gated: when `SENTRY_DSN` is unset/blank this is a complete no-op. Local
 *    and dev runs are never affected and nothing is sent.
 *  - Fire-and-forget: `captureServerException()` returns immediately; the
 *    network POST is detached and never blocks or fails the caller.
 *  - Silenced: every internal error is swallowed — observability can never crash
 *    the app it is observing.
 *  - No PII / no secrets: tags + extra are scrubbed (see SCRUB_KEY_PATTERN) so
 *    tokens, refresh tokens, passwords, cookies, and auth headers are redacted.
 *
 * @task SYN-P1 — enable server-side Sentry + alerting on cron/token/publish failures
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentryCaptureContext {
  /** Logical operation, e.g. 'cron/publish-scheduled'. Becomes the `transaction`. */
  operation?: string;
  /** error | warning | fatal | info — maps to Sentry `level`. */
  level?: 'fatal' | 'error' | 'warning' | 'info';
  /** Indexed tags (scrubbed). Keep these low-cardinality + non-sensitive. */
  tags?: Record<string, string | number | boolean | null | undefined>;
  /** Free-form context (scrubbed). Never put tokens/secrets here. */
  extra?: Record<string, unknown>;
  /** Optional fingerprint for grouping. */
  fingerprint?: string[];
}

interface ParsedDsn {
  ingestUrl: string;
  publicKey: string;
  projectId: string;
}

// ---------------------------------------------------------------------------
// PII / secret scrubbing
// ---------------------------------------------------------------------------

/**
 * Keys whose VALUES must never be sent to Sentry. Matched case-insensitively as
 * a substring of the key name, so `accessToken`, `refresh_token`,
 * `AUTHORIZATION`, `apiKey`, `client_secret` etc. are all redacted.
 */
const SCRUB_KEY_PATTERN =
  /(token|secret|password|passwd|cookie|authorization|api[-_]?key|credential|private[-_]?key|session|bearer|encryption[-_]?key|dsn)/i;

const REDACTED = '[redacted]';

/** Recursively redact any sensitive-looking keys in a plain object/array. */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SCRUB_KEY_PATTERN.test(k) ? REDACTED : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// DSN parsing
// ---------------------------------------------------------------------------

/**
 * Parse a classic Sentry DSN of the form:
 *   https://<publicKey>@<host>/<projectId>
 *   https://<publicKey>@<host>/<path>/<projectId>
 * Returns null for missing/invalid DSNs so callers safely no-op.
 */
function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn || !dsn.trim()) return null;
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '').split('/').filter(Boolean).pop();
    if (!publicKey || !projectId) return null;
    // Envelope endpoint: https://<host>/api/<projectId>/envelope/
    const ingestUrl = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
    return { ingestUrl, publicKey, projectId };
  } catch {
    return null;
  }
}

// Cache the parse so we don't re-parse on every capture. `undefined` = not yet
// resolved; `null` = resolved-but-disabled (DSN absent/invalid).
let cachedDsn: ParsedDsn | null | undefined;
let warnedInvalidDsn = false;

function getDsn(): ParsedDsn | null {
  if (cachedDsn === undefined) {
    const raw = process.env.SENTRY_DSN;
    cachedDsn = parseDsn(raw);
    // Distinguish intended-off (unset/blank) from misconfigured (set but
    // unparseable — e.g. a copied placeholder). The latter silently disables
    // server error tracking, so surface it once instead of no-op'ing quietly.
    if (cachedDsn === null && raw && raw.trim() && !warnedInvalidDsn) {
      warnedInvalidDsn = true;
      // No logger import here (avoids a circular dep with observability).
      console.warn(
        '[sentry-server] SENTRY_DSN is set but not a valid DSN — server-side ' +
          'error capture is DISABLED. Check for a placeholder value.'
      );
    }
  }
  return cachedDsn;
}

/** Test-only: reset the memoised DSN so env changes are re-read. */
export function __resetSentryDsnCache(): void {
  cachedDsn = undefined;
}

/** True when a valid DSN is configured (server-side capture is live). */
export function isSentryServerEnabled(): boolean {
  return getDsn() !== null;
}

// ---------------------------------------------------------------------------
// Envelope construction
// ---------------------------------------------------------------------------

function buildEnvelope(
  dsn: ParsedDsn,
  err: Error,
  context: SentryCaptureContext
): string {
  const eventId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '');
  const sentAt = new Date().toISOString();

  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: context.level ?? 'error',
    logger: 'sentry-server',
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production',
    release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined,
    server_name: undefined, // intentionally omitted — avoid leaking host details
    transaction: context.operation,
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message,
          stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
        },
      ],
    },
    tags: scrub(context.tags ?? {}),
    extra: scrub(context.extra ?? {}),
    fingerprint: context.fingerprint,
  };

  const header = JSON.stringify({
    event_id: eventId,
    sent_at: sentAt,
    dsn: process.env.SENTRY_DSN,
  });
  const itemHeader = JSON.stringify({ type: 'event' });
  const payload = JSON.stringify(event);

  return `${header}\n${itemHeader}\n${payload}\n`;
}

/** Minimal stack parser — Sentry tolerates a coarse frame list. */
function parseStack(stack: string): Array<{ filename: string; function?: string }> {
  return stack
    .split('\n')
    .slice(1, 40)
    .map(line => {
      const m = line.trim().match(/at\s+(.*?)\s+\((.*)\)/) || line.trim().match(/at\s+(.*)/);
      if (!m) return null;
      return m[2]
        ? { function: m[1], filename: m[2] }
        : { filename: m[1] };
    })
    .filter((f): f is { filename: string; function?: string } => f !== null)
    .reverse(); // Sentry expects oldest-frame-first
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture a server-side exception to Sentry. Fire-and-forget, DSN-gated no-op.
 *
 * Safe to call from anywhere on the server (cron handlers, token refresh,
 * publish pipeline, onRequestError). Never throws, never blocks, never sends
 * when SENTRY_DSN is unset.
 */
export function captureServerException(
  error: unknown,
  context: SentryCaptureContext = {}
): void {
  const dsn = getDsn();
  if (!dsn) return; // No DSN → safe no-op (local/dev/test)

  const err = error instanceof Error ? error : new Error(String(error));

  // Build + send detached. Any failure (network, parse, etc.) is swallowed.
  try {
    const body = buildEnvelope(dsn, err, context);
    void sendEnvelope(dsn, body);
  } catch {
    // Observability must never crash the caller.
  }
}

/**
 * Capture a server-side message (no exception object). Fire-and-forget.
 */
export function captureServerMessage(
  message: string,
  context: SentryCaptureContext = {}
): void {
  captureServerException(new Error(message), {
    level: context.level ?? 'warning',
    ...context,
  });
}

async function sendEnvelope(dsn: ParsedDsn, body: string): Promise<void> {
  try {
    await fetch(dsn.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth':
          `Sentry sentry_version=7, sentry_client=synthex-server/1.0, ` +
          `sentry_key=${dsn.publicKey}`,
      },
      body,
      // Best-effort: don't hold the Lambda open waiting on Sentry.
      keepalive: true,
    });
  } catch {
    // Swallow — observability failures are non-fatal.
  }
}
