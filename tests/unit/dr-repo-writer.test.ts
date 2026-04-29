/**
 * Unit tests for lib/dr-repo-writer/
 *
 * Covers:
 *  - page-renderer: produces compilable Next page source, escapes JSON-LD
 *  - pathForLandingPage: maps slug → app/<slug>/page.tsx
 *  - saveLandingPageToDrRepo: create (no existing file), update (sha passed),
 *    unchanged (skip commit), failure (returns ok=false)
 *  - saveSitemapXmlToDrRepo: same idempotency as landing pages
 *  - loadCurrentSitemapXmlFromDrRepo: returns '' on 404
 *
 * @see SYN-834 (epic — Track 2 ship-now)
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  pathForLandingPage,
  renderLandingPageSource,
  saveLandingPageToDrRepo,
  saveSitemapXmlToDrRepo,
  loadCurrentSitemapXmlFromDrRepo,
  type GitHubClient,
  type GitHubFileGetResult,
  type GitHubRepoCoords,
} from '@/lib/dr-repo-writer';
import type { BuildLandingPageResult } from '@/lib/landing-page';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function fakePage(
  overrides: Partial<BuildLandingPageResult> = {}
): BuildLandingPageResult {
  return {
    slug: 'water-damage/brisbane-cbd',
    canonicalUrl: 'https://disasterrecovery.com.au/water-damage/brisbane-cbd/',
    html: '<article><h1>Water damage in Brisbane CBD</h1></article>',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'LocalBusiness', name: 'DR' }],
    },
    validations: [],
    ok: true,
    ...overrides,
  };
}

function makeFakeClient(
  initialFiles: Record<string, string> = {}
): GitHubClient & {
  _files: Record<string, string>;
  _puts: Array<{
    path: string;
    content: string;
    sha?: string;
    message: string;
  }>;
  failOnPut?: boolean;
} {
  const files = { ...initialFiles };
  const puts: Array<{
    path: string;
    content: string;
    sha?: string;
    message: string;
  }> = [];
  const obj: GitHubClient & {
    _files: Record<string, string>;
    _puts: typeof puts;
    failOnPut?: boolean;
  } = {
    _files: files,
    _puts: puts,
    async getFile(_coords: GitHubRepoCoords, path: string) {
      if (!(path in files)) return null;
      const content = files[path];
      return {
        content,
        sha: `sha-${path}-${content.length}`,
      } as GitHubFileGetResult;
    },
    async putFile(
      _coords: GitHubRepoCoords,
      path: string,
      content: string,
      message: string,
      sha?: string
    ) {
      if (obj.failOnPut) {
        return { ok: false, reason: '500 forbidden by fake' };
      }
      puts.push({ path, content, sha, message });
      files[path] = content;
      return { ok: true, commitSha: `commit-${puts.length}` };
    },
  };
  return obj;
}

describe('pathForLandingPage', () => {
  it('maps slug to app/<slug>/page.tsx', () => {
    expect(pathForLandingPage(fakePage())).toBe(
      'app/water-damage/brisbane-cbd/page.tsx'
    );
  });
});

describe('renderLandingPageSource', () => {
  it('produces a Next page string with JSON-LD + HTML', () => {
    const src = renderLandingPageSource(fakePage());
    expect(src).toContain('export default function Page()');
    expect(src).toContain('application/ld+json');
    expect(src).toContain('Brisbane CBD');
    expect(src).toContain('canonical');
  });

  it('neutralises a </script> injection in JSON-LD via \\u003c escaping', () => {
    const src = renderLandingPageSource(
      fakePage({
        jsonLd: { '@type': 'X', danger: '</script><script>alert(1)</script>' },
      })
    );
    // The literal substring "</script>" must NOT appear in the JSON-LD
    // injection point — it should be escaped to </script>.
    const jsonLdStart = src.indexOf('application/ld+json');
    const divStart = src.indexOf('<div ', jsonLdStart);
    const ldChunk = src.slice(jsonLdStart, divStart);
    expect(ldChunk).not.toContain('</script>');
    expect(ldChunk).toContain('u003c/script');
  });

  it('embeds the canonical URL in metadata', () => {
    const src = renderLandingPageSource(fakePage());
    expect(src).toContain(
      '"https://disasterrecovery.com.au/water-damage/brisbane-cbd/"'
    );
  });
});

describe('saveLandingPageToDrRepo', () => {
  it('CREATEs the file when it does not exist (no sha passed)', async () => {
    const client = makeFakeClient();
    const result = await saveLandingPageToDrRepo(fakePage(), { client });
    expect(result.ok).toBe(true);
    expect(result.commitSha).toBeDefined();
    expect(client._puts).toHaveLength(1);
    expect(client._puts[0].path).toBe('app/water-damage/brisbane-cbd/page.tsx');
    expect(client._puts[0].sha).toBeUndefined();
    expect(client._puts[0].message).toMatch(/SYN-834 add/);
  });

  it('UPDATEs the file when it exists (sha passed, message=update)', async () => {
    const client = makeFakeClient({
      'app/water-damage/brisbane-cbd/page.tsx': 'old content here',
    });
    const result = await saveLandingPageToDrRepo(fakePage(), { client });
    expect(result.ok).toBe(true);
    expect(client._puts).toHaveLength(1);
    expect(client._puts[0].sha).toMatch(/^sha-/);
    expect(client._puts[0].message).toMatch(/SYN-834 update/);
  });

  it('returns unchanged=true and skips commit when content is identical', async () => {
    const page = fakePage();
    const renderedSource = renderLandingPageSource(page);
    const client = makeFakeClient({
      [pathForLandingPage(page)]: renderedSource,
    });
    const result = await saveLandingPageToDrRepo(page, { client });
    expect(result.ok).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(client._puts).toHaveLength(0);
  });

  it('returns ok=false with reason when GitHub PUT fails', async () => {
    const client = makeFakeClient();
    client.failOnPut = true;
    const result = await saveLandingPageToDrRepo(fakePage(), { client });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/500 forbidden/);
  });
});

describe('saveSitemapXmlToDrRepo', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

  it('CREATEs sitemap.xml when missing', async () => {
    const client = makeFakeClient();
    const result = await saveSitemapXmlToDrRepo(xml, { client });
    expect(result.ok).toBe(true);
    expect(client._puts).toHaveLength(1);
    expect(client._puts[0].path).toBe('public/sitemap.xml');
    expect(client._puts[0].sha).toBeUndefined();
  });

  it('UPDATEs sitemap.xml when content changed', async () => {
    const client = makeFakeClient({ 'public/sitemap.xml': 'old xml' });
    const result = await saveSitemapXmlToDrRepo(xml, { client });
    expect(result.ok).toBe(true);
    expect(client._puts[0].sha).toMatch(/^sha-/);
  });

  it('skips commit when sitemap content is identical (unchanged)', async () => {
    const client = makeFakeClient({ 'public/sitemap.xml': xml });
    const result = await saveSitemapXmlToDrRepo(xml, { client });
    expect(result.ok).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(client._puts).toHaveLength(0);
  });
});

describe('loadCurrentSitemapXmlFromDrRepo', () => {
  it('returns the file content when present', async () => {
    const client = makeFakeClient({ 'public/sitemap.xml': '<urlset/>' });
    const result = await loadCurrentSitemapXmlFromDrRepo({ client });
    expect(result).toBe('<urlset/>');
  });

  it("returns '' when the file does not exist (404 → null)", async () => {
    const client = makeFakeClient();
    const result = await loadCurrentSitemapXmlFromDrRepo({ client });
    expect(result).toBe('');
  });
});
