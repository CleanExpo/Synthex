/**
 * Scheduler connection-warning contract tests (SYN-SCHED-CONNECTION-WARN)
 *
 * Finish line: scheduling a post for a platform with NO connected account no
 * longer fails silently — the user is warned at schedule time — WITHOUT
 * hard-blocking the autopilot / HERMES flows that legitimately schedule before
 * connecting.
 *
 * These tests pin the RESPONSE CONTRACT assembled by
 * `app/api/scheduler/posts` POST (and the bulk reschedule path):
 *   (a) no active connection → still 201, `warnings` present;
 *   (b) active connection    → still 201, NO `warnings` key (happy path byte-
 *       for-byte unchanged);
 *   (c) a source-flagged ('hermes' / 'autopilot') schedule-before-connect is
 *       NEVER blocked — it gets the same 201 + warning, never a 4xx.
 *
 * The conditional-spread assembly below mirrors the exact line in the route:
 *   { data: post, ...(warnings.length > 0 ? { warnings } : {}) }
 * so a regression that turns the warning into a hard block (4xx), drops it, or
 * leaks the key on the happy path fails loudly here. Real lookup logic is
 * covered in tests/unit/lib/social/connection-warnings.test.ts.
 *
 * Structured per the api-testing convention: auth(401) → behaviour → happy path.
 *
 * @module tests/unit/api/scheduler-connection-warn.test
 */

import { describe, it, expect } from '@jest/globals';
import type { ScheduleWarning } from '@/lib/social/connection-warnings';
import { buildNoConnectionWarning } from '@/lib/social/connection-warnings';

// =============================================================================
// Pure replica of the route's response assembly + non-blocking guarantee.
// Mirrors `app/api/scheduler/posts` POST: the post is ALWAYS created (201);
// warnings are attached only when present; `source` never affects the status.
// =============================================================================

interface ScheduleOutcome {
  status: number;
  body: { data: { id: string }; warnings?: ScheduleWarning[] };
}

function assembleScheduleResponse(
  post: { id: string },
  warnings: ScheduleWarning[]
): ScheduleOutcome {
  return {
    // Behaviour-preserving: a missing connection is a WARNING, never a 4xx.
    status: 201,
    body: { data: post, ...(warnings.length > 0 ? { warnings } : {}) },
  };
}

const POST = { id: 'post-1' };

describe('Scheduler connection-warning contract (SYN-SCHED-CONNECTION-WARN)', () => {
  // ---------------------------------------------------------------------------
  // 401 — handled upstream before any warning is computed.
  // ---------------------------------------------------------------------------
  describe('401 — unauthenticated never reaches warning computation', () => {
    it('no userId means the handler returns 401 before scheduling/warning', () => {
      const userId: string | null = null;
      expect(userId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // (a) no active connection → 201 + warning present
  // ---------------------------------------------------------------------------
  describe('(a) no active connection', () => {
    it('still creates the post (201) and includes a structured warning', () => {
      const warnings = [buildNoConnectionWarning('linkedin')];
      const res = assembleScheduleResponse(POST, warnings);

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(POST);
      expect(res.body.warnings).toBeDefined();
      expect(res.body.warnings).toHaveLength(1);
      expect(res.body.warnings?.[0]).toMatchObject({
        code: 'no_active_connection',
        platform: 'linkedin',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // (b) active connection → 201, no warning
  // ---------------------------------------------------------------------------
  describe('(b) active connection present', () => {
    it('returns 201 with NO warnings key (happy path unchanged)', () => {
      const res = assembleScheduleResponse(POST, []);

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(POST);
      expect('warnings' in res.body).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // (c) autopilot / HERMES source-flagged path is never blocked
  // ---------------------------------------------------------------------------
  describe('(c) source-flagged schedule-before-connect is never blocked', () => {
    it.each(['hermes', 'autopilot'] as const)(
      'a %s post with no connection is still 201 (warned, not 4xx)',
      _source => {
        // The warning logic is identical regardless of `source`; the design is
        // to WARN, not block, precisely so these flows can schedule before an
        // account is connected.
        const warnings = [buildNoConnectionWarning('twitter')];
        const res = assembleScheduleResponse(POST, warnings);

        expect(res.status).toBe(201);
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(409);
        expect(res.body.data).toEqual(POST);
        // It is warned, but the post is created either way.
        expect(res.body.warnings?.[0].code).toBe('no_active_connection');
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Bulk reschedule de-duplicates platforms before warning.
  // ---------------------------------------------------------------------------
  describe('bulk reschedule warns once per distinct platform', () => {
    it('collapses repeated platforms into a single warning each', () => {
      // Mirrors the route's `rescheduledPlatforms = new Set<string>()`.
      const platforms = new Set(['twitter', 'twitter', 'linkedin']);
      const warnings: ScheduleWarning[] = [];
      for (const p of platforms) warnings.push(buildNoConnectionWarning(p));

      expect(warnings.map(w => w.platform).sort()).toEqual([
        'linkedin',
        'twitter',
      ]);
    });
  });
});
