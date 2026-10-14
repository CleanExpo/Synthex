/**
 * /compare and /add-ons used to have no page.tsx, so production served a raw
 * "Index of /compare/" directory listing. Each now has an index page; this
 * suite fails if a new sub-page is added that its index does not link.
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';

const APP = path.join(__dirname, '../../app');

function subPages(section: string): string[] {
  return readdirSync(path.join(APP, section), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry =>
      existsSync(path.join(APP, section, entry.name, 'page.tsx'))
    )
    .map(entry => `/${section}/${entry.name}`);
}

describe.each(['compare', 'add-ons'])('/%s index', section => {
  const source = readFileSync(path.join(APP, section, 'page.tsx'), 'utf8');

  it('has at least one sub-page to list', () => {
    expect(subPages(section).length).toBeGreaterThan(0);
  });

  it('links every sub-page', () => {
    const unlinked = subPages(section).filter(
      href => !source.includes(`href: '${href}'`)
    );
    expect(unlinked).toEqual([]);
  });

  it('links nothing that does not exist', () => {
    const linked = [...source.matchAll(/href: '([^']+)'/g)].map(m => m[1]);
    expect(linked.sort()).toEqual(subPages(section).sort());
  });
});
