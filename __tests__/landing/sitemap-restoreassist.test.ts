/**
 * Sitemap coverage for the RestoreAssist landing pages.
 *
 * Both pages set `robots: index, follow` and a canonical under this origin, but
 * neither appeared in the sitemap — indexable pages that nothing points at.
 * These assertions keep them listed.
 *
 * The suite also pins the two properties that make a sitemap useful rather than
 * merely present: every entry is an absolute URL on this origin, and no URL is
 * listed twice.
 */

const mockFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { blogPost: { findMany: mockFindMany } },
}));

import sitemap from '../../app/sitemap';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

describe('sitemap — RestoreAssist pages', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it('lists both RestoreAssist landing pages', async () => {
    const entries = await sitemap();
    const urls = entries.map(entry => entry.url);

    expect(urls).toContain(`${BASE_URL}/restoreassist/pricing`);
    expect(urls).toContain(`${BASE_URL}/restoreassist/insurers`);
  });

  it('gives the pricing page conversion-tier priority', async () => {
    const entries = await sitemap();
    const pricing = entries.find(
      entry => entry.url === `${BASE_URL}/restoreassist/pricing`
    );
    const insurers = entries.find(
      entry => entry.url === `${BASE_URL}/restoreassist/insurers`
    );

    expect(pricing?.priority).toBe(0.8);
    expect(insurers?.priority).toBe(0.7);
    expect(pricing?.changeFrequency).toBe('monthly');
  });

  it('lists no URL twice', async () => {
    const urls = (await sitemap()).map(entry => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('emits absolute URLs on this origin only', async () => {
    const urls = (await sitemap()).map(entry => entry.url);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach(url =>
      expect(url.startsWith(`${BASE_URL}/`) || url === BASE_URL).toBe(true)
    );
  });

  it('still lists the RestoreAssist pages when the blog query fails', async () => {
    // The sitemap degrades gracefully if the DB is unavailable; the static
    // entries must survive that path, not just the happy one.
    mockFindMany.mockRejectedValue(new Error('db down'));

    const urls = (await sitemap()).map(entry => entry.url);
    expect(urls).toContain(`${BASE_URL}/restoreassist/pricing`);
    expect(urls).toContain(`${BASE_URL}/restoreassist/insurers`);
  });
});
