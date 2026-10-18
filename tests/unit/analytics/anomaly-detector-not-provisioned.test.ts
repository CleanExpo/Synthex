/**
 * P2 noop-client retirement — lib/analytics/anomaly-detector.ts.
 *
 * The anomaly tables (analytics_metrics, anomalies, anomaly_alerts,
 * anomaly_detection_configs) have no Prisma model, so every data path must
 * throw AnomalyStoreNotProvisionedError rather than return an empty "no
 * anomalies" result. In-app alerts are ported to prisma.notification and must
 * be written for the anomaly's own user only.
 */

const mockNotificationCreate = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
    },
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  anomalyDetector,
  AnomalyStoreNotProvisionedError,
} from '@/lib/analytics/anomaly-detector';

async function expectNotProvisioned(p: Promise<unknown>, table: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(AnomalyStoreNotProvisionedError);
  expect(err).toMatchObject({ code: 'FEATURE_NOT_PROVISIONED', table });
}

describe('anomalyDetector — NOT_PROVISIONED data paths', () => {
  it('detectAnomalies throws instead of returning an empty result', async () => {
    await expectNotProvisioned(
      anomalyDetector.detectAnomalies('user-1'),
      'anomaly_detection_configs'
    );
  });

  it('getAnomalies throws instead of returning { anomalies: [], total: 0 }', async () => {
    await expectNotProvisioned(
      anomalyDetector.getAnomalies('user-1'),
      'anomalies'
    );
  });

  it('getAnomalySummary throws instead of returning zero counts', async () => {
    await expectNotProvisioned(
      anomalyDetector.getAnomalySummary('user-1'),
      'anomalies'
    );
  });

  it('acknowledge / resolve / updateConfig throw instead of reporting a write', async () => {
    await expectNotProvisioned(
      anomalyDetector.acknowledgeAnomaly('a1', 'user-1'),
      'anomalies'
    );
    await expectNotProvisioned(
      anomalyDetector.resolveAnomaly('a1', 'user-1'),
      'anomalies'
    );
    await expectNotProvisioned(
      anomalyDetector.updateConfig('user-1', 'engagement_rate', {
        enabled: true,
      }),
      'anomaly_detection_configs'
    );
  });
});

describe('anomalyDetector — in-app alert ported to Prisma', () => {
  beforeEach(() =>
    mockNotificationCreate.mockReset().mockResolvedValue({ id: 'n1' })
  );

  it('creates a notification scoped to the anomaly owner', async () => {
    const anomaly = {
      id: 'anomaly_1',
      userId: 'user-42',
      metricType: 'engagement_rate',
      anomalyType: 'spike',
      severity: 'high',
      value: 9,
      expectedValue: 3,
      recommendations: ['Review content'],
    };

    await (
      anomalyDetector as unknown as {
        sendInAppAlert(a: unknown): Promise<void>;
      }
    ).sendInAppAlert(anomaly);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const arg = mockNotificationCreate.mock.calls[0][0];
    expect(arg.data.userId).toBe('user-42');
    expect(arg.data).toMatchObject({
      type: 'anomaly_detected',
      read: false,
      data: { anomalyId: 'anomaly_1', severity: 'high' },
    });
  });
});
