/**
 * Dataset loader for the AU postcode CSV.
 *
 * Lazy load on first call · cached singleton in memory thereafter ·
 * read via `fs.readFile` so the 8.4MB CSV stays OUT of the JS bundle.
 *
 * Source: https://github.com/matthewproctor/australianpostcodes (MIT licence)
 * Bundled at `lib/postcode/data/au-postcodes.csv` for stable offline access.
 *
 * @see SYN-835 (parent: SYN-834 epic)
 * @see lib/postcode/README.md (license attribution)
 */

// `fs/promises` and `path` are loaded lazily inside the functions that need
// them. Top-level import was rejected by the webpack Edge bundle compilation
// (instrumentation.ts → nrpg-pipeline-bootstrap → here is in the Edge graph
// even though it only runs on Node). Lazy require keeps the static analysis
// clean while preserving the same runtime behaviour.

import type { PostcodeDatasetRow } from './types';

/**
 * Default CSV location, relative to project root via `process.cwd()`.
 *
 * Works in:
 * - Jest (cwd = repo root)
 * - Next.js dev server (cwd = repo root)
 * - Vercel serverless (cwd = function root; the CSV is included via Next's
 *   outputFileTracingIncludes config — see next.config.mjs)
 *
 * Override via `AU_POSTCODES_CSV_PATH` env var or by passing `datasetPath`
 * explicitly to {@link loadDataset}.
 */
// `eval('require')` so webpack can't statically resolve these Node-only
// modules during Edge bundle compilation. They are only ever called from
// the Node runtime (instrumentation.ts gates on NEXT_RUNTIME === 'nodejs'
// before importing the bootstrap chain that reaches this file).
//
// SYN-907 was opened by Pi-SEO flagging this `eval()` as a "dangerous
// pattern". After investigation it is a FALSE POSITIVE — the string passed
// to eval is a hardcoded literal `'require'`, never user input, zero
// exploit surface. Attempts to rewrite this:
//   - `import { createRequire } from 'node:module'` (top-level) → webpack
//     UnhandledSchemeError on `node:` URI in the Edge bundle.
//   - Dynamic `await import('node:fs/promises')` / `import('node:path')` →
//     same UnhandledSchemeError.
//   - Dynamic `await import('fs/promises')` (no `node:` prefix) → webpack
//     "Module not found" because the file is traced through instrumentation.ts
//     into the Edge graph where fs is genuinely unavailable.
//   - `new Function('return require')()` → returns global require which is
//     undefined in this ESM project.
// `eval('require')` is the ONLY pattern that hides the require call from
// webpack's static analysis while still resolving correctly at Node runtime.
// Replacing it would require restructuring the instrumentation.ts →
// nrpg-pipeline-bootstrap → here import chain so this file is no longer
// traced into the Edge graph — out of scope for SYN-907.
const nodeRequire = eval('require') as NodeRequire;

function getDefaultDatasetPath(): string {
  if (process.env.AU_POSTCODES_CSV_PATH)
    return process.env.AU_POSTCODES_CSV_PATH;
  const { resolve } = nodeRequire('path') as typeof import('path');
  return resolve(process.cwd(), 'lib', 'postcode', 'data', 'au-postcodes.csv');
}

let _cached: ReadonlyArray<PostcodeDatasetRow> | null = null;
let _loadPromise: Promise<ReadonlyArray<PostcodeDatasetRow>> | null = null;

/**
 * Parse one CSV line into a {@link PostcodeDatasetRow}.
 * Returns null if the row is malformed or has invalid coords (skip-not-throw).
 *
 * Matthew Proctor schema (relevant columns by index):
 *   0=id, 1=postcode, 2=locality, 3=state, 4=long, 5=lat, ...
 *
 * Quoted values use double-quotes around every field.
 */
export function parseCsvLine(line: string): PostcodeDatasetRow | null {
  if (!line || line.trim().length === 0) return null;

  // Lightweight split that respects "double-quoted" fields (no embedded commas
  // or escaped quotes in this dataset, so a tracked quote-state is enough).
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cols.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cols.push(cur);

  if (cols.length < 6) return null;
  const postcode = cols[1]?.trim();
  const locality = cols[2]?.trim();
  const state = cols[3]?.trim();
  const longStr = cols[4]?.trim();
  const latStr = cols[5]?.trim();
  if (!postcode || !locality || !state || !longStr || !latStr) return null;

  const lng = Number(longStr);
  const lat = Number(latStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // Many rows in the dataset are at (0, 0) — skip those (geocoding-failed sentinels).
  if (lat === 0 && lng === 0) return null;

  return { postcode, suburb: locality, state, lat, lng };
}

/**
 * Parse the full CSV body into rows. Skips header row + malformed rows.
 * Pure function — does no I/O.
 */
export function parseCsv(csvBody: string): ReadonlyArray<PostcodeDatasetRow> {
  const lines = csvBody.split(/\r?\n/);
  const rows: PostcodeDatasetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // i=0 is the header
    const row = parseCsvLine(lines[i]);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Lazy-load the AU postcode dataset.
 * - First call: reads the CSV from disk + parses + caches.
 * - Subsequent calls: returns cached array.
 * - Concurrent first-calls share the same promise (no double-load).
 *
 * @param datasetPath Override for tests. Production uses the bundled CSV.
 */
export async function loadDataset(
  datasetPath?: string
): Promise<ReadonlyArray<PostcodeDatasetRow>> {
  if (_cached !== null) return _cached;
  if (_loadPromise !== null) return _loadPromise;

  const path = datasetPath ?? getDefaultDatasetPath();

  _loadPromise = (async () => {
    const { readFile } = nodeRequire(
      'fs/promises'
    ) as typeof import('fs/promises');
    const csv = await readFile(path, 'utf-8');
    const rows = parseCsv(csv);
    _cached = rows;
    _loadPromise = null;
    return rows;
  })();

  return _loadPromise;
}

/**
 * For tests only: reset the cached singleton between cases.
 * @internal
 */
export function _resetDatasetCacheForTests(): void {
  _cached = null;
  _loadPromise = null;
}
