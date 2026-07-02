/**
 * Pure helpers for the AI Content Studio connections flow.
 *
 * Extracted from index.tsx so the connection-parsing and auto-select logic is
 * unit-testable independently of React effects. The stale-response guard lives
 * in the effect (closure `cancelled` flag + AbortController); these helpers are
 * the deterministic pieces that run once a response is accepted as current.
 */

import type { ConnectionStatus, ContentFormData } from './types';

/**
 * Normalise a raw `connections` payload into the set of connected platform
 * slugs (lowercased). Defensive against missing/empty payloads.
 */
export function parseConnectedPlatforms(
  connections: ConnectionStatus[] | undefined | null
): Set<string> {
  return new Set<string>(
    (connections ?? [])
      .filter(c => c.connected)
      .map(c => c.platform.toLowerCase())
  );
}

/**
 * Decide the platform to auto-select for the (latest) brand's connections.
 *
 * Keeps the current platform if the brand still has it connected; otherwise
 * picks the first connected platform. Returns the current platform unchanged
 * when the brand has no connections (so we never blank out a valid choice).
 */
export function selectAutoPlatform(
  connected: Set<string>,
  currentPlatform: ContentFormData['platform']
): ContentFormData['platform'] {
  if (connected.size === 0) return currentPlatform;
  if (connected.has(currentPlatform)) return currentPlatform;
  return Array.from(connected)[0] ?? currentPlatform;
}
