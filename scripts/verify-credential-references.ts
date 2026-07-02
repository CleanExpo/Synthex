/**
 * Read-only credential-reference coverage report (SYN-1023).
 *
 * Reports, per client org, whether each known social/analytics account is:
 *   connected_oauth | reference_only | missing
 *
 * This command is REFERENCE-ONLY and READ-ONLY: it never reads, prints, or
 * stores a secret value, and it never writes to the database or 1Password. It
 * exists so an operator can verify credential coverage (and spot missing
 * clients like CCW) without running the importer's live 1Password + DB writes.
 *
 * Usage:
 *   npx tsx scripts/verify-credential-references.ts          # table
 *   npx tsx scripts/verify-credential-references.ts --json   # machine-readable
 */
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import {
  ACCOUNT_REFERENCE_MAPPINGS,
  CREDENTIAL_SEARCH_BLOCKERS,
} from '../lib/credential-intake/account-reference-mappings';
import {
  computeCredentialCoverage,
  type CoverageInput,
} from '../lib/credential-intake/credential-coverage';

loadDotenv({ path: path.join(process.cwd(), '.env.local'), override: true });
loadDotenv({ path: path.join(process.cwd(), '.env') });

const { default: prisma } = await import('../lib/prisma');

async function gatherFacts(): Promise<Pick<CoverageInput, 'connectedByOrg' | 'vaultSlugsByOrg'>> {
  const orgSlugs = Array.from(
    new Set([
      ...ACCOUNT_REFERENCE_MAPPINGS.map((m) => m.orgSlug),
      ...CREDENTIAL_SEARCH_BLOCKERS.map((b) => b.orgSlug),
    ]),
  );

  const orgs = await prisma.organization.findMany({
    where: { slug: { in: orgSlugs } },
    select: { id: true, slug: true },
  });
  const slugById = new Map(orgs.map((o) => [o.id, o.slug]));
  const orgIds = orgs.map((o) => o.id);

  const connectedByOrg: Record<string, string[]> = {};
  const vaultSlugsByOrg: Record<string, string[]> = {};

  if (orgIds.length > 0) {
    // Active OAuth connections — platform only, NO tokens selected.
    const connections = await prisma.platformConnection.findMany({
      where: { organizationId: { in: orgIds }, isActive: true, deletedAt: null },
      select: { organizationId: true, platform: true },
    });
    for (const c of connections) {
      const slug = c.organizationId ? slugById.get(c.organizationId) : undefined;
      if (!slug) continue;
      (connectedByOrg[slug] ??= []).push(c.platform);
    }

    // Reference-only vault entries — slug/provider metadata only, NO value.
    const secrets = await prisma.vaultSecret.findMany({
      where: { organizationId: { in: orgIds }, isActive: true },
      select: { organizationId: true, slug: true },
    });
    for (const s of secrets) {
      const slug = slugById.get(s.organizationId);
      if (!slug) continue;
      (vaultSlugsByOrg[slug] ??= []).push(s.slug);
    }
  }

  return { connectedByOrg, vaultSlugsByOrg };
}

function printTable(report: ReturnType<typeof computeCredentialCoverage>): void {
  const icon: Record<string, string> = {
    connected_oauth: '✅',
    reference_only: '🔑',
    missing: '⛔',
  };
  console.log('\nCredential reference coverage (read-only · no secrets)\n');
  for (const row of report.rows) {
    const where = row.slug ? row.slug : `${row.orgSlug} (no inventory item)`;
    console.log(
      `${icon[row.status]} ${row.status.padEnd(16)} ${row.orgSlug}/${row.provider}  ${where}` +
        (row.reason ? `\n     ↳ ${row.reason}` : ''),
    );
  }
  const { connected_oauth, reference_only, missing } = report.totals;
  console.log(
    `\nTotals: ${connected_oauth} connected · ${reference_only} reference-only · ${missing} missing\n`,
  );
}

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const facts = await gatherFacts();
  const report = computeCredentialCoverage(facts);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTable(report);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Coverage report failed:', error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
