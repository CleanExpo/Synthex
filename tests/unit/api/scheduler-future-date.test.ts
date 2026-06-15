/**
 * Scheduler future-date validation tests (SYN-SCHED)
 *
 * Proves the scheduler no longer silently accepts a PAST scheduledAt. The cron
 * (`/api/cron/publish-scheduled`) publishes any post whose scheduledAt is <= now
 * on its next run, so a past scheduledAt means the post publishes
 * immediately/unexpectedly — never what a user picking a date intended.
 *
 * `isFutureScheduledAt` is the single guard backing both:
 *   - POST /api/scheduler/posts   (createPostSchema.scheduledAt refine)
 *   - POST /api/scheduler/posts/bulk (reschedule: exact time + offsetHours)
 *
 * @module tests/unit/api/scheduler-future-date.test
 */

import { describe, it, expect } from '@jest/globals';
import { isFutureScheduledAt } from '@/app/api/scheduler/posts/route';

const NOW = Date.parse('2026-06-15T12:00:00.000Z');

const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('isFutureScheduledAt — scheduler past-date guard (SYN-SCHED)', () => {
  describe('rejects past instants', () => {
    it('rejects a clearly past date (yesterday)', () => {
      expect(isFutureScheduledAt(iso(-24 * 60 * 60 * 1000), NOW)).toBe(false);
    });

    it('rejects an instant just outside the clock-skew tolerance (2 min ago)', () => {
      expect(isFutureScheduledAt(iso(-2 * 60 * 1000), NOW)).toBe(false);
    });
  });

  describe('accepts future instants', () => {
    it('accepts a clearly future date (tomorrow)', () => {
      expect(isFutureScheduledAt(iso(24 * 60 * 60 * 1000), NOW)).toBe(true);
    });

    it('accepts "now" (within the 60s clock-skew tolerance)', () => {
      expect(isFutureScheduledAt(iso(0), NOW)).toBe(true);
    });

    it('accepts an instant 30s in the past (inside the 60s tolerance)', () => {
      expect(isFutureScheduledAt(iso(-30 * 1000), NOW)).toBe(true);
    });
  });

  describe('rejects malformed input', () => {
    it('rejects an unparseable date string', () => {
      expect(isFutureScheduledAt('not-a-date', NOW)).toBe(false);
    });
  });

  describe('mirrors the bulk offsetHours guard', () => {
    it('a -24h shift on an already-near-now post lands in the past and is rejected', () => {
      const current = NOW + 60 * 60 * 1000; // post scheduled 1h out
      const shifted = new Date(current - 24 * 60 * 60 * 1000).toISOString();
      expect(isFutureScheduledAt(shifted, NOW)).toBe(false);
    });

    it('a +24h shift stays in the future and is accepted', () => {
      const current = NOW + 60 * 60 * 1000;
      const shifted = new Date(current + 24 * 60 * 60 * 1000).toISOString();
      expect(isFutureScheduledAt(shifted, NOW)).toBe(true);
    });
  });
});
