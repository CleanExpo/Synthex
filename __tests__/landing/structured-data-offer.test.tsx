/**
 * Structured data must not advertise a price the business has not set.
 *
 * The home SoftwareApplication carried `offers: { price: '0' }` described as
 * "Controlled pilot access", which tells search and answer engines the product
 * is free. The parent organisation also pointed at https://unite-group.com.au,
 * which does not resolve. Neither is replaced with an invented value.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { HomeStructuredData } from '@/components/seo/StructuredData';
import { SynthexStructuredData } from '@/components/seo/SynthexStructuredData';

const ROOT = path.join(__dirname, '../..');
const DEAD_PARENT_URL = 'https://unite-group.com.au';

function jsonLd(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll('script[type="application/ld+json"]')
  ).map(script => script.innerHTML);
}

describe.each([
  ['HomeStructuredData', HomeStructuredData],
  ['SynthexStructuredData', SynthexStructuredData],
])('%s', (_name, Component) => {
  const blocks = jsonLd(render(<Component />).container);

  it('renders JSON-LD', () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('carries no Offer or price', () => {
    for (const block of blocks) {
      expect(block).not.toMatch(/"offers"|"price"/);
    }
  });

  it('does not link the parent organisation to a dead domain', () => {
    for (const block of blocks) {
      expect(block).not.toContain(DEAD_PARENT_URL);
    }
  });
});

describe.each(['public/llms.txt', 'app/layout.tsx'])('%s', file => {
  it('does not link the parent organisation to a dead domain', () => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    expect(source).not.toContain(DEAD_PARENT_URL);
  });
});
