import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type LockPackage = {
  version?: string;
};

type PackageLock = {
  packages?: Record<string, LockPackage>;
};

const MINIMUM_SAFE_SHARP = [0, 35, 0] as const;

function isOlderThanMinimum(version: string): boolean {
  const numericVersion = version.split('-')[0];
  const parts = numericVersion.split('.').map(Number);

  return MINIMUM_SAFE_SHARP.some((minimum, index) => {
    if (parts[index] === minimum) return false;

    return (
      parts[index] < minimum &&
      MINIMUM_SAFE_SHARP.slice(0, index).every(
        (preceding, precedingIndex) => parts[precedingIndex] === preceding
      )
    );
  });
}

describe('sharp dependency security floor', () => {
  it('does not install any sharp version below 0.35.0', () => {
    const lock = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8')
    ) as PackageLock;

    const vulnerableInstalls = Object.entries(lock.packages ?? {})
      .filter(
        ([path, entry]) =>
          path.endsWith('node_modules/sharp') &&
          typeof entry.version === 'string' &&
          isOlderThanMinimum(entry.version)
      )
      .map(([path, entry]) => `${path}@${entry.version}`);

    expect(vulnerableInstalls).toEqual([]);
  });
});
