/**
 * The setup CLI reads its options strictly, before the database is touched:
 * a missing option value never turns an undo into an apply.
 */
const mockApply = jest.fn();
const mockUndo = jest.fn();
const mockUserFind = jest.fn();
jest.mock('../../../lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFind(...a) },
    $disconnect: jest.fn(async () => undefined),
  },
}));
jest.mock('../../../lib/marketing-calendar/portfolio-seed', () => ({
  applyPortfolioSetup: (...a: unknown[]) => mockApply(...a),
  undoPortfolioSetup: (...a: unknown[]) => mockUndo(...a),
}));

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PortfolioArgsError,
  assertManifestPathFree,
  parsePortfolioArgs,
  saveManifestFile,
} from '@/lib/marketing-calendar/portfolio-args';

const tempDir = () => mkdtempSync(join(tmpdir(), 'portfolio-args-'));

describe('parsePortfolioArgs', () => {
  it('reads write, undo and manifest', () => {
    expect(parsePortfolioArgs([])).toEqual({ write: false });
    expect(
      parsePortfolioArgs([
        '--undo',
        'm.json',
        '--write',
        '--manifest',
        'out.json',
      ])
    ).toEqual({ write: true, undoPath: 'm.json', manifestPath: 'out.json' });
  });

  it.each([
    [['--undo']],
    [['--undo', '--write']],
    [['--undo', '']],
    [['--write', '--manifest']],
    [['--manifest', '--undo', 'm.json']],
    [['--undo', 'a.json', '--undo', 'b.json']],
    [['--undo=m.json']],
    [['--wrte']],
    [['--write', '--write']],
  ])('refuses %j', args => {
    expect(() => parsePortfolioArgs(args)).toThrow(PortfolioArgsError);
  });
});

describe('manifest file', () => {
  it('never replaces an earlier manifest at the same path', () => {
    const path = join(tempDir(), 'records.json');
    const first = saveManifestFile(path, '{"run":1}');
    const second = saveManifestFile(path, '{"run":2}');
    expect(first).toBe(path);
    expect(second).toBe(path.replace(/\.json$/, '.1.json'));
    expect(readFileSync(path, 'utf8')).toBe('{"run":1}');
    expect(readFileSync(second, 'utf8')).toBe('{"run":2}');
  });

  it('refuses a path that already holds a file', () => {
    const path = join(tempDir(), 'records.json');
    expect(() => assertManifestPathFree(path)).not.toThrow();
    writeFileSync(path, '{}');
    expect(() => assertManifestPathFree(path)).toThrow(/already exists/);
  });
});

describe('seed CLI', () => {
  const run = (args: string[]) => {
    const argv = process.argv;
    process.argv = ['node', 'seed', ...args];
    try {
      jest.isolateModules(() => {
        require('../../../scripts/seed-portfolio-marketing-calendar');
      });
    } finally {
      process.argv = argv;
    }
  };

  it.each([[['--undo', '--write']], [['--write', '--manifest']]])(
    'stops %j before any database call',
    args => {
      expect(() => run(args)).toThrow(/needs a file path/);
      expect(mockUserFind).not.toHaveBeenCalled();
      expect(mockApply).not.toHaveBeenCalled();
      expect(mockUndo).not.toHaveBeenCalled();
    }
  );

  it('stops a write run aimed at an existing manifest before any database call', () => {
    const path = join(tempDir(), 'records.json');
    writeFileSync(path, '{"posts":["p1"]}');
    expect(() => run(['--write', '--manifest', path])).toThrow(
      /already exists/
    );
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockApply).not.toHaveBeenCalled();
    expect(readFileSync(path, 'utf8')).toBe('{"posts":["p1"]}');
  });
});
