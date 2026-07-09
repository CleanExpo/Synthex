/**
 * Wiki-signal dry run — Flywheel C1 acceptance proof.
 *
 * Fetches the live brain-1 signal pages, parses them exactly as the sweep
 * would, and prints the signals per org WITHOUT touching the database.
 *
 * Usage:
 *   BRAIN1_REPO=CleanExpo/brain-1 BRAIN1_GITHUB_TOKEN=$(gh auth token) \
 *     npx tsx scripts/hermes-wiki-signal-dryrun.ts
 */

import {
  BRAND_TO_ORG_SLUG,
  buildWikiSignals,
  fetchRecentSignalPages,
} from '../lib/hermes/discovery/wiki-signal';

async function main(): Promise<void> {
  const repo = process.env.BRAIN1_REPO;
  const token = process.env.BRAIN1_GITHUB_TOKEN;
  if (!repo || !token) {
    console.error(
      'Set BRAIN1_REPO and BRAIN1_GITHUB_TOKEN (e.g. $(gh auth token)).'
    );
    process.exit(1);
  }

  const pages = await fetchRecentSignalPages({ repo, token });
  console.log(`Fetched ${pages.length} recent signal page(s):`);
  for (const page of pages) console.log(`  ${page.path} (brand=${page.brand})`);

  const orgSlugs = [...new Set(Object.values(BRAND_TO_ORG_SLUG))].filter(
    (slug): slug is string => slug !== null
  );

  let total = 0;
  for (const orgSlug of orgSlugs) {
    const signals = buildWikiSignals({
      organizationId: `dry-run-${orgSlug}`,
      orgSlug,
      pages,
      existingHashes: new Set(),
    });
    total += signals.length;
    console.log(`\n${orgSlug}: ${signals.length} signal(s)`);
    for (const signal of signals.slice(0, 3)) {
      const text = String(signal.payload.text);
      console.log(
        `  - [${String(signal.payload.heading ?? 'no heading')}] ${text.slice(0, 110)}…`
      );
    }
    if (signals.length > 3) console.log(`  … +${signals.length - 3} more`);
  }
  console.log(
    `\nTOTAL: ${total} signals across ${orgSlugs.length} orgs (dry run — nothing written).`
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
