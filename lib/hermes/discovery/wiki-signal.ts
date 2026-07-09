/**
 * HERMES wiki-signal source — Flywheel container C1.
 *
 * Reads the Brain-1 wiki's per-brand signal pages (Wiki/sources/signals-*.md,
 * written by /nexus ingests) via the GitHub contents API and turns each signal
 * bullet into a hermes_discovery_signal row, so ingested estate intelligence
 * feeds the existing gap engine → draft pipeline. This fills the HER-2
 * regulatory/competitor slots with curated signals instead of scrapers.
 *
 * ENVIRONMENT VARIABLES REQUIRED (absent → source no-ops, sweep unaffected):
 * - BRAIN1_REPO: e.g. "CleanExpo/brain-1"
 * - BRAIN1_GITHUB_TOKEN: fine-grained PAT, contents read on that repo
 *
 * Design:
 * - Pure parsing functions exported for unit tests; I/O isolated in the
 *   fetchers. Never throws out of checkWikiSignal — failures are logged and
 *   surfaced through the sweep's failures[] channel by the caller.
 * - Dedup: sha256(orgId + bullet text) stored in payload.hash; existing hashes
 *   for the org are excluded before writing, so re-sweeping an unchanged wiki
 *   writes nothing.
 * - Recency: only pages whose filename date is within WIKI_SIGNAL_MAX_AGE_DAYS.
 */

import { createHash } from 'crypto';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

import type { DiscoveredSignal } from './sweep';

const SIGNALS_DIR = 'Wiki/sources';
const PAGE_PATTERN = /^signals-([a-z0-9-]+?)-(\d{4}-\d{2}-\d{2})\.md$/;
export const WIKI_SIGNAL_MAX_AGE_DAYS = 14;

/** Wiki page brand token → Synthex organization slug. Unmapped brands are
 *  estate-wide/meta pages with no single owning org — they are skipped. */
export const BRAND_TO_ORG_SLUG: Record<string, string | null> = {
  restoreassist: 'restoreassist',
  carsi: 'carsi',
  synthex: 'synthex',
  'synthex-seo': 'synthex',
  'seo-marketing': 'synthex',
  ccw: 'ccw',
  'disaster-recovery': 'disaster-recovery',
  'unite-group': null,
  'ai-tooling': null,
};

export interface WikiSignalBullet {
  text: string;
  heading: string | null;
  sourceUrl: string | null;
}

export interface WikiSignalPage {
  path: string;
  brand: string;
  date: string;
}

/** Parse a signal-page filename; null when it isn't a signals page. */
export function parseSignalPageName(name: string): WikiSignalPage | null {
  const match = name.match(PAGE_PATTERN);
  if (!match) return null;
  return { path: `${SIGNALS_DIR}/${name}`, brand: match[1], date: match[2] };
}

/**
 * Extract top-level signal bullets from a signal page. A signal is a `- `
 * bullet at indent 0; nested bullets are folded into their parent. Headings
 * (`## `) provide context. Frontmatter and the H1 are ignored.
 */
export function parseSignalBullets(markdown: string): WikiSignalBullet[] {
  const bullets: WikiSignalBullet[] = [];
  let heading: string | null = null;
  let current: string[] | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length >= 20) {
      const url = text.match(/https?:\/\/\S+/)?.[0] ?? null;
      bullets.push({ text, heading, sourceUrl: url });
    }
    current = null;
  };

  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    if (/^#{2,3}\s/.test(line)) {
      flush();
      heading = line.replace(/^#{2,3}\s+/, '').trim();
      continue;
    }
    if (/^- /.test(line)) {
      flush();
      current = [line.slice(2).trim()];
      continue;
    }
    if (current && /^\s+\S/.test(line)) {
      current.push(line.trim());
      continue;
    }
    flush();
  }
  flush();
  return bullets;
}

export function wikiSignalHash(organizationId: string, text: string): string {
  return createHash('sha256')
    .update(`${organizationId}\n${text}`)
    .digest('hex');
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.raw+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export interface WikiPageContent extends WikiSignalPage {
  markdown: string;
}

/**
 * List + fetch recent signal pages from the brain-1 repo. Throws on transport
 * errors (caller converts to a sweep failure).
 */
export async function fetchRecentSignalPages(params: {
  repo: string;
  token: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<WikiPageContent[]> {
  const { repo, token, now = new Date(), fetchImpl = fetch } = params;

  const listResponse = await fetchImpl(
    `https://api.github.com/repos/${repo}/contents/${SIGNALS_DIR}`,
    {
      headers: {
        ...githubHeaders(token),
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!listResponse.ok) {
    throw new Error(`brain-1 list failed: ${listResponse.status}`);
  }
  const entries = (await listResponse.json()) as Array<{ name: string }>;

  const cutoff = now.getTime() - WIKI_SIGNAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const recent = entries
    .map(entry => parseSignalPageName(entry.name))
    .filter((page): page is WikiSignalPage => page !== null)
    .filter(page => new Date(page.date).getTime() >= cutoff);

  const pages: WikiPageContent[] = [];
  for (const page of recent) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/contents/${page.path}`,
      { headers: githubHeaders(token) }
    );
    if (!response.ok) {
      logger.warn('[hermes:wiki-signal] page fetch failed — skipping', {
        path: page.path,
        status: response.status,
      });
      continue;
    }
    pages.push({ ...page, markdown: await response.text() });
  }
  return pages;
}

/**
 * Build deduplicated wiki signals for one org from fetched pages.
 * Pure given its inputs; exported for tests.
 */
export function buildWikiSignals(params: {
  organizationId: string;
  orgSlug: string;
  pages: WikiPageContent[];
  existingHashes: Set<string>;
}): DiscoveredSignal[] {
  const { organizationId, orgSlug, pages, existingHashes } = params;
  const signals: DiscoveredSignal[] = [];

  for (const page of pages) {
    const mappedSlug = BRAND_TO_ORG_SLUG[page.brand];
    if (mappedSlug !== orgSlug) continue;

    for (const bullet of parseSignalBullets(page.markdown)) {
      const hash = wikiSignalHash(organizationId, bullet.text);
      if (existingHashes.has(hash)) continue;
      existingHashes.add(hash);
      signals.push({
        organizationId,
        signalType: 'wiki_signal',
        source: page.path,
        payload: {
          hash,
          text: bullet.text,
          heading: bullet.heading,
          sourceUrl: bullet.sourceUrl,
          page: page.path,
          pageDate: page.date,
        },
        severity: 'routine',
      });
    }
  }
  return signals;
}

/**
 * Sweep check: read recent wiki signal pages and return new (deduplicated)
 * signals for this org. No-ops with [] when env is unconfigured or the org
 * has no wiki brand mapping.
 */
export async function checkWikiSignal(
  orgId: string
): Promise<DiscoveredSignal[]> {
  const repo = process.env.BRAIN1_REPO;
  const token = process.env.BRAIN1_GITHUB_TOKEN;
  if (!repo || !token) {
    logger.info(
      '[hermes:wiki-signal] BRAIN1_REPO/BRAIN1_GITHUB_TOKEN unset — skipping',
      {
        orgId,
      }
    );
    return [];
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  const orgSlug = org?.slug;
  if (!orgSlug || !Object.values(BRAND_TO_ORG_SLUG).includes(orgSlug)) {
    return [];
  }

  const pages = await fetchRecentSignalPages({ repo, token });

  const windowStart = new Date(
    Date.now() - 2 * WIKI_SIGNAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );
  const existing = await prisma.hermesDiscoverySignal.findMany({
    where: {
      organizationId: orgId,
      signalType: 'wiki_signal',
      createdAt: { gte: windowStart },
    },
    select: { payload: true },
  });
  const existingHashes = new Set<string>(
    existing
      .map(row => (row.payload as { hash?: string } | null)?.hash)
      .filter((hash): hash is string => typeof hash === 'string')
  );

  return buildWikiSignals({
    organizationId: orgId,
    orgSlug,
    pages,
    existingHashes,
  });
}
