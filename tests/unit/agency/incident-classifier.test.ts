import {
  classifyIncident,
  formatIncidentReviewContent,
} from '@/lib/agency/incident-classifier';

describe('classifyIncident (AT-025)', () => {
  test('privacy + AMBER floors at severity 1', () => {
    const result = classifyIncident({
      type: 'privacy-breach',
      canarySignal: 'AMBER',
    });
    expect(result.severity).toBe(1);
    expect(result.severityFloor).toBe(1);
    expect(result.notifyExternal).toBe(false);
    expect(result.pageHuman).toBe(false);
    expect(result.storeForReviewOnly).toBe(true);
  });

  test('security + RED floors at severity 1', () => {
    expect(
      classifyIncident({ type: 'security', canarySignal: 'RED' }).severity
    ).toBe(1);
  });

  test('operational-SLA + AMBER floors at severity 2 (not 3)', () => {
    expect(
      classifyIncident({
        type: 'operational-SLA',
        canarySignal: 'AMBER',
      }).severity
    ).toBe(2);
  });

  test('operational-SLA + RED floors at severity 1', () => {
    expect(
      classifyIncident({
        type: 'operational-SLA',
        canarySignal: 'RED',
      }).severity
    ).toBe(1);
  });

  test('never downgrades below floor when proposedSeverity is softer', () => {
    const result = classifyIncident({
      type: 'customer-trust',
      canarySignal: 'AMBER',
      proposedSeverity: 3,
    });
    expect(result.severity).toBe(1);
    expect(result.defaultedHigher).toBe(true);
  });

  test('accepts proposedSeverity when it matches or is more urgent', () => {
    const result = classifyIncident({
      type: 'operational-SLA',
      canarySignal: 'AMBER',
      proposedSeverity: 1,
    });
    expect(result.severity).toBe(1);
    expect(result.defaultedHigher).toBe(false);
  });

  test('formatIncidentReviewContent states no notify / no page', () => {
    const classification = classifyIncident({
      type: 'data-loss',
      canarySignal: 'RED',
    });
    const text = formatIncidentReviewContent({
      incidentId: 'INC-2026-08-06-ABCD',
      detectedAt: '2026-08-06T00:00:00.000Z',
      type: 'data-loss',
      brand: 'RestoreAssist',
      canarySignal: 'RED',
      summary: 'Backup restore failed for org media.',
      classification,
      containmentStatus: 'in-progress',
    });
    expect(text).toContain('NOT notified');
    expect(text).toContain('NOT sent');
    expect(text).toContain('pending_review');
    expect(text).toContain('Severity: 1');
  });
});
