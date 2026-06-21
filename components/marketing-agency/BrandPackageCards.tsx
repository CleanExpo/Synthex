'use client';

/**
 * BrandPackageCards — the Marketing Agency homepage brand-package cards,
 * gated by the operator's accessible organisations (SYN-1031 F3).
 *
 * Previously the page rendered fixed cards for CCW, CARSI, RestoreAssist,
 * Disaster Recovery, and NRPG for *every* viewer, surfacing the whole internal
 * portfolio to any tenant and burying the outcome-first entry point. Each card
 * is now shown only when the operator can access that brand's organisation
 * (matched on the canonical org slug), with a neutral empty state otherwise.
 * OutcomeWorkbench stays the single primary action, rendered above this.
 */
import Link from 'next/link';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

/** Canonical org slugs the cards gate on (verified against the organisations table). */
export const BRAND_SLUGS = {
  ccw: 'ccw',
  carsi: 'carsi',
  restoreassist: 'restoreassist',
  disasterRecovery: 'disaster-recovery',
  nrpg: 'nrpg',
} as const;

/** The set of org slugs the operator can access, from their owned businesses. */
export function visibleBrandSlugs(
  businesses: { organizationSlug: string }[]
): Set<string> {
  return new Set(businesses.map(b => b.organizationSlug));
}

export function BrandPackageCards() {
  const { businesses, isLoading } = useActiveBusiness();
  const slugs = visibleBrandSlugs(businesses);

  const showCcw = slugs.has(BRAND_SLUGS.ccw);
  const showCarsi = slugs.has(BRAND_SLUGS.carsi);
  const showRestoreAssist = slugs.has(BRAND_SLUGS.restoreassist);
  const showDisasterRecovery = slugs.has(BRAND_SLUGS.disasterRecovery);
  const showNrpg = slugs.has(BRAND_SLUGS.nrpg);
  const showPortfolio = showRestoreAssist || showDisasterRecovery || showNrpg;
  const showAny = showCcw || showCarsi || showPortfolio;

  // Avoid flashing every card before the owned-business list resolves.
  if (isLoading) return null;

  if (!showAny) {
    return (
      <section className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
        <p className="text-sm text-muted-foreground">
          Your brand packages will appear here once a business is active. Start
          with an outcome above and Synthex prepares the work.
        </p>
      </section>
    );
  }

  return (
    <>
      {showCcw && (
        <section className="rounded-sm border border-emerald-400/30 bg-emerald-950/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                Live package
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                CCW EOFY Sales Acceleration 2026
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Production CCW package with Facebook, Instagram, LinkedIn, and
                Reddit drafts staged from live records. Publishing stays blocked
                until CCW social credentials are submitted and verified.
              </p>
            </div>
            <Link
              href="/dashboard/marketing-agency/ccw-eofy"
              className="inline-flex rounded-sm bg-emerald-300 px-4 py-2 text-sm font-medium text-emerald-950"
            >
              Open CCW Package
            </Link>
          </div>
        </section>
      )}

      {showCarsi && (
        <section className="rounded-sm border border-sky-400/30 bg-sky-950/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">
                First client authority pack
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                CARSI Restoration Training Authority
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Source-registered campaign pack for CARSI with owned-media
                drafts ready for review. External social publishing stays
                blocked until CARSI credentials, approval, asset rights, and
                analytics receipts are verified.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/marketing-agency/carsi/authority"
                className="inline-flex rounded-sm bg-sky-300 px-4 py-2 text-sm font-medium text-sky-950"
              >
                Open Live Package
              </Link>
              <Link
                href="/dashboard/marketing-agency/carsi/studio"
                className="inline-flex rounded-sm border border-sky-300/40 px-4 py-2 text-sm font-medium text-sky-100"
              >
                Open Studio
              </Link>
            </div>
          </div>
        </section>
      )}

      {showPortfolio && (
        <section className="rounded-sm border border-orange-400/30 bg-orange-950/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-200">
                Portfolio authority packs
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Source-led owned-media packages
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Source-led owned-media packages are staged for the nested
                portfolio. External publishing stays blocked until credentials,
                current source checks, and approval receipts are recorded.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {showRestoreAssist && (
                <Link
                  href="/dashboard/marketing-agency/restoreassist/authority"
                  className="inline-flex rounded-sm bg-orange-300 px-4 py-2 text-sm font-medium text-orange-950"
                >
                  RestoreAssist
                </Link>
              )}
              {showDisasterRecovery && (
                <Link
                  href="/dashboard/marketing-agency/disaster-recovery/authority"
                  className="inline-flex rounded-sm border border-orange-300/40 px-4 py-2 text-sm font-medium text-orange-100"
                >
                  Disaster Recovery
                </Link>
              )}
              {showNrpg && (
                <Link
                  href="/dashboard/marketing-agency/nrpg/authority"
                  className="inline-flex rounded-sm border border-orange-300/40 px-4 py-2 text-sm font-medium text-orange-100"
                >
                  NRPG
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {showRestoreAssist && (
        <section className="rounded-sm border border-white/10 p-5">
          <h2 className="text-lg font-semibold">RestoreAssist Launch</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Mock-mode package for the RestoreAssist launch campaign. Publishing
            and ad spend remain blocked.
          </p>
          <Link
            href="/dashboard/marketing-agency/restoreassist-launch"
            className="mt-4 inline-flex rounded-sm bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Open Package
          </Link>
        </section>
      )}
    </>
  );
}
