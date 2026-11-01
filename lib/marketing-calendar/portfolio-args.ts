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

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

/** Refuses a manifest path that already holds a file, before any write. */
export function assertManifestPathFree(path: string) {
  if (existsSync(path))
    throw new PortfolioArgsError(
      `manifest ${path} already exists: an earlier run's undo record is never replaced, choose a new path`
    );
}

/**
 * Writes a manifest without replacing any file: if the path was taken since
 * it was checked, the next free sibling (name.1.json, name.2.json, ...) is
 * used. Returns the path written.
 */
export function saveManifestFile(path: string, json: string): string {
  mkdirSync(dirname(path), { recursive: true });
  for (let n = 0; n < 1000; n++) {
    const target = n === 0 ? path : path.replace(/(\.json)?$/, `.${n}$1`);
    try {
      writeFileSync(target, json, { flag: 'wx' });
      return target;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`no free manifest path next to ${path}`);
}
