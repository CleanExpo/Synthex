/**
 * Every code path that writes a calendar draft checks the draft first
 * (assertCalendarPostClean), so no portfolio brand's stored draft names a
 * word that brand never uses. A new writer without the check fails here.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../../..');
const WRITE = /calendarPost\.(create|createMany|update|updateMany|upsert)\b/;

// Writers that never touch a portfolio brand's rows, with the reason.
const EXEMPT: Record<string, string> = {
  'scripts/apply-ccw-eofy-campaign-calendar.ts':
    "writes only CCW's own rows; not a portfolio brand",
  'scripts/finalize-ccw-eofy-campaign-materials.ts':
    "writes only CCW's own rows; not a portfolio brand",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [p] : [];
  });
}

const writers = ['lib', 'app', 'scripts']
  .flatMap(d => walk(join(ROOT, d)))
  .filter(p => WRITE.test(readFileSync(p, 'utf8')))
  .map(p => relative(ROOT, p));

describe('calendar draft writers', () => {
  it('finds the known writers (the scan is live)', () => {
    expect(writers).toEqual(
      expect.arrayContaining([
        'lib/marketing-calendar/portfolio-seed.ts',
        'lib/marketing-calendar/video-delivery.ts',
        'lib/content/calendar-service.ts',
        'app/api/approvals/[id]/route.ts',
      ])
    );
  });

  it.each(writers.filter(w => !EXEMPT[w]))('%s checks the draft', w => {
    expect(readFileSync(join(ROOT, w), 'utf8')).toMatch(
      /\bassertCalendarPostClean(ForOrg)?\(/
    );
  });

  it('every exemption still exists and still writes', () => {
    for (const w of Object.keys(EXEMPT)) expect(writers).toContain(w);
  });
});
