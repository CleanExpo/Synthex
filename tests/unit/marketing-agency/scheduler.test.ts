/**
 * Unit test for the Marketing Agency cadence scheduler.
 *
 * Pure function — no DB / network. Verifies cadence math for hourly,
 * daily, weekly, and the manual/paused/archived skip rules.
 */
import {
  selectDueAgents,
  type SchedulableAgent,
} from '@/lib/marketing-agency/agent/scheduler';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const NOW = new Date('2026-05-25T12:00:00.000Z');

function agent(overrides: Partial<SchedulableAgent>): SchedulableAgent {
  const { id, ...rest } = overrides;
  return {
    id: 'agent-' + (id ?? 'x'),
    organizationId: 'org-1',
    createdById: 'user-1',
    cadence: 'manual',
    status: 'active',
    lastRunAt: null,
    ...rest,
  };
}

describe('selectDueAgents', () => {
  test('manual cadence is never due, regardless of lastRunAt', () => {
    const result = selectDueAgents(
      [
        agent({ id: '1', cadence: 'manual', lastRunAt: null }),
        agent({
          id: '2',
          cadence: 'manual',
          lastRunAt: new Date(NOW.getTime() - WEEK),
        }),
      ],
      NOW
    );
    expect(result).toEqual([]);
  });

  test('paused / archived agents are skipped even if cadence interval passed', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'daily',
          status: 'paused',
          lastRunAt: new Date(NOW.getTime() - DAY * 2),
        }),
        agent({
          id: '2',
          cadence: 'daily',
          status: 'archived',
          lastRunAt: null,
        }),
      ],
      NOW
    );
    expect(result).toEqual([]);
  });

  test('hourly: due if lastRunAt is null', () => {
    const result = selectDueAgents(
      [agent({ id: '1', cadence: 'hourly', lastRunAt: null })],
      NOW
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      agentId: 'agent-1',
      trigger: 'cadence-hourly',
    });
    expect(result[0].nextRunAt.getTime()).toBe(NOW.getTime() + HOUR);
  });

  test('hourly: due if lastRunAt was 61 minutes ago', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'hourly',
          lastRunAt: new Date(NOW.getTime() - HOUR - 60_000),
        }),
      ],
      NOW
    );
    expect(result).toHaveLength(1);
  });

  test('hourly: not due if lastRunAt was 59 minutes ago', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'hourly',
          lastRunAt: new Date(NOW.getTime() - 59 * 60_000),
        }),
      ],
      NOW
    );
    expect(result).toEqual([]);
  });

  test('daily: due exactly at the boundary (lastRunAt + 24h <= now)', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'daily',
          lastRunAt: new Date(NOW.getTime() - DAY),
        }),
      ],
      NOW
    );
    expect(result).toHaveLength(1);
    expect(result[0].trigger).toBe('cadence-daily');
  });

  test('daily: not due 23h after lastRunAt', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'daily',
          lastRunAt: new Date(NOW.getTime() - 23 * HOUR),
        }),
      ],
      NOW
    );
    expect(result).toEqual([]);
  });

  test('weekly: due 7 days + 1 minute after lastRunAt', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'weekly',
          lastRunAt: new Date(NOW.getTime() - WEEK - 60_000),
        }),
      ],
      NOW
    );
    expect(result).toHaveLength(1);
    expect(result[0].trigger).toBe('cadence-weekly');
    expect(result[0].nextRunAt.getTime()).toBe(NOW.getTime() + WEEK);
  });

  test('mixed batch returns only due agents', () => {
    const result = selectDueAgents(
      [
        agent({ id: 'a', cadence: 'hourly', lastRunAt: null }), // due
        agent({
          id: 'b',
          cadence: 'daily',
          lastRunAt: new Date(NOW.getTime() - 12 * HOUR),
        }), // not due
        agent({
          id: 'c',
          cadence: 'weekly',
          lastRunAt: new Date(NOW.getTime() - 8 * DAY),
        }), // due
        agent({ id: 'd', cadence: 'manual', lastRunAt: null }), // never due
        agent({ id: 'e', cadence: 'daily', status: 'paused', lastRunAt: null }), // skipped
      ],
      NOW
    );
    const ids = result.map(r => r.agentId).sort();
    expect(ids).toEqual(['agent-a', 'agent-c']);
  });

  test('unknown cadence string is skipped (forward-compat)', () => {
    const result = selectDueAgents(
      [agent({ id: '1', cadence: 'every-tuesday', lastRunAt: null })],
      NOW
    );
    expect(result).toEqual([]);
  });

  test('nextRunAt is `now + interval`, not `lastRunAt + interval` (so it never drifts backwards)', () => {
    const result = selectDueAgents(
      [
        agent({
          id: '1',
          cadence: 'daily',
          lastRunAt: new Date(NOW.getTime() - 3 * DAY),
        }),
      ],
      NOW
    );
    expect(result[0].nextRunAt.getTime()).toBe(NOW.getTime() + DAY);
  });
});
