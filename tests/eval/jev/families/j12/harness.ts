/**
 * J12 golden-regression harness.
 *
 * A GoldenCase re-checks one fixed bug at HEAD: it cites the fixing commit,
 * states the property, and decides PASS/FAIL by code. `load()` turns an
 * import-time throw into Inconclusive so a module that cannot load is never
 * read as PASS.
 */
import { isDeepStrictEqual, inspect } from 'util';

export interface Verdict {
  pass: boolean;
  detail: string;
}

export interface GoldenCase {
  /** Stable slug; the case id is J12-<slug>. */
  slug: string;
  /** Fixing commit (abbreviated sha from git log). */
  sha: string;
  /** The fixed behaviour this case asserts at HEAD. */
  property: string;
  /** Repo path of the code under test (route file or lib module). */
  target: string;
  run: () => Verdict | Promise<Verdict>;
}

/** The check could not run (import throw, missing env); never PASS. */
export class Inconclusive extends Error {}

export function load<T = Record<string, unknown>>(modulePath: string): T {
  try {
    return require(modulePath) as T;
  } catch (err) {
    const msg =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new Inconclusive(`import ${modulePath} failed: ${msg.slice(0, 300)}`);
  }
}

function fmt(v: unknown): string {
  return inspect(v, { depth: 3, breakLength: Infinity }).slice(0, 160);
}

/** [label, actual, expected] triples compared with deep strict equality. */
export type Check = [string, unknown, unknown];

export function verdict(checks: Check[]): Verdict {
  const bad = checks.filter(
    ([, actual, want]) => !isDeepStrictEqual(actual, want)
  );
  if (bad.length === 0)
    return { pass: true, detail: `${checks.length} checks ok` };
  return {
    pass: false,
    detail: bad
      .map(([l, a, e]) => `${l}: got ${fmt(a)} want ${fmt(e)}`)
      .join('; '),
  };
}

/** Run fn and report whether it threw (and the message). */
export async function throws(fn: () => unknown): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Run with process.env temporarily patched (undefined deletes the key). */
export async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => T | Promise<T>
): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
