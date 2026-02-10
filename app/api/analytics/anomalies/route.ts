/**
 * Anomaly Detection API
 *
 * @description Detect and manage anomalies in marketing metrics
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { anomalyDetector, MetricType, AnomalySeverity } from '@/lib/analytics/anomaly-detector';
import { logger } from '@/lib/logger';

// Request validation schemas
const DetectAnomaliesSchema = z.object({
  metrics: z.array(z.string()).optional(),
  platform: z.string().optional(),
  accountId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const UpdateConfigSchema = z.object({
  metricType: z.string(),
  enabled: z.boolean().optional(),
  sensitivity: z.enum(['low', 'medium', 'high']).optional(),
  minDataPoints: z.number().min(3).max(100).optional(),
  lookbackWindow: z.number().min(7).max(365).optional(),
  thresholds: z.object({
    absoluteMin: z.number().optional(),
    absoluteMax: z.number().optional(),
    percentChange: z.number().min(0).max(1000).optional(),
  }).optional(),
  alertChannels: z.array(z.enum(['email', 'slack', 'discord', 'in_app'])).optional(),
  cooldownMinutes: z.number().min(5).max(1440).optional(),
});

const AcknowledgeSchema = z.object({
  anomalyId: z.string(),
  notes: z.string().optional(),
});

const ResolveSchema = z.object({
  anomalyId: z.string(),
  resolution: z.string().optional(),
});

/**
 * GET /api/analytics/anomalies
 * Get anomalies or run detection
 */
export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    // Get summary
    if (searchParams.get('summary') === 'true') {
      const days = parseInt(searchParams.get('days') || '30', 10);
      const summary = await anomalyDetector.getAnomalySummary(userId, days);
      return APISecurityChecker.createSecureResponse({ summary });
    }

    // Run detection
    if (searchParams.get('detect') === 'true') {
      const metrics = searchParams.get('metrics')?.split(',') as MetricType[] | undefined;
      const platform = searchParams.get('platform') || undefined;
      const accountId = searchParams.get('accountId') || undefined;

      const result = await anomalyDetector.detectAnomalies(userId, {
        metrics,
        platform,
        accountId,
      });

      await auditLogger.logData(
        'read',
        'anomaly_detection',
        undefined,
        userId,
        'success',
        {
          metricsAnalyzed: result.analyzed,
          anomaliesFound: result.anomalies.length,
        }
      );

      return APISecurityChecker.createSecureResponse({
        result,
        detected: result.anomalies.length,
      });
    }

    // Get anomalies list
    const severity = searchParams.get('severity')?.split(',') as AnomalySeverity[] | undefined;
    const metricTypes = searchParams.get('metricTypes')?.split(',') as MetricType[] | undefined;
    const acknowledged = searchParams.get('acknowledged');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const { anomalies, total } = await anomalyDetector.getAnomalies(userId, {
      severity,
      metricTypes,
      acknowledged: acknowledged !== null ? acknowledged === 'true' : undefined,
      limit,
      offset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return APISecurityChecker.createSecureResponse({
      anomalies,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    logger.error('Anomaly GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/analytics/anomalies
 * Run detection or update configuration
 */
export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const action = searchParams.get('action');

    // Run detection
    if (action === 'detect') {
      const validated = DetectAnomaliesSchema.parse(body);

      const result = await anomalyDetector.detectAnomalies(userId, {
        metrics: validated.metrics as MetricType[],
        platform: validated.platform,
        accountId: validated.accountId,
        startDate: validated.startDate ? new Date(validated.startDate) : undefined,
        endDate: validated.endDate ? new Date(validated.endDate) : undefined,
      });

      await auditLogger.logData(
        'read',
        'anomaly_detection',
        undefined,
        userId,
        'success',
        {
          metricsAnalyzed: result.analyzed,
          anomaliesFound: result.anomalies.length,
        }
      );

      return APISecurityChecker.createSecureResponse({
        result,
        detected: result.anomalies.length,
      });
    }

    // Update configuration
    if (action === 'config') {
      const validated = UpdateConfigSchema.parse(body);

      const success = await anomalyDetector.updateConfig(
        userId,
        validated.metricType as MetricType,
        {
          enabled: validated.enabled,
          sensitivity: validated.sensitivity,
          minDataPoints: validated.minDataPoints,
          lookbackWindow: validated.lookbackWindow,
          thresholds: validated.thresholds,
          alertChannels: validated.alertChannels,
          cooldownMinutes: validated.cooldownMinutes,
        }
      );

      if (!success) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Failed to update configuration' },
          500
        );
      }

      await auditLogger.logData(
        'update',
        'anomaly_config',
        validated.metricType,
        userId,
        'success',
        { metricType: validated.metricType }
      );

      return APISecurityChecker.createSecureResponse({
        success: true,
        metricType: validated.metricType,
      });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Anomaly POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/analytics/anomalies
 * Acknowledge or resolve anomalies
 */
export async function PUT(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const action = searchParams.get('action');

    // Acknowledge anomaly
    if (action === 'acknowledge') {
      const validated = AcknowledgeSchema.parse(body);

      const success = await anomalyDetector.acknowledgeAnomaly(
        validated.anomalyId,
        userId,
        validated.notes
      );

      if (!success) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Failed to acknowledge anomaly' },
          500
        );
      }

      await auditLogger.logData(
        'update',
        'anomaly',
        validated.anomalyId,
        userId,
        'success',
        { action: 'acknowledge' }
      );

      return APISecurityChecker.createSecureResponse({
        success: true,
        anomalyId: validated.anomalyId,
      });
    }

    // Resolve anomaly
    if (action === 'resolve') {
      const validated = ResolveSchema.parse(body);

      const success = await anomalyDetector.resolveAnomaly(
        validated.anomalyId,
        userId,
        validated.resolution
      );

      if (!success) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Failed to resolve anomaly' },
          500
        );
      }

      await auditLogger.logData(
        'update',
        'anomaly',
        validated.anomalyId,
        userId,
        'success',
        { action: 'resolve' }
      );

      return APISecurityChecker.createSecureResponse({
        success: true,
        anomalyId: validated.anomalyId,
      });
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid action' },
      400
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Anomaly PUT error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
