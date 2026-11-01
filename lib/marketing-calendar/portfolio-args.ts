/**
 * Command-line options for scripts/seed-portfolio-marketing-calendar.ts.
 *
 * Parsed before the database is touched, and strict: an option that takes a
 * value must be given one, so a missing value never turns an undo into an
 * apply or drops the manifest path. Throws on anything it does not know.
 */

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
