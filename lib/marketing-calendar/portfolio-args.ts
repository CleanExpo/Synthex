/**
 * Command-line options and the undo manifest file for
 * scripts/seed-portfolio-marketing-calendar.ts.
 *
 * Options are parsed before the database is touched, and strictly: an option
 * that takes a value must be given one, so a missing value never turns an
 * undo into an apply or drops the manifest path. Throws on anything it does
 * not know. A manifest file is never replaced: it holds the ids an undo of
 * that run needs.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

export interface PortfolioArgs {
  write: boolean;
  undoPath?: string;
  manifestPath?: string;
}

export class PortfolioArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioArgsError';
  }
}

export function parsePortfolioArgs(args: readonly string[]): PortfolioArgs {
  const parsed: PortfolioArgs = { write: false };
  const valueAfter = (i: number, option: string) => {
    const value = args[i + 1];
    if (value === undefined || value.trim() === '' || value.startsWith('--'))
      throw new PortfolioArgsError(`${option} needs a file path`);
    return value;
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--write') {
      if (parsed.write) throw new PortfolioArgsError('--write given twice');
      parsed.write = true;
    } else if (arg === '--undo' || arg === '--manifest') {
      const key = arg === '--undo' ? 'undoPath' : 'manifestPath';
      if (parsed[key] !== undefined)
        throw new PortfolioArgsError(`${arg} given twice`);
      parsed[key] = valueAfter(i, arg);
      i++;
    } else {
      throw new PortfolioArgsError(`unknown option: ${arg}`);
    }
  }
  return parsed;
}

/** A reserved manifest's content: this run has written no rows yet. */
export const RESERVED_MANIFEST =
  '{"reserved": true, "note": "portfolio setup in progress; no rows written yet"}\n';

/**
 * Reserves the manifest path before any database write by creating the file
 * exclusively. A path that already holds a file, or that cannot hold one
 * (no permission, a parent that is not a directory), fails here, so a run
 * never writes rows it has nowhere to record.
 */
export function reserveManifestFile(path: string): void {
  // Only the exclusive create below can mean "already exists": mkdir also
  // reports EEXIST when a parent is a file, which is "cannot be written".
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, RESERVED_MANIFEST, { flag: 'wx' });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new PortfolioArgsError(
      code === 'EEXIST' && existsSync(path)
        ? `manifest ${path} already exists: an earlier run's undo record is never replaced, choose a new path`
        : `manifest ${path} cannot be written (${code ?? String(err)}): choose a writable path`
    );
  }
}

/** Replaces this run's own reservation with the manifest, never another file. */
export function writeReservedManifest(path: string, json: string): void {
  if (readFileSync(path, 'utf8') !== RESERVED_MANIFEST)
    throw new Error(`manifest ${path} is no longer this run's reservation`);
  // A kill mid-write leaves the reservation or the whole manifest, never half.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, json, { flag: 'wx' });
  renameSync(tmp, path);
}

/** Removes this run's reservation when the run recorded nothing in it. */
export function releaseManifestReservation(path: string): void {
  try {
    if (readFileSync(path, 'utf8') === RESERVED_MANIFEST) unlinkSync(path);
  } catch {
    // Already gone, or never created.
  }
}
