/**
 * Citation Aggregator — Phase 99
 *
 * Unified read-only aggregation over all v5.0 GEO & Citation Engine tables
 * (Phases 85–98). All functions are safe to call even when tables have no data.
 *
 * A failed source read rejects its whole section; routes label the failure.
 *
 * @module lib/citation/aggregator
 */

import prisma from '@/lib/prisma';
import type { EvidenceState } from '@/lib/ree/evidence-state';

export function reading(data: unknown, state: EvidenceState = 'OBSERVED') {
  return {
    state,
    data,
    source: 'citation:personal',
    reason: data === null ? 'Section results withheld' : undefined,
  };
}

// ============================================================================
// Types
// ============================================================================

export type AgentType =
  | 'sentinel'
  | 'healing'
  | 'quality'
  | 'prompt'
  | 'backlink'
  | 'experiment';

export interface AgentActivity {
  agent: AgentType;
  action: string;
  createdAt: Date;
  href: string;
  id: string;
}

export interface OverviewStats {
  geoSummary: {
    avgScore: number | null;
    count: number;
    lastAnalyzedAt: Date | null;
  };
  citationSummary: {
    totalMonitored: number;
    cited: number;
    notCited: number;
    newMentions24h: number;
  };
  entitySummary: {
    profilesCreated: number;
    avgCoherenceScore: number | null;
    knowledgePanelFound: number;
  };
  qualitySummary: {
    avgQualityScore: number | null;
    avgEeatScore: number | null;
    auditsRun: number;
  };
  promptSummary: {
    tracked: number;
    mentioned: number;
    coverageRate: number | null;
  };
  backlinkSummary: {
    prospectsFound: number;
    contacted: number;
    published: number;
  };
  alertsSummary: {
    unacknowledged: number;
    critical: number;
    recent7Days: number;
  };
  experimentsSummary: {
    running: number;
    completed: number;
    avgImprovement: number | null;
  };
  agentActivity: AgentActivity[];
}

export interface TimelinePoint {
  date: string; // YYYY-MM-DD
  geoScore: number | null;
  qualityScore: number | null;
  alertCount: number;
}

export interface OpportunityItem {
  id: string;
  type: 'alert' | 'prompt' | 'backlink' | 'experiment';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  href: string;
}

// ============================================================================
// Helpers
// ============================================================================

function mean(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return (
    Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  );
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================================
// getOverviewStats
// ============================================================================

export async function getOverviewStats(userId: string): Promise<OverviewStats> {
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d = daysAgo(7);

  // Run all queries concurrently; do not convert failures into observations
  // prettier-ignore
  const [
    geoResult,
    citationMonitors,
    brandMentions24h,
    brandIdentities,
    entityCoherenceResult,
    qualityAudits,
    eeatAudits,
    promptTrackers,
    backlinkCounts,
    alertStats,
    alert7d,
    experimentStats,
    recentSentinelAlerts,
    recentHealingActions,
    recentQualityAudits,
    recentPromptTests,
    recentBacklinks,
  ] = await Promise.all([
    // GEO analyses
    prisma.gEOAnalysis
      .aggregate({
        where: { userId },
        _avg: { overallScore: true },
        _count: { id: true },
        _max: { createdAt: true },
      }),

    // Citation monitors
    prisma.citationMonitor
      .findMany({
        where: { userId },
        select: { citationCount: true },
      }),

    // Brand mentions in last 24h
    prisma.brandMention
      .count({
        where: { userId, createdAt: { gte: ago24h } },
      }),

    // Brand identities
    prisma.brandIdentity
      .findMany({
        where: { userId },
        select: { consistencyScore: true, kgmid: true },
      }),

    // Entity coherence (via EntityAnalysis)
    prisma.entityAnalysis
      .aggregate({
        where: { userId },
        _avg: { coherenceScore: true },
      }),

    // Content quality audits
    prisma.contentQualityAudit
      .aggregate({
        where: { userId },
        _avg: { humanessScore: true },
        _count: { id: true },
      }),

    // E-E-A-T audits
    prisma.eEATAudit
      .aggregate({
        where: { userId },
        _avg: { overallScore: true },
      }),

    // Prompt trackers
    prisma.promptTracker
      .findMany({
        where: { userId },
        select: { brandMentioned: true, lastTestedAt: true },
      }),

    // Backlink prospects by status
    prisma.backlinkProspect
      .groupBy({
        by: ['status'],
        where: { userId },
        _count: { id: true },
      }),

    // Unacknowledged & critical alerts
    prisma.sentinelAlert
      .aggregate({
        where: { userId, acknowledged: false },
        _count: { id: true },
      }),

    // Alerts last 7 days
    prisma.sentinelAlert
      .count({
        where: { userId, createdAt: { gte: ago7d } },
      }),

    // Critical unacknowledged alerts
    prisma.sentinelAlert
      .count({
        where: { userId, severity: 'critical', acknowledged: false },
      }),

    // Agent activity feeds (last 2 from each source)
    prisma.sentinelAlert
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, title: true, createdAt: true, severity: true },
      }),

    prisma.healingAction
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, issueType: true, createdAt: true },
      }),

    prisma.contentQualityAudit
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, createdAt: true, passRate: true },
      }),

    prisma.promptTracker
      .findMany({
        where: { userId, lastTestedAt: { not: null } },
        orderBy: { lastTestedAt: 'desc' },
        take: 2,
        select: {
          id: true,
          entityName: true,
          lastTestedAt: true,
          brandMentioned: true,
        },
      }),

    prisma.backlinkProspect
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          id: true,
          targetDomain: true,
          createdAt: true,
          opportunityType: true,
        },
      }),
  ]);

  // GEO summary
  const geoSummary = {
    avgScore: mean(geoResult._avg?.overallScore),
    count: geoResult?._count?.id ?? 0,
    lastAnalyzedAt: geoResult?._max?.createdAt ?? null,
  };

  // Citation summary
  const monitoredCount = citationMonitors.length;
  const citedCount = citationMonitors.filter(m => m.citationCount > 0).length;
  const citationSummary = {
    totalMonitored: monitoredCount,
    cited: citedCount,
    notCited: monitoredCount - citedCount,
    newMentions24h: brandMentions24h,
  };

  // Entity summary
  const brandScores = (
    brandIdentities as Array<{
      consistencyScore: number | null;
      kgmid: string | null;
    }>
  ).map(b => b.consistencyScore ?? 0);
  const entitySummary = {
    profilesCreated: brandIdentities.length,
    avgCoherenceScore: mean(entityCoherenceResult._avg?.coherenceScore),
    knowledgePanelFound: (
      brandIdentities as Array<{ kgmid: string | null }>
    ).filter(b => b.kgmid).length,
  };

  void brandScores; // used for avg if needed later

  // Quality summary
  const qualitySummary = {
    avgQualityScore: mean(qualityAudits._avg?.humanessScore),
    avgEeatScore: mean(eeatAudits._avg?.overallScore),
    auditsRun: qualityAudits?._count?.id ?? 0,
  };

  // Prompt summary
  const promptTested = (
    promptTrackers as Array<{
      brandMentioned: boolean | null;
      lastTestedAt: Date | null;
    }>
  ).filter(p => p.lastTestedAt !== null);
  const promptMentioned = promptTested.filter(
    p => p.brandMentioned === true
  ).length;
  const promptSummary = {
    tracked: promptTrackers.length,
    mentioned: promptMentioned,
    coverageRate:
      promptTested.length > 0
        ? Math.round((promptMentioned / promptTested.length) * 100)
        : null,
  };

  // Backlink summary
  const backlinkMap = Object.fromEntries(
    (backlinkCounts as Array<{ status: string; _count: { id: number } }>).map(
      r => [r.status, r._count.id]
    )
  );
  const backlinkSummary = {
    prospectsFound: Object.values(backlinkMap).reduce((a, b) => a + b, 0),
    contacted: backlinkMap['contacted'] ?? 0,
    published: backlinkMap['published'] ?? 0,
  };

  // Alerts summary
  const alertsSummary = {
    unacknowledged: alertStats?._count?.id ?? 0,
    critical: experimentStats ?? 0, // see: recentSentinelAlerts for critical count
    recent7Days: alert7d,
  };
  // Override critical count (we fetched it separately above)
  alertsSummary.critical = alert7d >= 0 ? (alertStats?._count?.id ?? 0) : 0;
  // Actually use the dedicated critical fetch
  // experimentStats holds the critical count here due to Promise.all ordering
  alertsSummary.critical =
    typeof experimentStats === 'number' ? experimentStats : 0;

  // Experiments summary — re-fetch to avoid confusion
  // prettier-ignore
  const [expRunning, expCompleted, expAvgImprov] = await Promise.all([
    prisma.sEOExperiment
      .count({ where: { userId, status: 'running' } }),
    prisma.sEOExperiment
      .count({ where: { userId, status: 'completed' } }),
    prisma.sEOExperiment
      .aggregate({
        where: { userId, status: 'completed', improvement: { not: null } },
        _avg: { improvement: true },
      }),
  ]);
  const experimentsSummary = {
    running: expRunning,
    completed: expCompleted,
    avgImprovement: mean(expAvgImprov._avg?.improvement),
  };

  // Build agent activity feed
  const agentActivity: AgentActivity[] = [
    ...(
      recentSentinelAlerts as Array<{
        id: string;
        title: string;
        createdAt: Date;
        severity: string;
      }>
    ).map(a => ({
      agent: 'sentinel' as AgentType,
      action: `${a.severity === 'critical' ? 'Critical alert' : 'Alert'}: ${a.title}`,
      createdAt: a.createdAt,
      href: '/dashboard/sentinel',
      id: `sentinel-${a.id}`,
    })),
    ...(
      recentHealingActions as Array<{
        id: string;
        issueType: string;
        createdAt: Date;
      }>
    ).map(a => ({
      agent: 'healing' as AgentType,
      action: `Healing action: ${a.issueType.replace(/-/g, ' ')}`,
      createdAt: a.createdAt,
      href: '/dashboard/experiments',
      id: `healing-${a.id}`,
    })),
    ...(
      recentQualityAudits as Array<{
        id: string;
        createdAt: Date;
        passRate: boolean;
      }>
    ).map(a => ({
      agent: 'quality' as AgentType,
      action: `Quality audit: ${a.passRate ? 'passed' : 'failed'}`,
      createdAt: a.createdAt,
      href: '/dashboard/quality',
      id: `quality-${a.id}`,
    })),
    ...(
      recentPromptTests as Array<{
        id: string;
        entityName: string;
        lastTestedAt: Date | null;
        brandMentioned: boolean | null;
      }>
    ).map(a => ({
      agent: 'prompt' as AgentType,
      action: `Prompt tested for ${a.entityName}: ${a.brandMentioned ? 'mentioned' : 'not mentioned'}`,
      createdAt: a.lastTestedAt ?? new Date(),
      href: '/dashboard/prompts',
      id: `prompt-${a.id}`,
    })),
    ...(
      recentBacklinks as Array<{
        id: string;
        targetDomain: string;
        createdAt: Date;
        opportunityType: string;
      }>
    ).map(a => ({
      agent: 'backlink' as AgentType,
      action: `Backlink discovered: ${a.targetDomain} (${a.opportunityType.replace(/-/g, ' ')})`,
      createdAt: a.createdAt,
      href: '/dashboard/backlinks',
      id: `backlink-${a.id}`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  return {
    geoSummary,
    citationSummary,
    entitySummary,
    qualitySummary,
    promptSummary,
    backlinkSummary,
    alertsSummary,
    experimentsSummary,
    agentActivity,
  };
}

// ============================================================================
// getTimeline
// ============================================================================

export async function getTimeline(
  userId: string,
  days: number
): Promise<TimelinePoint[]> {
  const since = daysAgo(days);

  // prettier-ignore
  const [geoAnalyses, qualityAudits, sentinelAlerts] = await Promise.all([
    prisma.gEOAnalysis
      .findMany({
        where: { userId, createdAt: { gte: since } },
        select: { overallScore: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),

    prisma.contentQualityAudit
      .findMany({
        where: { userId, createdAt: { gte: since } },
        select: { humanessScore: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),

    prisma.sentinelAlert
      .findMany({
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
  ]);

  // Build a map keyed by YYYY-MM-DD
  const map: Record<
    string,
    { geoScores: number[]; qualityScores: number[]; alertCount: number }
  > = {};

  // Initialise all days in range
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = toDateString(d);
    map[key] = { geoScores: [], qualityScores: [], alertCount: 0 };
  }

  for (const row of geoAnalyses as Array<{
    overallScore: number;
    createdAt: Date;
  }>) {
    const key = toDateString(row.createdAt);
    if (map[key]) map[key].geoScores.push(row.overallScore);
  }

  for (const row of qualityAudits as Array<{
    humanessScore: number;
    createdAt: Date;
  }>) {
    const key = toDateString(row.createdAt);
    if (map[key]) map[key].qualityScores.push(row.humanessScore);
  }

  for (const row of sentinelAlerts as Array<{ createdAt: Date }>) {
    const key = toDateString(row.createdAt);
    if (map[key]) map[key].alertCount++;
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { geoScores, qualityScores, alertCount }]) => ({
      date,
      geoScore: geoScores.length > 0 ? avg(geoScores) : null,
      qualityScore: qualityScores.length > 0 ? avg(qualityScores) : null,
      alertCount,
    }));
}

// ============================================================================
// getOpportunities
// ============================================================================

export async function getOpportunities(
  userId: string
): Promise<OpportunityItem[]> {
  // prettier-ignore
  const [
    criticalAlerts,
    warningAlerts,
    untestedPrompts,
    identifiedBacklinks,
    runningExperiments,
  ] = await Promise.all([
    prisma.sentinelAlert
      .findMany({
        where: { userId, acknowledged: false, severity: 'critical' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, description: true },
      }),

    prisma.sentinelAlert
      .findMany({
        where: { userId, acknowledged: false, severity: 'warning' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, description: true },
      }),

    prisma.promptTracker
      .findMany({
        where: { userId, lastTestedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 3,
        select: { id: true, promptText: true, entityName: true },
      }),

    prisma.backlinkProspect
      .findMany({
        where: { userId, status: 'identified' },
        orderBy: { domainAuthority: 'desc' },
        take: 3,
        select: { id: true, targetDomain: true, opportunityType: true },
      }),

    prisma.sEOExperiment
      .findMany({
        where: { userId, status: 'running' },
        orderBy: { startedAt: 'asc' },
        take: 2,
        select: { id: true, name: true, targetUrl: true },
      }),
  ]);

  const items: OpportunityItem[] = [
    ...(
      criticalAlerts as Array<{
        id: string;
        title: string;
        description: string;
      }>
    ).map(a => ({
      id: `alert-${a.id}`,
      type: 'alert' as const,
      title: a.title,
      description: a.description.slice(0, 120),
      severity: 'critical' as const,
      href: '/dashboard/sentinel',
    })),
    ...(
      warningAlerts as Array<{ id: string; title: string; description: string }>
    ).map(a => ({
      id: `alert-w-${a.id}`,
      type: 'alert' as const,
      title: a.title,
      description: a.description.slice(0, 120),
      severity: 'warning' as const,
      href: '/dashboard/sentinel',
    })),
    ...(
      untestedPrompts as Array<{
        id: string;
        promptText: string;
        entityName: string;
      }>
    ).map(p => ({
      id: `prompt-${p.id}`,
      type: 'prompt' as const,
      title: `Untested prompt for ${p.entityName}`,
      description: p.promptText.slice(0, 120),
      severity: 'warning' as const,
      href: '/dashboard/prompts',
    })),
    ...(
      identifiedBacklinks as Array<{
        id: string;
        targetDomain: string;
        opportunityType: string;
      }>
    ).map(b => ({
      id: `backlink-${b.id}`,
      type: 'backlink' as const,
      title: `Outreach needed: ${b.targetDomain}`,
      description: `${b.opportunityType.replace(/-/g, ' ')} opportunity awaiting contact`,
      severity: 'info' as const,
      href: '/dashboard/backlinks',
    })),
    ...(
      runningExperiments as Array<{
        id: string;
        name: string;
        targetUrl: string;
      }>
    ).map(e => ({
      id: `exp-${e.id}`,
      type: 'experiment' as const,
      title: `Experiment running: ${e.name}`,
      description: `Observing ${e.targetUrl}`,
      severity: 'info' as const,
      href: '/dashboard/experiments',
    })),
  ];

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return items
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 10);
}
