/**
 * SYN-831 — AEO directional snapshot dashboard (Tier 1/2/3 cadence).
 *
 * Reads from aeo_gate_runs to surface:
 *  - Tier-1 weekly: gate pass-rate per brand × surface
 *  - Tier-2 monthly: trailing 30-day failure-reason breakdown
 *  - Tier-3 quarterly: source-of-truth job-ID coverage
 *
 * Spec: docs/aeo/brand-voice-enforce-spec-2026-05-16.md
 * Linked: PR #243 (gate impl) + PR #244 (NAP / freshness schema)
 *
 * MVP scaffold — server-component-only, no client interactivity yet.
 * Tier-2 / Tier-3 cards stub the data shapes; Tier-1 is live against
 * AeoGateRun model.
 */

import type { Metadata } from 'next';

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
      passed.map((p) => [`${p.brand}|${p.surface}`, p._count._all]),
    );
    return rows.map((r) => {
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

export default async function AeoSnapshotPage() {
  const tier1 = await loadTier1Summary();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">AEO Snapshot</h1>
      <p className="text-sm text-gray-600 mb-8">
        Tier 1 weekly / Tier 2 monthly / Tier 3 quarterly cadence per Q3.2.3 A2.
        Source: <code>aeo_gate_runs</code> · spec{' '}
        <code>docs/aeo/brand-voice-enforce-spec-2026-05-16.md</code>.
      </p>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Tier 1 — Weekly gate pass-rate</h2>
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
              {tier1.map((row) => (
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
          Tier 2 — Monthly directional citation pull
        </h2>
        <p className="text-gray-500 italic">
          ChatGPT / Perplexity / Gemini citation pull lands in follow-up.
          Source-of-truth job IDs in <code>aeo_gate_runs.source_of_truth_job_id</code>{' '}
          provide the join key.
        </p>
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
