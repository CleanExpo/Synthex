/**
 * SLO/SLI Monitoring and Alerting Configuration
 * Defines service level objectives and indicators
 */

export interface SLI {
  name: string;
  description: string;
  query: string;
  unit: string;
}

export interface SLO {
  name: string;
  description: string;
  sli: SLI;
  target: number;
  window: string;
  alertThreshold: number;
}

/**
 * Service Level Indicators
 */
export const SLIs: Record<string, SLI> = {
  ERROR_RATE: {
    name: 'error_rate',
    description: 'Percentage of requests resulting in errors',
    query: 'sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m]))',
    unit: 'percentage'
  },
  
  LATENCY_P95: {
    name: 'latency_p95',
    description: '95th percentile response time',
    query: 'histogram_quantile(0.95, http_request_duration_seconds_bucket)',
    unit: 'milliseconds'
  },
  
  LATENCY_P99: {
    name: 'latency_p99',
    description: '99th percentile response time',
    query: 'histogram_quantile(0.99, http_request_duration_seconds_bucket)',
    unit: 'milliseconds'
  },
  
  APDEX: {
    name: 'apdex',
    description: 'Application Performance Index',
    query: '(satisfied + tolerating * 0.5) / total',
    unit: 'score'
  },
  
  AVAILABILITY: {
    name: 'availability',
    description: 'Service uptime percentage',
    query: 'up{job="synthex"}',
    unit: 'percentage'
  },
  
  LCP: {
    name: 'largest_contentful_paint',
    description: 'Largest Contentful Paint timing',
    query: 'web_vitals_lcp_seconds',
    unit: 'seconds'
  },
  
  FID: {
    name: 'first_input_delay',
    description: 'First Input Delay',
    query: 'web_vitals_fid_milliseconds',
    unit: 'milliseconds'
  },
  
  CLS: {
    name: 'cumulative_layout_shift',
    description: 'Cumulative Layout Shift score',
    query: 'web_vitals_cls_score',
    unit: 'score'
  }
};

/**
 * Service Level Objectives
 */
export const SLOs: SLO[] = [
  {
    name: 'API Error Budget',
    description: '99.9% of API requests should succeed',
    sli: SLIs.ERROR_RATE,
    target: 0.1, // 0.1% error rate
    window: '30d',
    alertThreshold: 1.0 // Alert at 1% error rate
  },
  {
    name: 'API Latency Budget',
    description: '95% of requests under 500ms',
    sli: SLIs.LATENCY_P95,
    target: 500,
    window: '7d',
    alertThreshold: 750
  },
  {
    name: 'Critical Latency',
    description: '99% of requests under 2000ms',
    sli: SLIs.LATENCY_P99,
    target: 2000,
    window: '1d',
    alertThreshold: 3000
  },
  {
    name: 'User Experience',
    description: 'Apdex score above 0.85',
    sli: SLIs.APDEX,
    target: 0.85,
    window: '7d',
    alertThreshold: 0.75
  },
  {
    name: 'Service Availability',
    description: '99.95% uptime',
    sli: SLIs.AVAILABILITY,
    target: 99.95,
    window: '30d',
    alertThreshold: 99.5
  },
  {
    name: 'Page Load Performance',
    description: 'LCP under 2.5 seconds',
    sli: SLIs.LCP,
    target: 2.5,
    window: '7d',
    alertThreshold: 4.0
  }
];

/**
 * Alert Rules Configuration
 */
export const AlertRules = {
  // Critical Alerts (Page immediately)
  CRITICAL: [
    {
      name: 'high_error_rate',
      condition: 'error_rate > 5% for 1 minute',
      severity: 'critical',
      action: 'page_oncall',
      runbook: '/runbooks/high-error-rate.md'
    },
    {
      name: 'service_down',
      condition: 'availability == 0 for 30 seconds',
      severity: 'critical',
      action: 'page_oncall',
      runbook: '/runbooks/service-down.md'
    },
    {
      name: 'payment_system_failure',
      condition: 'payment_errors > 5 in 1 minute',
      severity: 'critical',
      action: 'page_oncall_and_kill_switch',
      runbook: '/runbooks/payment-failure.md'
    }
  ],
  
  // High Priority (Slack + Email)
  HIGH: [
    {
      name: 'elevated_error_rate',
      condition: 'error_rate > 1% for 5 minutes',
      severity: 'high',
      action: 'slack_and_email',
      runbook: '/runbooks/elevated-errors.md'
    },
    {
      name: 'slow_response_time',
      condition: 'p95_latency > 2000ms for 5 minutes',
      severity: 'high',
      action: 'slack_notification',
      runbook: '/runbooks/slow-response.md'
    },
    {
      name: 'memory_pressure',
      condition: 'memory_usage > 85% for 10 minutes',
      severity: 'high',
      action: 'slack_notification',
      runbook: '/runbooks/memory-pressure.md'
    }
  ],
  
  // Medium Priority (Slack only)
  MEDIUM: [
    {
      name: 'degraded_performance',
      condition: 'apdex < 0.8 for 15 minutes',
      severity: 'medium',
      action: 'slack_notification',
      runbook: '/runbooks/degraded-performance.md'
    },
    {
      name: 'elevated_4xx_errors',
      condition: '4xx_rate > 10% for 10 minutes',
      severity: 'medium',
      action: 'slack_notification',
      runbook: '/runbooks/client-errors.md'
    }
  ],
  
  // Low Priority (Dashboard only)
  LOW: [
    {
      name: 'cache_miss_rate',
      condition: 'cache_hit_rate < 60% for 30 minutes',
      severity: 'low',
      action: 'dashboard_alert',
      runbook: '/runbooks/cache-optimization.md'
    }
  ]
};

/**
 * Calculate error budget burn rate
 */
export function calculateBurnRate(
  currentErrorRate: number,
  sloTarget: number,
  timeWindow: number
): number {
  const budgetPerHour = (100 - sloTarget) / (timeWindow * 24);
  const currentBurn = currentErrorRate;
  return currentBurn / budgetPerHour;
}

/**
 * Check if SLO is at risk
 */
export function isSLOAtRisk(
  currentValue: number,
  slo: SLO
): { atRisk: boolean; severity: string } {
  const threshold = slo.alertThreshold;
  const target = slo.target;
  
  if (currentValue > threshold) {
    return { atRisk: true, severity: 'critical' };
  }
  
  if (currentValue > target * 1.5) {
    return { atRisk: true, severity: 'warning' };
  }
  
  return { atRisk: false, severity: 'ok' };
}

/**
 * Format alert message with context
 */
export function formatAlert(
  rule: any,
  currentValue: number,
  context: any
): string {
  return `
🚨 Alert: ${rule.name}
Severity: ${rule.severity}
Current Value: ${currentValue}
Condition: ${rule.condition}
Trace ID: ${context.traceId}
Runbook: ${rule.runbook}
Time: ${new Date().toISOString()}
  `.trim();
}