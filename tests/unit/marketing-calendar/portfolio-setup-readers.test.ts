/**
 * The portfolio setup checks (verifyPortfolioSetup) describe each portfolio
 * org's workspace membership, owner access, tier and slot counts, and they
 * read every portfolio draft. Only the owner sees them: every API route that
 * calls verifyPortfolioSetup must check the owner (isOwnerEmail). A public
 * route serving them fails here.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../../..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /^route\.(ts|tsx|js)$/.test(name) ? [p] : [];
  });
}

const readers = walk(join(ROOT, 'app/api'))
  .filter(f => /\bverifyPortfolioSetup\s*\(/.test(readFileSync(f, 'utf8')))
  .map(f => relative(ROOT, f));

describe('routes that serve the portfolio setup checks', () => {
  it('finds the owner route, so the scan reaches real routes', () => {
    expect(readers).toContain('app/api/admin/portfolio-calendar/route.ts');
  });

  it.each(readers)('%s checks the owner', file => {
    expect(readFileSync(join(ROOT, file), 'utf8')).toMatch(/\bisOwnerEmail\(/);
  });
});
