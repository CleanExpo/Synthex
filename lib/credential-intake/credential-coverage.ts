/**
 * Credential-coverage report (SYN-1023) — pure, secret-free.
 *
 * Given the canonical 1Password inventory plus secret-free facts read from the
 * DB (which orgs have an active OAuth connection per platform, and which
 * reference-only vault slugs exist), classify each client account as:
 *
 *   - `connected_oauth` — a live platform OAuth connection exists; fully usable.
 *   - `reference_only`  — a 1Password reference is stored but OAuth is not yet
 *                         connected; the operator still needs to connect.
 *   - `missing`         — no reference and no connection (e.g. CCW, not found in
 *                         the 1Password inventory).
 *
 * This function never receives or returns a secret value — only existence and
 * status — so it is safe to log and to render in the product.
 */
import {
  ACCOUNT_REFERENCE_MAPPINGS,
  CREDENTIAL_SEARCH_BLOCKERS,
  type CredentialMapping,
  type CredentialSearchBlocker,
} from './account-reference-mappings';

export type CoverageStatus = 'connected_oauth' | 'reference_only' | 'missing';

export interface CoverageRow {
  orgSlug: string;
  provider: string;
  /** Reference slug for mapped accounts; null for inventory blockers. */
  slug: string | null;
  status: CoverageStatus;
  /** Why an account is `missing`, when known (e.g. inventory blocker). */
  reason?: string;
}

export interface CoverageInput {
  /** Account inventory. Defaults to the canonical mapping list. */
  mappings?: CredentialMapping[];
  /** Inventory blockers (orgs with no 1Password item). Defaults to canonical. */
  blockers?: CredentialSearchBlocker[];
  /** orgSlug → platform/provider strings with an ACTIVE OAuth connection. */
  connectedByOrg: Record<string, string[]>;
  /** orgSlug → reference-only vault slugs that exist for that org. */
  vaultSlugsByOrg: Record<string, string[]>;
}

export interface CoverageReport {
  rows: CoverageRow[];
  totals: Record<CoverageStatus, number>;
}

/** True when the org has an active OAuth connection covering this mapping. */
function isConnected(
  mapping: CredentialMapping,
  connected: string[] | undefined,
): boolean {
  if (!connected || connected.length === 0) return false;
  const targets = new Set(
    [mapping.provider, ...(mapping.platforms ?? [])].map((p) => p.toLowerCase()),
  );
  return connected.some((c) => targets.has(c.toLowerCase()));
}

export function computeCredentialCoverage(input: CoverageInput): CoverageReport {
  const mappings = input.mappings ?? ACCOUNT_REFERENCE_MAPPINGS;
  const blockers = input.blockers ?? CREDENTIAL_SEARCH_BLOCKERS;

  const rows: CoverageRow[] = mappings.map((mapping) => {
    if (isConnected(mapping, input.connectedByOrg[mapping.orgSlug])) {
      return {
        orgSlug: mapping.orgSlug,
        provider: mapping.provider,
        slug: mapping.slug,
        status: 'connected_oauth',
      };
    }
    const hasReference = (input.vaultSlugsByOrg[mapping.orgSlug] ?? []).includes(
      mapping.slug,
    );
    return {
      orgSlug: mapping.orgSlug,
      provider: mapping.provider,
      slug: mapping.slug,
      status: hasReference ? 'reference_only' : 'missing',
      ...(hasReference
        ? {}
        : { reason: 'No stored 1Password reference and no active OAuth connection.' }),
    };
  });

  for (const blocker of blockers) {
    rows.push({
      orgSlug: blocker.orgSlug,
      provider: 'all',
      slug: null,
      status: 'missing',
      reason: blocker.actionRequired,
    });
  }

  const totals: Record<CoverageStatus, number> = {
    connected_oauth: 0,
    reference_only: 0,
    missing: 0,
  };
  for (const row of rows) totals[row.status] += 1;

  return { rows, totals };
}

/**
 * Coverage for a single org (the per-client API view, SYN-1023). Filters the
 * canonical inventory to `orgSlug` and classifies it against that org's
 * connected platforms + stored vault slugs. Secret-free — inputs carry only
 * platform names and slugs.
 */
export function coverageForOrg(
  orgSlug: string,
  connectedPlatforms: string[],
  vaultSlugs: string[],
): CoverageReport {
  return computeCredentialCoverage({
    mappings: ACCOUNT_REFERENCE_MAPPINGS.filter((m) => m.orgSlug === orgSlug),
    blockers: CREDENTIAL_SEARCH_BLOCKERS.filter((b) => b.orgSlug === orgSlug),
    connectedByOrg: { [orgSlug]: connectedPlatforms },
    vaultSlugsByOrg: { [orgSlug]: vaultSlugs },
  });
}
