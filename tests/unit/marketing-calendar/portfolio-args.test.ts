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

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PortfolioArgsError,
  RESERVED_MANIFEST,
  parsePortfolioArgs,
  releaseManifestReservation,
  reserveManifestFile,
  writeReservedManifest,
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
  it('reserves a new path, then refuses it to a second run', () => {
    const path = join(tempDir(), 'nested', 'records.json');
    reserveManifestFile(path);
    expect(readFileSync(path, 'utf8')).toBe(RESERVED_MANIFEST);
    expect(() => reserveManifestFile(path)).toThrow(/already exists/);
  });

  it('refuses a path that cannot hold a file, before any write', () => {
    const file = join(tempDir(), 'a-file');
    writeFileSync(file, 'x');
    expect(() => reserveManifestFile(join(file, 'records.json'))).toThrow(
      /cannot be written/
    );
  });

  it('replaces only its own reservation', () => {
    const path = join(tempDir(), 'records.json');
    reserveManifestFile(path);
    writeReservedManifest(path, '{"run":1}');
    expect(readFileSync(path, 'utf8')).toBe('{"run":1}');
    expect(() => writeReservedManifest(path, '{"run":2}')).toThrow(
      /no longer this run's reservation/
    );
    expect(readFileSync(path, 'utf8')).toBe('{"run":1}');
  });

  it('releases an unused reservation and keeps a written manifest', () => {
    const unused = join(tempDir(), 'unused.json');
    reserveManifestFile(unused);
    releaseManifestReservation(unused);
    expect(existsSync(unused)).toBe(false);
    const used = join(tempDir(), 'used.json');
    reserveManifestFile(used);
    writeReservedManifest(used, '{"run":1}');
    releaseManifestReservation(used);
    expect(readFileSync(used, 'utf8')).toBe('{"run":1}');
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

  it('stops a write run whose manifest path cannot be written before any database call', () => {
    const file = join(tempDir(), 'a-file');
    writeFileSync(file, 'x');
    expect(() =>
      run(['--write', '--manifest', join(file, 'records.json')])
    ).toThrow(/cannot be written/);
    expect(mockUserFind).not.toHaveBeenCalled();
    expect(mockApply).not.toHaveBeenCalled();
  });

  describe('a reserved write run', () => {
    const settle = () => new Promise(r => setTimeout(r, 50));
    const env = process.env.DATABASE_URL;
    let exitCode: typeof process.exitCode;
    beforeEach(() => {
      exitCode = process.exitCode;
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      process.env.DATABASE_URL = env;
      process.exitCode = exitCode;
      jest.restoreAllMocks();
    });

    it('records the applied rows in its reserved file', async () => {
      process.env.DATABASE_URL =
        'postgresql://postgres:placeholder@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres';
      mockUserFind.mockResolvedValue({ id: 'owner-1' });
      mockApply.mockResolvedValue({ log: [], createdPostIds: ['p1'] });
      const path = join(tempDir(), 'records.json');
      run(['--write', '--manifest', path]);
      await settle();
      expect(mockApply).toHaveBeenCalledTimes(1);
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
        log: [],
        createdPostIds: ['p1'],
      });
    });

    it('leaves no reservation behind when it stops before writing', async () => {
      process.env.DATABASE_URL = 'postgresql://postgres:x@127.0.0.1:5432/other';
      const path = join(tempDir(), 'records.json');
      run(['--write', '--manifest', path]);
      await settle();
      expect(mockApply).not.toHaveBeenCalled();
      expect(existsSync(path)).toBe(false);
      expect(process.exitCode).toBe(1);
    });
  });
});
