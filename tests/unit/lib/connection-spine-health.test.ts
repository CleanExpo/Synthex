/**
 * SYN-1030 — connection-health spine mapping.
 */

import {
  mapConnectionSpineHealth,
  type ConnectionSpineSignals,
} from '@/lib/connection-spine/health';

function signals(overrides: Partial<ConnectionSpineSignals> = {}): ConnectionSpineSignals {
  return {
    linear: { webhookConfigured: true, queueReachable: true },
    obsidian: { enabled: true },
    hermes: { status: 'ready' },
    social: { referenceCount: 3, needsReauthCount: 0 },
    ...overrides,
  };
}

describe('mapConnectionSpineHealth (SYN-1030)', () => {
  it('reports all systems ready when every signal is healthy', () => {
    const health = mapConnectionSpineHealth(signals());
    expect(health.overall).toBe('ready');
    expect(health.blockerCount).toBe(0);
    expect(health.systems.map(s => s.system)).toEqual([
      'linear',
      'obsidian',
      'hermes',
      'social',
    ]);
    expect(health.systems.every(s => s.status === 'ready')).toBe(true);
    // Ready systems carry no action.
    expect(health.systems.every(s => s.action === undefined)).toBe(true);
  });

  it('flags Linear as action_required with an operator action when the webhook is missing', () => {
    const linear = mapConnectionSpineHealth(
      signals({ linear: { webhookConfigured: false, queueReachable: true } })
    ).systems.find(s => s.system === 'linear')!;
    expect(linear.status).toBe('action_required');
    expect(linear.action).toMatch(/webhook secret/i);
  });

  it('marks Linear stale (not blocked) when the queue is unreachable', () => {
    const linear = mapConnectionSpineHealth(
      signals({ linear: { webhookConfigured: true, queueReachable: false } })
    ).systems.find(s => s.system === 'linear')!;
    expect(linear.status).toBe('stale');
  });

  it('maps a blocked Hermes gateway to blocked and drives the overall status', () => {
    const health = mapConnectionSpineHealth(signals({ hermes: { status: 'blocked' } }));
    expect(health.systems.find(s => s.system === 'hermes')!.status).toBe('blocked');
    expect(health.overall).toBe('blocked');
  });

  it('maps a degraded Hermes gateway to stale', () => {
    const hermes = mapConnectionSpineHealth(
      signals({ hermes: { status: 'degraded' } })
    ).systems.find(s => s.system === 'hermes')!;
    expect(hermes.status).toBe('stale');
  });

  it('flags Obsidian writeback when the vault is not enabled', () => {
    const obsidian = mapConnectionSpineHealth(
      signals({ obsidian: { enabled: false } })
    ).systems.find(s => s.system === 'obsidian')!;
    expect(obsidian.status).toBe('action_required');
    expect(obsidian.action).toMatch(/vault/i);
  });

  it('flags no social connections, and re-auth when some are expired', () => {
    const none = mapConnectionSpineHealth(
      signals({ social: { referenceCount: 0, needsReauthCount: 0 } })
    ).systems.find(s => s.system === 'social')!;
    expect(none.status).toBe('action_required');
    expect(none.detail).toMatch(/no social connections/i);

    const reauth = mapConnectionSpineHealth(
      signals({ social: { referenceCount: 4, needsReauthCount: 2 } })
    ).systems.find(s => s.system === 'social')!;
    expect(reauth.status).toBe('action_required');
    expect(reauth.detail).toMatch(/2 social connections need/i);
  });

  it('counts blockers and picks the worst status as overall', () => {
    const health = mapConnectionSpineHealth(
      signals({
        obsidian: { enabled: false },
        social: { referenceCount: 0, needsReauthCount: 0 },
      })
    );
    expect(health.blockerCount).toBe(2);
    expect(health.overall).toBe('action_required');
  });
});
