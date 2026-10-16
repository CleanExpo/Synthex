import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { GET as overview } from '@/app/api/citation/overview/route';
import { GET as timeline } from '@/app/api/citation/timeline/route';
import { GET as opportunities } from '@/app/api/citation/opportunities/route';
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
}));
const routes = { overview, timeline, opportunities };
// prettier-ignore
const operations = {
  overview: 'gEOAnalysis.aggregate citationMonitor.findMany brandMention.count brandIdentity.findMany entityAnalysis.aggregate contentQualityAudit.aggregate eEATAudit.aggregate promptTracker.findMany backlinkProspect.groupBy sentinelAlert.aggregate sentinelAlert.count sentinelAlert.count sentinelAlert.findMany healingAction.findMany contentQualityAudit.findMany promptTracker.findMany backlinkProspect.findMany sEOExperiment.count sEOExperiment.count sEOExperiment.aggregate',
  timeline: 'gEOAnalysis.findMany contentQualityAudit.findMany sentinelAlert.findMany',
  opportunities: 'sentinelAlert.findMany sentinelAlert.findMany promptTracker.findMany backlinkProspect.findMany sEOExperiment.findMany',
};
const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;
let mean: number | null, absent: string;
let wholeAvgMissing: boolean, fail: string, calls: number;
const score = (model: string) => (model === absent ? null : mean);
const url = (name: string) =>
  `/api/citation/${name}${name === 'timeline' ? '?days=30' : ''}`;
// Keep the source-operation fixture and controls compact for review.
// prettier-ignore
beforeEach(() => {
  mean = 0; wholeAvgMissing = false; fail = ''; calls = 0; absent = '';
  jest.mocked(getUserIdFromRequestOrCookies).mockResolvedValue('operator');
  for (const op of new Set(Object.values(operations).join(' ').split(' '))) {
    const [model, method] = op.split('.');
    db[model] ??= {};
    db[model][method] = jest.fn(async ({ select }) => {
      if (fail.startsWith(op + ':') && fail === `${op}:${++calls}`) throw new Error('read failed');
      if (method === 'count') return 0;
      if (method === 'aggregate') return {
        _avg: wholeAvgMissing ? null : { overallScore: score(model), coherenceScore: score(model), humanessScore: score(model), improvement: score(model) },
        _count: { id: 0 }, _max: { createdAt: null },
      };
      return op === 'promptTracker.findMany' && !select.id && score(model) !== null
        ? [{ brandMentioned: false, lastTestedAt: new Date() }] : [];
    });
  }
});
const rejections = Object.entries(operations).flatMap(([name, list]) => {
  const seen: Record<string, number> = {};
  return list
    .split(' ')
    .map(op => [name, `${op}:${(seen[op] = (seen[op] || 0) + 1)}`]);
});
// prettier-ignore
test.each(rejections)('%s rejects %s through the route', async (name, op) => {
  fail = op;
  const res = await routes[name as keyof typeof routes](new NextRequest(`http://localhost${url(name)}`));
  expect(res.status).toBe(500);
  expect(await res.json()).toMatchObject({ state: 'UNAVAILABLE', data: null, source: expect.any(String), reason: expect.any(String) });
});
// prettier-ignore
test.each([0, null, 'null aggregate', 'gEOAnalysis', 'entityAnalysis', 'contentQualityAudit', 'eEATAudit', 'promptTracker'] as const)('preserves measured zero and absent means: %s', async value => {
  wholeAvgMissing = value === 'null aggregate'; mean = value === null || wholeAvgMissing ? null : 0; absent = String(value);
  const res = await overview(new NextRequest('http://localhost/api/citation/overview'));
  expect(await res.json()).toMatchObject({ state: 'OBSERVED', data: {
    geoSummary: { avgScore: score('gEOAnalysis'), count: 0 }, entitySummary: { avgCoherenceScore: score('entityAnalysis') },
    qualitySummary: { avgQualityScore: score('contentQualityAudit'), avgEeatScore: score('eEATAudit') },
    experimentsSummary: { avgImprovement: mean }, promptSummary: { coverageRate: score('promptTracker') },
  } });
});
