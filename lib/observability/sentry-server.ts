/**
 * @deprecated Sentry removed (Jul 2026). Use logger + error-tracker / Axiom instead.
 * Stub kept so existing imports remain stable no-ops.
 */

export interface SentryCaptureContext {
  operation?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

export function __resetSentryDsnCache(): void {}

export function isSentryServerEnabled(): boolean {
  return false;
}

export function captureServerException(
  _error: unknown,
  _context: SentryCaptureContext = {}
): void {}

export function captureServerMessage(
  _message: string,
  _context: SentryCaptureContext = {}
): void {}
