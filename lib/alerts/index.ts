/**
 * Alerts Module
 * Multi-channel alert notification system for SYNTHEX
 *
 * @task UNI-424 - Implement Alert Notification Channels
 *
 * @example
 * ```typescript
 * import { alertManager, AlertSeverity } from '@/lib/alerts';
 *
 * // Send an alert
 * await alertManager.sendAlert({
 *   title: 'High Error Rate',
 *   message: 'Error rate exceeded 5%',
 *   severity: AlertSeverity.ERROR,
 *   source: 'performance-monitor',
 * });
 *
 * // Convenience methods
 * await alertManager.warning('Rate Limit', 'Approaching limit', 'api-gateway');
 * await alertManager.critical('Database Down', 'Connection failed', 'health-check');
 * ```
 */

export {
  alertManager,
  AlertManager,
  AlertSeverity,
  NotificationChannel,
  type Alert,
  type ChannelConfig,
  type EmailConfig,
  type SlackConfig,
  type DiscordConfig,
  type WebhookConfig,
  type NotificationResult,
} from './notification-channels';
