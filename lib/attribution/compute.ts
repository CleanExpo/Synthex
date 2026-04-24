/**
 * Attribution compute orchestrator — SYN-795
 *
 * Thin wrapper that fetches leads + engagement events for an organisation
 * inside a reporting window and hands them to the pure engine. Does not
 * persist results — returns them so callers (admin routes, internal cron)
 * can decide what to do.
 */

import prisma from '@/lib/prisma';
import {
  runAttribution,
  type AttributionModel,
  type LeadAttribution,
} from './engine';

export interface ComputeArgs {
  organizationId: string;
  windowStart: Date;
  windowEnd: Date;
  model?: AttributionModel;
  /** Use revenueEstimateAud when verifiedRevenueAud is null. Default: false. */
  useEstimateFallback?: boolean;
  /** Time-decay half-life in days. Default: 7. */
  timeDecayHalfLifeDays?: number;
}

export interface ComputeResult {
  organizationId: string;
  windowStart: Date;
  windowEnd: Date;
  model: AttributionModel;
  attributions: LeadAttribution[];
  /** Lead count considered (verified or, when fallback enabled, estimated). */
  leadCount: number;
  /** Sum of lead revenue (verified or fallback) in AUD. */
  totalLeadRevenueAud: number;
  /** Sum of revenue matched to at least one touchpoint. */
  matchedAttributedRevenueAud: number;
}

export async function compute(args: ComputeArgs): Promise<ComputeResult> {
  const {
    organizationId,
    windowStart,
    windowEnd,
    model = 'time-decay',
    useEstimateFallback = false,
    timeDecayHalfLifeDays = 7,
  } = args;

  // Leads that occurred inside the reporting window for this org.
  const leads = await prisma.lead.findMany({
    where: {
      organizationId,
      occurredAt: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      organizationId: true,
      source: true,
      medium: true,
      campaign: true,
      occurredAt: true,
      attributionWindowDays: true,
      verifiedRevenueAud: true,
      revenueEstimateAud: true,
      rawPayload: true,
    },
  });

  // Widen event window by the largest lead attribution window to cover all
  // possible touchpoints preceding a lead's occurredAt.
  const maxLeadWindow = leads.reduce(
    (max, l) => (l.attributionWindowDays > max ? l.attributionWindowDays : max),
    0
  );
  const eventsStart = new Date(
    windowStart.getTime() - maxLeadWindow * 86_400_000
  );

  const events = await prisma.clientEngagementEvent.findMany({
    where: {
      clientId: organizationId,
      createdAt: { gte: eventsStart, lte: windowEnd },
    },
    select: {
      id: true,
      clientId: true,
      eventType: true,
      eventData: true,
      sessionId: true,
      createdAt: true,
    },
  });

  const attributions = runAttribution({
    organizationId,
    windowStart,
    windowEnd,
    model,
    leads,
    events,
    timeDecayHalfLifeDays,
    useEstimateFallback,
  });

  const totalLeadRevenueAud = attributions.reduce(
    (sum, a) => sum + a.leadRevenueAud,
    0
  );
  const matchedAttributedRevenueAud = attributions.reduce(
    (sum, a) => sum + a.attributedRevenueAud,
    0
  );

  return {
    organizationId,
    windowStart,
    windowEnd,
    model,
    attributions,
    leadCount: attributions.length,
    totalLeadRevenueAud,
    matchedAttributedRevenueAud,
  };
}
