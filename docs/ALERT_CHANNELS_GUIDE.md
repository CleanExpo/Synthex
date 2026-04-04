# SYNTHEX Alert Notification Channels Guide

> **Task:** UNI-424 - Implement Alert Notification Channels

This guide covers configuring and using alert notification channels for the SYNTHEX monitoring system.

## Table of Contents

1. [Overview](#overview)
2. [Supported Channels](#supported-channels)
3. [Configuration](#configuration)
4. [API Reference](#api-reference)
5. [Programmatic Usage](#programmatic-usage)
6. [Integration Examples](#integration-examples)

---

## Overview

The Alert Notification System sends monitoring alerts to multiple channels:

- **Console** - Always enabled, logs to application console
- **Email** - Via Resend API
- **Slack** - Via incoming webhooks
- **Discord** - Via webhooks
- **Webhook** - Generic HTTP webhooks for custom integrations

### Alert Severity Levels

| Severity | Description | Default Channels |
|----------|-------------|------------------|
| `info` | Informational messages | Console only |
| `warning` | Potential issues | Console, Slack, Discord |
| `error` | Failures | Console, Slack, Discord, Email |
| `critical` | System-wide emergencies | All channels |

---

## Supported Channels

### Console

Always enabled. Logs alerts with appropriate log levels.

```typescript
// No configuration needed
// Alerts appear in server logs
```

### Email (Resend)

Send alerts via email using the Resend API.

```env
ALERT_EMAIL_API_KEY=re_xxxxxxxxxxxx
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=team@company.com,oncall@company.com
ALERT_EMAIL_FROM_NAME=SYNTHEX Alerts
ALERT_EMAIL_MIN_SEVERITY=error
```

### Slack

Send alerts to Slack channels via incoming webhooks.

```env
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
ALERT_SLACK_CHANNEL=#alerts
ALERT_SLACK_USERNAME=SYNTHEX Bot
ALERT_SLACK_ICON_EMOJI=:robot_face:
ALERT_SLACK_MIN_SEVERITY=warning
```

### Discord

Send alerts to Discord channels via webhooks.

```env
ALERT_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/xxx
ALERT_DISCORD_USERNAME=SYNTHEX Bot
ALERT_DISCORD_AVATAR_URL=https://yoursite.com/bot-avatar.png
ALERT_DISCORD_MIN_SEVERITY=warning
```

### Generic Webhook

Send alerts to any HTTP endpoint.

```env
ALERT_WEBHOOK_URL=https://api.yourservice.com/alerts
ALERT_WEBHOOK_METHOD=POST
ALERT_WEBHOOK_HEADERS={"X-Custom-Header": "value"}
ALERT_WEBHOOK_AUTH=Bearer your-api-token
ALERT_WEBHOOK_MIN_SEVERITY=warning
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALERT_EMAIL_API_KEY` | For email | Resend API key |
| `ALERT_EMAIL_FROM` | For email | Sender email address |
| `ALERT_EMAIL_TO` | For email | Comma-separated recipient emails |
| `ALERT_EMAIL_FROM_NAME` | No | Sender display name |
| `ALERT_EMAIL_MIN_SEVERITY` | No | Minimum severity (default: error) |
| `ALERT_SLACK_WEBHOOK_URL` | For Slack | Slack webhook URL |
| `ALERT_SLACK_CHANNEL` | No | Override channel |
| `ALERT_SLACK_USERNAME` | No | Bot username |
| `ALERT_SLACK_ICON_EMOJI` | No | Bot emoji |
| `ALERT_SLACK_MIN_SEVERITY` | No | Minimum severity (default: warning) |
| `ALERT_DISCORD_WEBHOOK_URL` | For Discord | Discord webhook URL |
| `ALERT_DISCORD_USERNAME` | No | Bot username |
| `ALERT_DISCORD_AVATAR_URL` | No | Bot avatar URL |
| `ALERT_DISCORD_MIN_SEVERITY` | No | Minimum severity (default: warning) |
| `ALERT_WEBHOOK_URL` | For webhook | Endpoint URL |
| `ALERT_WEBHOOK_METHOD` | No | HTTP method (default: POST) |
| `ALERT_WEBHOOK_HEADERS` | No | JSON string of headers |
| `ALERT_WEBHOOK_AUTH` | No | Authorization header value |
| `ALERT_WEBHOOK_MIN_SEVERITY` | No | Minimum severity (default: warning) |

---

## API Reference

### Get Channels and History

```bash
# Full view (channels + history)
GET /api/monitoring/alerts

# Channels only
GET /api/monitoring/alerts?view=channels

# History only
GET /api/monitoring/alerts?view=history&count=50
```

**Response:**

```json
{
  "success": true,
  "channels": [
    {
      "type": "console",
      "enabled": true,
      "minSeverity": "info"
    },
    {
      "type": "slack",
      "enabled": true,
      "minSeverity": "warning"
    }
  ],
  "alerts": [
    {
      "id": "alert_1707123456789_abc123",
      "title": "High Error Rate",
      "message": "Error rate exceeded 5%",
      "severity": "error",
      "source": "performance-monitor",
      "timestamp": "2026-02-02T10:30:00.000Z"
    }
  ],
  "alertCount": 1
}
```

### Send Alert

```bash
POST /api/monitoring/alerts
Content-Type: application/json

{
  "title": "High Error Rate",
  "message": "Error rate exceeded 5% threshold",
  "severity": "error",
  "source": "performance-monitor",
  "metadata": {
    "errorRate": 6.2,
    "threshold": 5
  },
  "tags": ["performance", "api"]
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "channel": "console",
      "success": true,
      "timestamp": "2026-02-02T10:30:00.000Z"
    },
    {
      "channel": "slack",
      "success": true,
      "timestamp": "2026-02-02T10:30:00.100Z"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

### Test Channel

```bash
POST /api/monitoring/alerts?action=test
Content-Type: application/json

{
  "channel": "slack"
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "channel": "slack",
    "success": true,
    "timestamp": "2026-02-02T10:30:00.000Z"
  }
}
```

---

## Programmatic Usage

### Basic Usage

```typescript
import { alertManager, AlertSeverity } from '@/lib/alerts';

// Send a custom alert
await alertManager.sendAlert({
  title: 'Database Connection Failed',
  message: 'Unable to connect to primary database after 3 retries',
  severity: AlertSeverity.CRITICAL,
  source: 'database-health-check',
  metadata: {
    retries: 3,
    lastError: 'Connection timeout',
  },
  tags: ['database', 'connectivity'],
});
```

### Convenience Methods

```typescript
import { alertManager } from '@/lib/alerts';

// Info alert (console only by default)
await alertManager.info(
  'Deployment Complete',
  'Version 2.1.0 deployed successfully',
  'ci-pipeline'
);

// Warning alert
await alertManager.warning(
  'Rate Limit Approaching',
  'API rate limit at 80%',
  'rate-limiter',
  { current: 80, limit: 100 }
);

// Error alert
await alertManager.error(
  'Payment Failed',
  'Stripe payment processing failed',
  'payment-service',
  { orderId: '12345', errorCode: 'card_declined' }
);

// Critical alert (all channels)
await alertManager.critical(
  'System Outage',
  'Multiple services are down',
  'health-monitor',
  { affectedServices: ['api', 'database', 'cache'] }
);
```

### Managing Channels

```typescript
import { alertManager, NotificationChannel, AlertSeverity } from '@/lib/alerts';

// Get configured channels
const channels = alertManager.getChannels();

// Enable/disable a channel
alertManager.setChannelEnabled(NotificationChannel.SLACK, false);

// Add a custom channel
alertManager.addChannel({
  type: NotificationChannel.WEBHOOK,
  enabled: true,
  minSeverity: AlertSeverity.ERROR,
  config: {
    url: 'https://api.custom.com/alerts',
    method: 'POST',
    authHeader: 'Bearer token',
  },
});

// Test a channel
const result = await alertManager.testChannel(NotificationChannel.SLACK);
console.log(result.success ? 'Channel working!' : `Failed: ${result.error}`);
```

### Get Alert History

```typescript
import { alertManager } from '@/lib/alerts';

// Get last 50 alerts
const history = alertManager.getHistory(50);

for (const alert of history) {
  console.log(`[${alert.severity}] ${alert.title}: ${alert.message}`);
}
```

---

## Integration Examples

### With Performance Monitor

```typescript
import performanceMonitor from '@/lib/monitoring/performance-monitor';
import { alertManager, AlertSeverity } from '@/lib/alerts';

// Check performance and alert
const report = await performanceMonitor.generateReport(5);

if (report.api.errorRate > 5) {
  await alertManager.sendAlert({
    title: 'High Error Rate',
    message: `Error rate is ${report.api.errorRate.toFixed(1)}% (threshold: 5%)`,
    severity: report.api.errorRate > 10 ? AlertSeverity.CRITICAL : AlertSeverity.ERROR,
    source: 'performance-monitor',
    metadata: {
      errorRate: report.api.errorRate,
      p95: report.api.p95,
      totalRequests: report.api.totalRequests,
    },
  });
}
```

### With Error Tracker

```typescript
import { trackError, ErrorSeverity as ESeverity } from '@/lib/observability';
import { alertManager, AlertSeverity } from '@/lib/alerts';

// Track error and send alert for critical errors
function handleError(error: Error, context: any) {
  const tracked = trackError(error, context);

  // Alert on high/critical errors
  if (tracked.severity === ESeverity.HIGH || tracked.severity === ESeverity.CRITICAL) {
    alertManager.sendAlert({
      title: `${tracked.category} Error`,
      message: error.message,
      severity: tracked.severity === ESeverity.CRITICAL
        ? AlertSeverity.CRITICAL
        : AlertSeverity.ERROR,
      source: 'error-tracker',
      metadata: {
        errorId: tracked.id,
        category: tracked.category,
        count: tracked.count,
      },
    });
  }
}
```

### With Health Dashboard

```typescript
import { getSystemHealth } from '@/lib/observability';
import { alertManager, AlertSeverity } from '@/lib/alerts';

// Periodic health check with alerts
async function healthCheck() {
  const health = await getSystemHealth();

  if (health.status === 'unhealthy') {
    await alertManager.critical(
      'System Unhealthy',
      `System status is unhealthy: ${health.alerts.join(', ')}`,
      'health-dashboard',
      {
        components: health.components.filter(c => c.status !== 'healthy'),
        alerts: health.alerts,
      }
    );
  } else if (health.status === 'degraded') {
    await alertManager.warning(
      'System Degraded',
      `System performance degraded: ${health.alerts.join(', ')}`,
      'health-dashboard',
      {
        components: health.components.filter(c => c.status === 'degraded'),
        alerts: health.alerts,
      }
    );
  }
}
```

---

## Slack Message Format

Alerts sent to Slack include:
- Severity emoji and color-coded attachment
- Title and message
- Source and severity fields
- Tags (if provided)
- Timestamp

## Discord Message Format

Alerts sent to Discord include:
- Embedded message with severity color
- Title, description, and fields
- Footer with timestamp

## Email Format

Emails include:
- HTML formatted message with severity styling
- Plain text fallback
- All alert details

---

## Related Documentation

- [Observability Guide](./OBSERVABILITY_GUIDE.md)
- [Business Metrics Guide](./BUSINESS_METRICS_GUIDE.md)
- [API Reference](./API_REFERENCE.md)

---

*Last updated: 2026-02-02*
