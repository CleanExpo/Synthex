/**
 * Brand Builder — Brand Publishing & Maintenance Calendar Generator
 *
 * Pure TypeScript date calculation — no external API required.
 * Generates 90-day calendar with publishing, social, and maintenance events.
 *
 * @module lib/brand/brand-calendar
 */

import type {
  BrandIdentityInput,
  BrandCalendar,
  CalendarEvent,
  CalendarEventType,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CredentialInput {
  expiresAt?: string;
  type: string;
  title: string;
}

export interface BrandCalendarOptions {
  credentials?: CredentialInput[];
  coverageDays?: number;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysUntil(target: Date, from: Date): number {
  const ms = target.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Event factories
// ---------------------------------------------------------------------------

function makeEvent(
  date: Date,
  type: CalendarEventType,
  title: string,
  description: string,
  priority: CalendarEvent['priority'],
  recurrence?: string
): CalendarEvent {
  return {
    date: toIsoDate(date),
    type,
    title,
    description,
    priority,
    ...(recurrence ? { recurrence } : {}),
  };
}

// ---------------------------------------------------------------------------
// Recurring event generators
// ---------------------------------------------------------------------------

function generateWeeklySocialPosts(
  start: Date,
  coverageDays: number,
  brandName: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let day = 7; day <= coverageDays; day += 7) {
    events.push(makeEvent(
      addDays(start, day),
      'social-post',
      `Weekly social post for ${brandName}`,
      'Share a brand update, insight, or engagement post across social platforms.',
      'medium',
      'weekly'
    ));
  }
  return events;
}

function generateBiweeklyArticles(
  start: Date,
  coverageDays: number,
  brandName: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let day = 14; day <= coverageDays; day += 14) {
    events.push(makeEvent(
      addDays(start, day),
      'publish-article',
      `Publish thought leadership article about ${brandName}`,
      'Publish an authoritative article that builds E-E-A-T signals and brand visibility.',
      'high',
      'monthly'
    ));
  }
  return events;
}

function generateMentionReviews(
  start: Date,
  coverageDays: number
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let day = 30; day <= coverageDays; day += 30) {
    events.push(makeEvent(
      addDays(start, day),
      'mention-review',
      'Review brand mentions this month',
      'Check for new brand mentions, sentiment shifts, and unlinked citations to reclaim.',
      'medium',
      'monthly'
    ));
  }
  return events;
}

function generateSchemaAudits(
  start: Date,
  coverageDays: number
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let day = 30; day <= coverageDays; day += 30) {
    events.push(makeEvent(
      addDays(start, day),
      'schema-audit',
      'Monthly schema markup audit',
      'Validate JSON-LD entity graph, check for errors in structured data, and update if needed.',
      'low',
      'monthly'
    ));
  }
  return events;
}

function generateWikidataUpdates(
  start: Date,
  coverageDays: number
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let day = 90; day <= coverageDays; day += 90) {
    events.push(makeEvent(
      addDays(start, day),
      'wikidata-update',
      'Quarterly Wikidata entity review',
      'Update Wikidata entry with new references, awards, and property completeness improvements.',
      'low',
      'quarterly'
    ));
  }
  return events;
}

function generateCredentialRefreshEvents(
  credentials: CredentialInput[],
  start: Date,
  coverageDays: number
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const end = addDays(start, coverageDays);

  for (const credential of credentials) {
    if (!credential.expiresAt) continue;

    const expiry        = new Date(credential.expiresAt);
    const reminderDate  = addDays(expiry, -30); // 30 days before expiry

    // Only include if reminder falls within coverage window
    if (reminderDate > start && reminderDate <= end) {
      events.push(makeEvent(
        reminderDate,
        'credential-refresh',
        `Renew ${credential.title}`,
        `${credential.type} credential expires in 30 days. Begin renewal process with ${credential.title} issuer.`,
        'high'
      ));
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------

function computeSummary(events: CalendarEvent[]): BrandCalendar['summary'] {
  return {
    totalEvents:       events.length,
    highPriority:      events.filter(e => e.priority === 'high').length,
    publishingEvents:  events.filter(e => e.type === 'publish-article' || e.type === 'social-post').length,
    maintenanceEvents: events.filter(e => e.type !== 'publish-article' && e.type !== 'social-post').length,
  };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate a 90-day brand publishing and maintenance calendar.
 * Pure date math — no external API calls.
 */
export function generateBrandCalendar(
  identity: BrandIdentityInput,
  options?: BrandCalendarOptions
): BrandCalendar {
  const coverageDays  = options?.coverageDays ?? 90;
  const credentials   = options?.credentials ?? [];
  const start         = new Date();
  const brandName     = identity.canonicalName;

  const events: CalendarEvent[] = [
    ...generateWeeklySocialPosts(start, coverageDays, brandName),
    ...generateBiweeklyArticles(start, coverageDays, brandName),
    ...generateMentionReviews(start, coverageDays),
    ...generateSchemaAudits(start, coverageDays),
    ...generateWikidataUpdates(start, coverageDays),
    ...generateCredentialRefreshEvents(credentials, start, coverageDays),
  ];

  // Sort by date ascending
  events.sort((a, b) => a.date.localeCompare(b.date));

  return {
    events,
    generatedAt:  new Date().toISOString(),
    coverageDays,
    summary:      computeSummary(events),
  };
}
