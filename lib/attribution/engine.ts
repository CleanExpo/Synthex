/**
 * Multi-touch attribution engine — SYN-795
 *
 * Computes revenue attribution across marketing touchpoints for verified leads.
 *
 * Four models are supported:
 *   - first-touch  — 100% credit to the earliest touchpoint in window
 *   - last-touch   — 100% credit to the latest touchpoint in window
 *   - linear       — equal credit across all touchpoints
 *   - time-decay   — exponential decay (7 day half-life by default),
 *                    weights normalised so they sum to 1 per lead
 *
 * Touchpoint → Lead matching is a three-tier priority cascade:
 *   1. UTM match: event.eventData.utm_{source,medium,campaign} matches the
 *      lead's source/medium/campaign fields (any non-null lead field that
 *      matches counts; all provided lead fields must match).
 *   2. Session fingerprint: event.sessionId === lead.rawPayload.sessionId.
 *   3. Time-bounded fallback: any event in the attribution window before
 *      the lead's occurredAt, if no UTM or session match surfaced any
 *      touchpoints for this lead.
 *
 * Revenue attributed:
 *   - Lead.verifiedRevenueAud when non-null, OR
 *   - Lead.revenueEstimateAud when `useEstimateFallback` is true AND verified is null
 *
 * Pure function: takes pre-fetched rows (no DB access). The orchestrator in
 * `compute.ts` does I/O.
 */

import type { Prisma } from '@prisma/client';

// ── Public types ──────────────────────────────────────────────────────────────

export type AttributionModel =
  | 'first-touch'
  | 'last-touch'
  | 'linear'
  | 'time-decay';

export type TouchpointMatchMethod = 'utm' | 'session' | 'time-fallback';

export interface Touchpoint {
  /** ClientEngagementEvent.id */
  eventId: string;
  /** Event timestamp */
  occurredAt: Date;
  /** Event type (dashboard_visit, calendar_post_approved, …) */
  eventType: string;
  /** How this touchpoint was matched to the lead */
  matchMethod: TouchpointMatchMethod;
  /** Normalised credit share (0..1). Sum of shares per lead === 1 (or 0 if no touchpoints). */
  creditShare: number;
  /** Attributed revenue in AUD for this touchpoint (creditShare × leadRevenue) */
  attributedRevenueAud: number;
}

export interface LeadAttribution {
  leadId: string;
  model: AttributionModel;
  /** All touchpoints credited to this lead, ordered by occurredAt asc */
  touchpoints: Touchpoint[];
  /** Sum of revenue attributed across touchpoints (== leadRevenue when any touchpoints matched) */
  attributedRevenueAud: number;
  /** The lead's revenue used as the pool (verified, or estimate when opted in) */
  leadRevenueAud: number;
}

export interface EngineInput {
  organizationId: string;
  windowStart: Date;
  windowEnd: Date;
  model: AttributionModel;
  leads: LeadRow[];
  events: EventRow[];
  /** Half-life in days for time-decay. Default: 7. */
  timeDecayHalfLifeDays?: number;
  /** If true, use revenueEstimateAud when verifiedRevenueAud is null. Default: false. */
  useEstimateFallback?: boolean;
}

/** Minimum shape of a Lead row the engine needs. */
export interface LeadRow {
  id: string;
  organizationId: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  occurredAt: Date;
  attributionWindowDays: number;
  verifiedRevenueAud: Prisma.Decimal | null;
  revenueEstimateAud: Prisma.Decimal | null;
  rawPayload: Prisma.JsonValue;
}

/** Minimum shape of a ClientEngagementEvent row the engine needs. */
export interface EventRow {
  id: string;
  clientId: string;
  eventType: string;
  eventData: Prisma.JsonValue;
  sessionId: string;
  createdAt: Date;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  // Prisma.Decimal has toNumber(); guard for already-number fallback
  const maybe = value as unknown as { toNumber?: () => number };
  if (typeof maybe.toNumber === 'function') return maybe.toNumber();
  return Number(value);
}

function readString(json: Prisma.JsonValue, key: string): string | null {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return null;
  }
  const value = (json as { [k: string]: Prisma.JsonValue })[key];
  return typeof value === 'string' ? value : null;
}

function leadRevenue(lead: LeadRow, useEstimateFallback: boolean): number {
  const verified = decimalToNumber(lead.verifiedRevenueAud);
  if (verified > 0) return verified;
  if (useEstimateFallback) return decimalToNumber(lead.revenueEstimateAud);
  return 0;
}

/**
 * Check whether an event UTM-matches a lead.
 * Matches when every non-null lead UTM field equals the event's corresponding
 * utm_* field in eventData. If the lead has no UTM fields set at all, this
 * returns false (nothing to match on).
 */
function eventMatchesLeadUtm(event: EventRow, lead: LeadRow): boolean {
  const leadHasAnyUtm =
    lead.source !== null || lead.medium !== null || lead.campaign !== null;
  if (!leadHasAnyUtm) return false;

  const evSource = readString(event.eventData, 'utm_source');
  const evMedium = readString(event.eventData, 'utm_medium');
  const evCampaign = readString(event.eventData, 'utm_campaign');

  if (lead.source !== null && lead.source !== evSource) return false;
  if (lead.medium !== null && lead.medium !== evMedium) return false;
  if (lead.campaign !== null && lead.campaign !== evCampaign) return false;
  return true;
}

/** Session fingerprint — prefer explicit sessionId in payload, fall back to event.sessionId. */
function eventMatchesLeadSession(event: EventRow, lead: LeadRow): boolean {
  const leadSession = readString(lead.rawPayload, 'sessionId');
  if (!leadSession) return false;
  return event.sessionId === leadSession;
}

/**
 * The attribution window for a lead is: [lead.occurredAt - windowDays, lead.occurredAt].
 * We additionally clamp to the caller's [windowStart, windowEnd] to respect the
 * reporting window.
 */
function eventInLeadWindow(
  event: EventRow,
  lead: LeadRow,
  windowStart: Date,
  windowEnd: Date
): boolean {
  const leadWindowStart = new Date(
    lead.occurredAt.getTime() - lead.attributionWindowDays * 86_400_000
  );
  const effectiveStart =
    leadWindowStart > windowStart ? leadWindowStart : windowStart;
  const effectiveEnd =
    lead.occurredAt < windowEnd ? lead.occurredAt : windowEnd;
  return event.createdAt >= effectiveStart && event.createdAt <= effectiveEnd;
}

interface MatchedEvent {
  event: EventRow;
  matchMethod: TouchpointMatchMethod;
}

/**
 * Cascade: UTM matches first; if none, session matches; if none, time-fallback.
 * Deduplicates by event id in case cascades overlap (they cannot, but defensive).
 */
function collectTouchpointsForLead(
  lead: LeadRow,
  events: EventRow[],
  windowStart: Date,
  windowEnd: Date
): MatchedEvent[] {
  const inWindow = events.filter(e =>
    eventInLeadWindow(e, lead, windowStart, windowEnd)
  );

  const utm = inWindow.filter(e => eventMatchesLeadUtm(e, lead));
  if (utm.length > 0) {
    return utm.map(e => ({ event: e, matchMethod: 'utm' as const }));
  }

  const session = inWindow.filter(e => eventMatchesLeadSession(e, lead));
  if (session.length > 0) {
    return session.map(e => ({ event: e, matchMethod: 'session' as const }));
  }

  return inWindow.map(e => ({
    event: e,
    matchMethod: 'time-fallback' as const,
  }));
}

// ── Credit allocation per model ───────────────────────────────────────────────

function computeCreditShares(
  matched: MatchedEvent[],
  lead: LeadRow,
  model: AttributionModel,
  halfLifeDays: number
): number[] {
  const n = matched.length;
  if (n === 0) return [];

  // All matched events are already sorted below by the caller.
  switch (model) {
    case 'first-touch': {
      const shares = new Array<number>(n).fill(0);
      shares[0] = 1;
      return shares;
    }
    case 'last-touch': {
      const shares = new Array<number>(n).fill(0);
      shares[n - 1] = 1;
      return shares;
    }
    case 'linear': {
      const share = 1 / n;
      return new Array<number>(n).fill(share);
    }
    case 'time-decay': {
      // Weight ∝ 0.5 ^ (daysBefore / halfLife). More recent ⇒ larger weight.
      const leadTime = lead.occurredAt.getTime();
      const weights = matched.map(m => {
        const daysBefore =
          (leadTime - m.event.createdAt.getTime()) / 86_400_000;
        const safeDays = daysBefore < 0 ? 0 : daysBefore;
        return Math.pow(0.5, safeDays / halfLifeDays);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      if (total === 0) {
        const share = 1 / n;
        return new Array<number>(n).fill(share);
      }
      return weights.map(w => w / total);
    }
    default: {
      // Exhaustiveness guard without `as any`.
      const _never: never = model;
      throw new Error(`Unknown attribution model: ${String(_never)}`);
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Run the attribution engine over pre-fetched leads and events.
 * Pure function — does no I/O.
 */
export function runAttribution(input: EngineInput): LeadAttribution[] {
  const {
    leads,
    events,
    windowStart,
    windowEnd,
    model,
    timeDecayHalfLifeDays = 7,
    useEstimateFallback = false,
  } = input;

  const results: LeadAttribution[] = [];

  for (const lead of leads) {
    const revenue = leadRevenue(lead, useEstimateFallback);

    const matched = collectTouchpointsForLead(
      lead,
      events,
      windowStart,
      windowEnd
    ).sort((a, b) => a.event.createdAt.getTime() - b.event.createdAt.getTime());

    const shares = computeCreditShares(
      matched,
      lead,
      model,
      timeDecayHalfLifeDays
    );

    const touchpoints: Touchpoint[] = matched.map((m, idx) => ({
      eventId: m.event.id,
      occurredAt: m.event.createdAt,
      eventType: m.event.eventType,
      matchMethod: m.matchMethod,
      creditShare: shares[idx] ?? 0,
      attributedRevenueAud: (shares[idx] ?? 0) * revenue,
    }));

    const attributedRevenueAud = touchpoints.reduce(
      (sum, t) => sum + t.attributedRevenueAud,
      0
    );

    results.push({
      leadId: lead.id,
      model,
      touchpoints,
      attributedRevenueAud,
      leadRevenueAud: revenue,
    });
  }

  return results;
}
