import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import {
  isHyperCareSnapshot,
  HYPERCARE_REPORT_TYPE,
} from '@/lib/agency/hypercare-snapshot';
import {
  isTier2Snapshot,
  TIER2_REPORT_TYPE,
} from '@/lib/agency/tier2-snapshot';
import { UNITE_WORKSPACE_SLUG } from '@/lib/agency/portfolio-brand-configs';

export const metadata: Metadata = {
  title: 'AEO Snapshot · Synthex',
};

interface BrandSurfaceSummary {
  brand: string;
  surface: string;
  total: number;
  passed: number;
  passRate: number;
}

async function loadTier1Summary(): Promise<BrandSurfaceSummary[]> {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const rows = await prisma.aeoGateRun.groupBy({
      by: ['brand', 'surface'],
      _count: { _all: true },
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    const passed = await prisma.aeoGateRun.groupBy({
      by: ['brand', 'surface'],
      _count: { _all: true },
      where: {
        pass: true,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    const passedByKey = new Map(
      passed.map(p => [`${p.brand}|${p.surface}`, p._count._all])
    );
    return rows.map(r => {
      const passedCount = passedByKey.get(`${r.brand}|${r.surface}`) ?? 0;
      return {
        brand: r.brand,
        surface: r.surface,
        total: r._count._all,
        passed: passedCount,
        passRate: r._count._all === 0 ? 0 : passedCount / r._count._all,
      };
    });
  } catch (err) {
    // DB unavailable / empty / migration not yet applied — render empty state.
    return [];
  }
}

async function loadOrgReportSnapshot<T>(
  reportType: string,
  guard: (value: unknown) => value is T
): Promise<T | null> {
  try {
    const workspace = await prisma.organization.findUnique({
      where: { slug: UNITE_WORKSPACE_SLUG },
      select: { id: true },
    });
    if (!workspace) return null;

    const report = await prisma.report.findFirst({
      where: {
        organizationId: workspace.id,
        type: reportType,
        status: 'completed',
      },
      orderBy: { generatedAt: 'desc' },
      select: { data: true },
    });

    if (!report || !guard(report.data)) return null;
    return report.data;
  } catch {
    return null;
  }
}

export default async function AeoSnapshotPage() {
  const [tier1, hyperCare, tier2] = await Promise.all([
    loadTier1Summary(),
    loadOrgReportSnapshot(HYPERCARE_REPORT_TYPE, isHyperCareSnapshot),
    loadOrgReportSnapshot(TIER2_REPORT_TYPE, isTier2Snapshot),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">AEO Snapshot</h1>
      <p className="text-sm text-gray-600 mb-8">
        Hyper-Care daily / Tier 1 weekly / Tier 2 monthly / Tier 3 quarterly
        cadence per Q3.2.3 A2. Source: <code>aeo_gate_runs</code> · spec{' '}
        <code>docs/aeo/brand-voice-enforce-spec-2026-05-16.md</code>.
      </p>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">
          Hyper-Care — Daily Launch Watch (AT-006)
        </h2>
        {!hyperCare ? (
          <p className="text-gray-500 italic">
            No Hyper-Care daily snapshot has been generated yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Generated{' '}
              {new Date(hyperCare.generatedAt).toLocaleDateString('en-AU')} ·{' '}
              {hyperCare.passedRuns} passed / {hyperCare.failedRuns} failed from{' '}
              {hyperCare.totalRuns} gate runs in the last{' '}
              {hyperCare.windowHours}h.
              {hyperCare.breachSurfaced
                ? ' Breach surfaced — escalate same day.'
                : ' No breach in window.'}
            </p>
            {hyperCare.failureReasons.length === 0 ? (
              <p className="text-gray-500 italic">
                No failure reasons were recorded in this snapshot.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Failure reason</th>
                    <th className="text-right py-2">Occurrences</th>
                  </tr>
                </thead>
                <tbody>
                  {hyperCare.failureReasons.map(({ reason, count }) => (
                    <tr key={reason} className="border-b border-gray-100">
                      <td className="py-2">{reason}</td>
                      <td className="py-2 text-right">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">
          Tier 1 — Weekly gate pass-rate
        </h2>
        {tier1.length === 0 ? (
          <p className="text-gray-500 italic">
            No gate runs in the last 7 days. Either the migration has not been
            applied, or no surfaces have hit the gate yet.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Brand</th>
                <th className="text-left py-2">Surface</th>
                <th className="text-right py-2">Total runs</th>
                <th className="text-right py-2">Passed</th>
                <th className="text-right py-2">Pass rate</th>
              </tr>
            </thead>
            <tbody>
              {tier1.map(row => (
                <tr
                  key={`${row.brand}-${row.surface}`}
                  className="border-b border-gray-100"
                >
                  <td className="py-2">{row.brand}</td>
                  <td className="py-2">{row.surface}</td>
                  <td className="py-2 text-right">{row.total}</td>
                  <td className="py-2 text-right">{row.passed}</td>
                  <td className="py-2 text-right">
                    {(row.passRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">
          Tier 2 — Monthly gate failure breakdown
        </h2>
        {!tier2 ? (
          <p className="text-gray-500 italic">
            No monthly Tier 2 snapshot has been generated yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Generated{' '}
              {new Date(tier2.generatedAt).toLocaleDateString('en-AU')} ·{' '}
              {tier2.passedRuns} passed / {tier2.failedRuns} failed from{' '}
              {tier2.totalRuns} gate runs.
            </p>
            {tier2.failureReasons.length === 0 ? (
              <p className="text-gray-500 italic">
                No failure reasons were recorded in this snapshot.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Failure reason</th>
                    <th className="text-right py-2">Occurrences</th>
                  </tr>
                </thead>
                <tbody>
                  {tier2.failureReasons.map(({ reason, count }) => (
                    <tr key={reason} className="border-b border-gray-100">
                      <td className="py-2">{reason}</td>
                      <td className="py-2 text-right">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">
          Tier 3 — Quarterly cohort economics
        </h2>
        <p className="text-gray-500 italic">
          Cohort-economics audit per <code>performance-attribution-lead</code>.
          Wires to existing <code>LocationKpi</code> model (SYN-834).
        </p>
      </section>
    </div>
  );
}
