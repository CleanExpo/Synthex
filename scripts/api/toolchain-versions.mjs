/**
 * Shared by gen-openapi.mjs and gen-machine-docs.mjs --check: the generated
 * output depends on the installed zod, typescript and prettier, so a drift
 * verdict is only meaningful when those match package-lock.json. A mismatch
 * (or an unreadable lockfile / missing package) is INCONCLUSIVE, never drift.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PACKAGES = ['zod', 'typescript', 'prettier'];

/**
 * The first installed-vs-lockfile mismatch as a message, or null when all
 * match. The lockfile is <root>/package-lock.json when present, else the one
 * beside the installed node_modules (repoRoot).
 */
export function toolchainMismatch(root, repoRoot) {
  const require = createRequire(path.join(repoRoot, 'package.json'));
  const own = path.join(root, 'package-lock.json');
  const lockPath = fs.existsSync(own)
    ? own
    : path.join(repoRoot, 'package-lock.json');
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (error) {
    return `cannot read ${lockPath}: ${error.message}`;
  }
  for (const pkg of PACKAGES) {
    let installed;
    try {
      installed = require(require.resolve(`${pkg}/package.json`)).version;
    } catch {
      installed = 'missing';
    }
    const locked = lock.packages?.[`node_modules/${pkg}`]?.version ?? 'missing';
    if (installed !== locked)
      return `installed ${pkg} ${installed} != lockfile ${locked}`;
  }
  return null;
}
