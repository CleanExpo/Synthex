/**
 * Composite Health Score — 100/100
 *
 * Four pillars, 25 points each:
 *  1. SEO Audit score (latest SEOAudit.overallScore)
 *  2. Sentinel Health (latest SiteHealthSnapshot health score)
 *  3. GBP Completeness (10-item checklist, 2.5pts each)
 *  4. CWV Pass Rate (LCP 8.33 + INP 8.33 + CLS 8.34)
 *
 * UNI-1610
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface PillarScore {
  score: number; // 0-25
  max: 25;
  label: string;
  details?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  pillar: string;
  impact: number; // Points gained by completing
  actionUrl?: string; // Deep link to fix
}

export interface CompositeHealthScore {
  total: number; // 0-100
  pillars: {
    seoAudit: PillarScore;
    sentinelHealth: PillarScore;
    gbpCompleteness: PillarScore;
    cwvPassRate: PillarScore;
  };
  checklist: ChecklistItem[];
  nextActions: string[]; // Top 3 highest-impact incomplete items
}

// ============================================================================
// PILLAR 1: SEO AUDIT (0-25)
// ============================================================================

async function computeSeoAuditPillar(
  userId: string
): Promise<{ score: number; details: string }> {
  const latestAudit = await prisma.sEOAudit.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { overallScore: true, createdAt: true },
  });

  if (!latestAudit) {
    return { score: 0, details: 'No audits run yet' };
  }

  const score = (latestAudit.overallScore / 100) * 25;
  return {
    score: Math.round(score * 10) / 10,
    details: `Latest audit: ${latestAudit.overallScore}/100`,
  };
}

// ============================================================================
// PILLAR 2: SENTINEL HEALTH (0-25)
// ============================================================================

/**
 * Replicates the health score logic from lib/sentinel/health-checker.ts
 * but reads from the stored snapshot rather than recomputing.
 */
async function computeSentinelPillar(
  userId: string,
  orgId: string
): Promise<{
  score: number;
  details: string;
  cwv: Record<string, unknown> | null;
}> {
  const latestSnapshot = await prisma.siteHealthSnapshot.findFirst({
    where: { userId, orgId },
    orderBy: { snapshotDate: 'desc' },
    select: {
      avgPosition: true,
      totalClicks: true,
      coverageErrors: true,
      coreWebVitals: true,
      snapshotDate: true,
    },
  });

  if (!latestSnapshot) {
    return { score: 0, details: 'No health snapshots yet', cwv: null };
  }

  // Derive a 0-100 health score from the snapshot metrics
  // Position component (lower is better): 0-30 of the sentinel's own internal score
  const positionScore = Math.max(0, 30 - (latestSnapshot.avgPosition - 1) * 3);
  // Click component: 0-20
  const clickScore = Math.min(20, latestSnapshot.totalClicks / 50);
  // Error component (fewer is better): 0-20
  const errorScore = Math.max(0, 20 - latestSnapshot.coverageErrors * 2);
  // CWV component: 0-30 (used for sentinel pillar, separate from CWV pillar)
  const cwvData = latestSnapshot.coreWebVitals as Record<
    string,
    unknown
  > | null;
  let cwvScore = 0;
  if (cwvData) {
    const lcp = cwvData.lcp as { rating?: string } | undefined;
    const inp = cwvData.inp as { rating?: string } | undefined;
    const cls = cwvData.cls as { rating?: string } | undefined;
    if (lcp?.rating === 'good') cwvScore += 10;
    if (inp?.rating === 'good') cwvScore += 10;
    if (cls?.rating === 'good') cwvScore += 10;
  }

  const sentinelHealth = Math.min(
    100,
    positionScore + clickScore + errorScore + cwvScore
  );
  const pillarScore = (sentinelHealth / 100) * 25;

  return {
    score: Math.round(pillarScore * 10) / 10,
    details: `Health: ${Math.round(sentinelHealth)}/100`,
    cwv: cwvData,
  };
}

// ============================================================================
// PILLAR 3: GBP COMPLETENESS (0-25, 10 items × 2.5pts)
// ============================================================================

async function computeGbpPillar(
  orgId: string
): Promise<{ score: number; details: string; checklist: ChecklistItem[] }> {
  const location = await prisma.gBPLocation.findFirst({
    where: { organizationId: orgId, isPrimary: true },
    include: {
      reviews: { select: { rating: true }, take: 1 },
    },
  });

  const checklist: ChecklistItem[] = [];
  const addItem = (
    id: string,
    label: string,
    completed: boolean,
    actionUrl?: string
  ) => {
    checklist.push({
      id,
      label,
      completed,
      pillar: 'gbpCompleteness',
      impact: 2.5,
      actionUrl,
    });
  };

  if (!location) {
    // No GBP connected — all items incomplete
    const items = [
      'Location name set',
      'Address complete',
      'Phone number present',
      'Website URL set',
      'Primary category assigned',
      'Business hours set',
      'Verified listing',
      'At least 1 review',
      'Average rating >= 4.0',
      'Recent GBP post (14 days)',
    ];
    items.forEach((label, i) => {
      addItem(`gbp-${i + 1}`, label, false, '/dashboard/integrations');
    });
    return { score: 0, details: 'GBP not connected', checklist };
  }

  const address = location.address as Record<string, unknown> | null;
  const categories = location.categories as Record<string, unknown> | null;
  const hours = location.hours as Record<string, unknown> | null;

  // 1. Location name
  addItem(
    'gbp-1',
    'Location name set',
    !!location.locationName,
    '/dashboard/local'
  );

  // 2. Address complete (locality + postalCode)
  const addressComplete = !!address?.locality && !!address?.postalCode;
  addItem('gbp-2', 'Address complete', addressComplete, '/dashboard/local');

  // 3. Phone number
  addItem(
    'gbp-3',
    'Phone number present',
    !!location.phone,
    '/dashboard/local'
  );

  // 4. Website URL
  addItem('gbp-4', 'Website URL set', !!location.website, '/dashboard/local');

  // 5. Primary category
  const hasPrimaryCategory = !!categories?.primaryCategory;
  addItem(
    'gbp-5',
    'Primary category assigned',
    hasPrimaryCategory,
    '/dashboard/local'
  );

  // 6. Business hours (at least 1 period)
  const hasHours = !!hours && Object.keys(hours).length > 0;
  addItem('gbp-6', 'Business hours set', hasHours, '/dashboard/local');

  // 7. Verified
  addItem('gbp-7', 'Verified listing', location.verified, '/dashboard/local');

  // 8. At least 1 review
  const reviewCount = await prisma.gBPReview.count({
    where: { organizationId: orgId, locationId: location.id },
  });
  addItem('gbp-8', 'At least 1 review', reviewCount > 0);

  // 9. Average rating >= 4.0
  let avgRating = 0;
  if (reviewCount > 0) {
    const agg = await prisma.gBPReview.aggregate({
      where: { organizationId: orgId, locationId: location.id },
      _avg: { rating: true },
    });
    avgRating = agg._avg.rating ?? 0;
  }
  addItem('gbp-9', 'Average rating >= 4.0 stars', avgRating >= 4.0);

  // 10. GBP post in last 14 days (check GBPSnapshot for recent activity)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const recentSnapshot = await prisma.gBPSnapshot.findFirst({
    where: {
      organizationId: orgId,
      locationId: location.locationId,
      date: { gte: fourteenDaysAgo },
    },
    orderBy: { date: 'desc' },
  });
  addItem(
    'gbp-10',
    'Recent GBP post (14 days)',
    !!recentSnapshot,
    '/dashboard/local?tab=posts'
  );

  const completedCount = checklist.filter(c => c.completed).length;
  const score = completedCount * 2.5;

  return {
    score,
    details: `${completedCount}/10 items complete`,
    checklist,
  };
}

// ============================================================================
// PILLAR 4: CWV PASS RATE (0-25)
// ============================================================================

function computeCwvPillar(cwv: Record<string, unknown> | null): {
  score: number;
  details: string;
  checklist: ChecklistItem[];
} {
  const checklist: ChecklistItem[] = [];

  if (!cwv) {
    checklist.push(
      {
        id: 'cwv-lcp',
        label: 'LCP passes (≤2.5s)',
        completed: false,
        pillar: 'cwvPassRate',
        impact: 8.33,
        actionUrl: '/dashboard/sentinel',
      },
      {
        id: 'cwv-inp',
        label: 'INP passes (≤200ms)',
        completed: false,
        pillar: 'cwvPassRate',
        impact: 8.33,
        actionUrl: '/dashboard/sentinel',
      },
      {
        id: 'cwv-cls',
        label: 'CLS passes (≤0.1)',
        completed: false,
        pillar: 'cwvPassRate',
        impact: 8.34,
        actionUrl: '/dashboard/sentinel',
      }
    );
    return { score: 0, details: 'No CWV data yet', checklist };
  }

  const lcp = cwv.lcp as { rating?: string } | undefined;
  const inp = cwv.inp as { rating?: string } | undefined;
  const cls = cwv.cls as { rating?: string } | undefined;

  const lcpPass = lcp?.rating === 'good';
  const inpPass = inp?.rating === 'good';
  const clsPass = cls?.rating === 'good';

  checklist.push(
    {
      id: 'cwv-lcp',
      label: 'LCP passes (≤2.5s)',
      completed: lcpPass,
      pillar: 'cwvPassRate',
      impact: 8.33,
      actionUrl: '/dashboard/sentinel',
    },
    {
      id: 'cwv-inp',
      label: 'INP passes (≤200ms)',
      completed: inpPass,
      pillar: 'cwvPassRate',
      impact: 8.33,
      actionUrl: '/dashboard/sentinel',
    },
    {
      id: 'cwv-cls',
      label: 'CLS passes (≤0.1)',
      completed: clsPass,
      pillar: 'cwvPassRate',
      impact: 8.34,
      actionUrl: '/dashboard/sentinel',
    }
  );

  let score = 0;
  if (lcpPass) score += 8.33;
  if (inpPass) score += 8.33;
  if (clsPass) score += 8.34;

  const passCount = [lcpPass, inpPass, clsPass].filter(Boolean).length;
  return {
    score: Math.round(score * 10) / 10,
    details: `${passCount}/3 metrics passing`,
    checklist,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function computeCompositeHealthScore(
  userId: string,
  orgId: string
): Promise<CompositeHealthScore> {
  // Run pillar computations in parallel
  const [seoResult, sentinelResult, gbpResult] = await Promise.all([
    computeSeoAuditPillar(userId),
    computeSentinelPillar(userId, orgId),
    computeGbpPillar(orgId),
  ]);

  // CWV pillar uses data from sentinel snapshot
  const cwvResult = computeCwvPillar(sentinelResult.cwv);

  const total =
    Math.round(
      (seoResult.score +
        sentinelResult.score +
        gbpResult.score +
        cwvResult.score) *
        10
    ) / 10;

  const allChecklist = [...gbpResult.checklist, ...cwvResult.checklist];

  // Add SEO and sentinel as single checklist items for completeness
  allChecklist.unshift(
    {
      id: 'seo-audit',
      label: 'Run an SEO audit',
      completed: seoResult.score > 0,
      pillar: 'seoAudit',
      impact: 25,
      actionUrl: '/dashboard/seo',
    },
    {
      id: 'sentinel-health',
      label: 'Run a health check',
      completed: sentinelResult.score > 0,
      pillar: 'sentinelHealth',
      impact: 25,
      actionUrl: '/dashboard/sentinel',
    }
  );

  // Top 3 highest-impact incomplete items
  const nextActions = allChecklist
    .filter(item => !item.completed)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(item => item.label);

  return {
    total,
    pillars: {
      seoAudit: {
        score: seoResult.score,
        max: 25,
        label: 'SEO Audit',
        details: seoResult.details,
      },
      sentinelHealth: {
        score: sentinelResult.score,
        max: 25,
        label: 'Site Health',
        details: sentinelResult.details,
      },
      gbpCompleteness: {
        score: gbpResult.score,
        max: 25,
        label: 'GBP Completeness',
        details: gbpResult.details,
      },
      cwvPassRate: {
        score: cwvResult.score,
        max: 25,
        label: 'Core Web Vitals',
        details: cwvResult.details,
      },
    },
    checklist: allChecklist,
    nextActions,
  };
}
