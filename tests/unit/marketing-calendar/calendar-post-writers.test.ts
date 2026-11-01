/**
 * Every code path that writes a calendar draft checks the draft first
 * (assertCalendarPostClean), so no portfolio brand's stored draft names a
 * word that brand never uses. A writer that changes a stored row checks the
 * row as it will be left (assertStoredCalendarPostCleanForOrg), not only the
 * fields it sets. A new writer without the check fails here.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '../../..');
const WRITE = /calendarPost\.(create|createMany|update|updateMany|upsert)\b/;
const UPDATE = /calendarPost\.(update|updateMany|upsert)\b/;

// Writers that never touch a portfolio brand's rows, with the reason.
const EXEMPT: Record<string, string> = {
  'scripts/apply-ccw-eofy-campaign-calendar.ts':
    "writes only CCW's own rows; not a portfolio brand",
  'scripts/finalize-ccw-eofy-campaign-materials.ts':
    "writes only CCW's own rows; not a portfolio brand",
};

// Updaters that check the whole row they read and write only while that row
// is unchanged, with the reason.
const CHECKS_ROW_READ: Record<string, string> = {
  'lib/marketing-calendar/video-delivery.ts':
    'checks the read row with its new metadata; updateMany matches only an unchanged updatedAt',
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
      /\b(assertCalendarPostClean|assertStoredCalendarPostCleanForOrg)\(/
    );
  });

  const updaters = writers.filter(
    w =>
      !EXEMPT[w] &&
      !CHECKS_ROW_READ[w] &&
      UPDATE.test(readFileSync(join(ROOT, w), 'utf8'))
  );

  it('finds the known updaters (the scan is live)', () => {
    expect(updaters).toEqual(
      expect.arrayContaining([
        'lib/content/calendar-service.ts',
        'app/api/approvals/[id]/route.ts',
      ])
    );
  });

  it.each(updaters)('%s checks the stored row it updates', w => {
    expect(readFileSync(join(ROOT, w), 'utf8')).toMatch(
      /\bassertStoredCalendarPostCleanForOrg\(/
    );
  });

  it('every exemption still exists and still writes', () => {
    for (const w of Object.keys(EXEMPT)) expect(writers).toContain(w);
    for (const w of Object.keys(CHECKS_ROW_READ)) expect(writers).toContain(w);
  });
});
