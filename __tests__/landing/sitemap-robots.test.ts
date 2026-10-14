/**
 * The sitemap must not advertise a URL that robots.txt tells crawlers to skip.
 *
 * /signup was listed in the sitemap while `Disallow: /signup` sat in robots —
 * a contradiction Search Console reports as "Submitted URL blocked by
 * robots.txt". This pins the two files to agree for the default (`*`) agent.
 */

const mockFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { blogPost: { findMany: mockFindMany } },
}));

import robots from '../../app/robots';
import sitemap from '../../app/sitemap';

function defaultDisallows(): string[] {
  const { rules } = robots();
  const list = Array.isArray(rules) ? rules : [rules];
  const star = list.find(rule => rule.userAgent === '*');
  const disallow = star?.disallow ?? [];
  return Array.isArray(disallow) ? disallow : [disallow];
}

describe('sitemap ↔ robots agreement', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it('lists no URL that the default robots rule disallows', async () => {
    const disallowed = defaultDisallows();
    expect(disallowed).toContain('/signup');

    const blocked = (await sitemap())
      .map(entry => new URL(entry.url).pathname)
      .filter(path => disallowed.some(prefix => path.startsWith(prefix)));

    expect(blocked).toEqual([]);
  });

  it('lists the /compare and /add-ons index pages', async () => {
    const paths = (await sitemap()).map(entry => new URL(entry.url).pathname);
    expect(paths).toEqual(expect.arrayContaining(['/compare', '/add-ons']));
  });
});
