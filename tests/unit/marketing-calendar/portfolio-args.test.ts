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

import {
  PortfolioArgsError,
  parsePortfolioArgs,
} from '@/lib/marketing-calendar/portfolio-args';

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
  ])('refuses %j', args => {
    expect(() => parsePortfolioArgs(args)).toThrow(PortfolioArgsError);
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
});
