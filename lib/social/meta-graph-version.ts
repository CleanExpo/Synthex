/**
 * Meta Graph API version — single source of truth.
 *
 * Meta expires each Graph API version ~2 years after its release. Calls to an
 * expired version fail outright, so this MUST be kept current.
 *
 * History (why this file exists): the version was hardcoded as scattered magic
 * strings across ~11 files. v18.0 (expired 2026-01-26) and v19.0 (expired
 * 2026-05-21) were left in place and silently broke Facebook/Instagram
 * publishing in production. Centralizing here means the next bump is one line.
 *
 * Re-bump cadence: review at least annually, or immediately on a Meta changelog
 * deprecation notice. Track current versions at
 * https://developers.facebook.com/docs/graph-api/changelog/versions/
 */
export const META_GRAPH_VERSION = 'v23.0';

/** Base URL for Graph API calls, e.g. `${META_GRAPH_BASE}/me/accounts`. */
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
