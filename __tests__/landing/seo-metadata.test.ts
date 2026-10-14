/**
 * Per-page canonicals and single-brand titles.
 *
 * The root layout used to set `alternates.canonical` to the homepage, which
 * every page without its own canonical inherited — /pricing, /features and
 * /waitlist all told search engines they were duplicates of `/`. Titles were
 * branded twice ("Blog | Synthex | SYNTHEX") because generateMetadata()
 * appended "| Synthex" and the root template appended "| SYNTHEX" again.
 */

import { readFileSync } from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import { generateMetadata } from '@/lib/seo/metadata';

const ROOT = path.join(__dirname, '../..');
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

function absoluteTitle(metadata: Metadata): string | undefined {
  const { title } = metadata;
  return title && typeof title === 'object' && 'absolute' in title
    ? title.absolute
    : undefined;
}

describe('generateMetadata()', () => {
  it('canonicalises a page to its own path', () => {
    const metadata = generateMetadata({
      title: 'Pilot Access',
      path: '/pricing',
    });
    expect(metadata.alternates?.canonical).toBe(`${BASE_URL}/pricing`);
  });

  it('brands a title once and keeps the layout template off it', () => {
    expect(absoluteTitle(generateMetadata({ title: 'Platform' }))).toBe(
      'Platform | Synthex'
    );
  });

  it('does not re-brand a title that already names Synthex', () => {
    expect(
      absoluteTitle(
        generateMetadata({
          title: 'Synthex vs Hootsuite — Why SMBs Switch | Synthex',
        })
      )
    ).toBe('Synthex vs Hootsuite — Why SMBs Switch | Synthex');
  });
});

describe('root layout', () => {
  it('does not set a site-wide canonical', () => {
    const source = readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
    expect(source).not.toMatch(/canonical:/);
  });
});

describe.each([
  ['app/pricing/page.tsx', '/pricing'],
  ['app/features/page.tsx', '/features'],
  ['app/(marketing)/waitlist/layout.tsx', '/waitlist'],
  ['app/compare/page.tsx', '/compare'],
  ['app/add-ons/page.tsx', '/add-ons'],
])('%s', (file, route) => {
  it(`self-canonicalises to ${route} through generateMetadata()`, () => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    expect(source).toMatch(/generateMetadata\(\{/);
    expect(source).toContain(`path: '${route}'`);
  });
});
