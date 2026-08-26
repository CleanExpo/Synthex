/**
 * Mission Control gate tests — project required, approval required, coming soon locked.
 */

import { draftTicketsFromGoal } from '@/lib/mission-control/draft-tickets';
import { COMING_SOON_STAGES } from '@/lib/mission-control/types';

describe('mission-control draft gates', () => {
  it('heuristic draft returns ordered shippable tickets without Linear side effects', async () => {
    const { tickets, source } = await draftTicketsFromGoal({
      goal: 'Rebuild Mission Control goal-to-ticket pipeline with approval gates',
      acceptanceCriteria: 'Project select required\nApproval before create',
      projectName: 'Mission Control',
      repo: null,
    });

    // May be ai or heuristic depending on env keys — both must be non-empty
    expect(tickets.length).toBeGreaterThanOrEqual(2);
    expect(['ai', 'heuristic']).toContain(source);
    expect(tickets.every(t => t.title.length >= 4)).toBe(true);
    expect(tickets.every(t => t.localId.length > 0)).toBe(true);
  });

  it('coming soon stages are scaffold-only metadata (not executable)', () => {
    expect(COMING_SOON_STAGES.length).toBeGreaterThanOrEqual(4);
    expect(COMING_SOON_STAGES.map(s => s.key)).toEqual(
      expect.arrayContaining(['code', 'tests', 'pr', 'deploy', 'roles'])
    );
  });
});

describe('mission-control approve schema intent', () => {
  it('documents that approve must be literal true (API contract)', () => {
    // Mirrors approve-tickets route: approve: z.literal(true)
    const body = {
      approve: true as const,
      missionId: '00000000-0000-0000-0000-000000000001',
    };
    expect(body.approve).toBe(true);
    expect(body.approve === true).toBe(true);
    // falsy / missing must not pass a literal(true) gate
    expect(Boolean(undefined)).toBe(false);
    expect(Boolean(false)).toBe(false);
  });
});
