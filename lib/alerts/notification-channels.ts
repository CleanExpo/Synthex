/**
 * Alert Notification Channels
 * Multi-channel alert delivery system for SYNTHEX monitoring
 *
 * @task UNI-424 - Implement Alert Notification Channels
 *
 * Supported channels:
 * - Email (via Resend API)
 * - Slack webhooks
 * - Discord webhooks
 * - Generic HTTP webhooks
 * - Console logging
 *
 * Usage:
 * ```typescript
 * import { AlertManager } from '@/lib/alerts';
 *
 * alertManager.sendAlert({
 *   title: 'High Error Rate',
 *   message: 'Error rate exceeded 5%',
 *   severity: AlertSeverity.HIGH,
 *   source: 'performance-monitor',
 * });
 * ```
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

/** Slack webhook payload structure */
interface SlackAttachmentField {
  title: string;
  value: string;
  short: boolean;
}

interface SlackAttachment {
  color: string;
  fields: SlackAttachmentField[];
  footer: string;
  ts: number;
}

interface SlackPayload {
  text: string;
  attachments: SlackAttachment[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

/** Discord webhook payload structure */
interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp: string;
}

interface DiscordPayload {
  content: string;
  embeds: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum NotificationChannel {
  CONSOLE = 'console',
  EMAIL = 'email',
  SLACK = 'slack',
  DISCORD = 'discord',
  WEBHOOK = 'webhook',
}

export interface Alert {
  id?: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ChannelConfig {
  type: NotificationChannel;
  enabled: boolean;
  minSeverity: AlertSeverity;
  config: Record<string, string>;
}

export interface EmailConfig extends ChannelConfig {
  type: NotificationChannel.EMAIL;
  config: {
    apiKey: string;
    fromEmail: string;
    toEmails: string;
    fromName?: string;
  };
}

export interface SlackConfig extends ChannelConfig {
  type: NotificationChannel.SLACK;
  config: {
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
  };
}

export interface DiscordConfig extends ChannelConfig {
  type: NotificationChannel.DISCORD;
  config: {
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
  };
}

export interface WebhookConfig extends ChannelConfig {
  type: NotificationChannel.WEBHOOK;
  config: {
    url: string;
    method?: string;
    headers?: string;
    authHeader?: string;
  };
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// SEVERITY UTILITIES
// ============================================================================

const SEVERITY_LEVELS: Record<AlertSeverity, number> = {
  [AlertSeverity.INFO]: 0,
  [AlertSeverity.WARNING]: 1,
  [AlertSeverity.ERROR]: 2,
  [AlertSeverity.CRITICAL]: 3,
};

function severityMeetsMinimum(
  severity: AlertSeverity,
  minSeverity: AlertSeverity
): boolean {
  return SEVERITY_LEVELS[severity] >= SEVERITY_LEVELS[minSeverity];
}

function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.INFO:
      return '#3498db'; // Blue
    case AlertSeverity.WARNING:
      return '#f39c12'; // Orange
    case AlertSeverity.ERROR:
      return '#e74c3c'; // Red
    case AlertSeverity.CRITICAL:
      return '#9b59b6'; // Purple
  }
}

function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.INFO:
      return 'ℹ️';
    case AlertSeverity.WARNING:
      return '⚠️';
    case AlertSeverity.ERROR:
      return '🚨';
    case AlertSeverity.CRITICAL:
      return '🔥';
  }
}

// ============================================================================
// CHANNEL HANDLERS
// ============================================================================

async function sendConsoleAlert(alert: Alert): Promise<NotificationResult> {
  const emoji = getSeverityEmoji(alert.severity);
  const logFn = alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.ERROR
    ? logger.error
    : alert.severity === AlertSeverity.WARNING
      ? logger.warn
      : logger.info;

  logFn(`${emoji} [ALERT] ${alert.title}`, {
    message: alert.message,
    severity: alert.severity,
    source: alert.source,
    tags: alert.tags,
    metadata: alert.metadata,
  });

  return {
    channel: NotificationChannel.CONSOLE,
    success: true,
    timestamp: new Date(),
  };
}

async function sendEmailAlert(
  alert: Alert,
  config: EmailConfig['config']
): Promise<NotificationResult> {
  try {
    const { apiKey, fromEmail, toEmails, fromName } = config;
    const recipients = toEmails.split(',').map(e => e.trim());

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: recipients,
        subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        html: formatEmailHtml(alert),
        text: formatEmailText(alert),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    return {
      channel: NotificationChannel.EMAIL,
      success: true,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      channel: NotificationChannel.EMAIL,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

async function sendSlackAlert(
  alert: Alert,
  config: SlackConfig['config']
): Promise<NotificationResult> {
  try {
    const { webhookUrl, channel, username, iconEmoji } = config;

    const payload: SlackPayload = {
      text: `${getSeverityEmoji(alert.severity)} *${alert.title}*`,
      attachments: [
        {
          color: getSeverityColor(alert.severity),
          fields: [
            {
              title: 'Message',
              value: alert.message,
              short: false,
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Source',
              value: alert.source,
              short: true,
            },
          ],
          footer: 'SYNTHEX Monitoring',
          ts: Math.floor((alert.timestamp || new Date()).getTime() / 1000),
        },
      ],
    };

    if (channel) payload.channel = channel;
    if (username) payload.username = username;
    if (iconEmoji) payload.icon_emoji = iconEmoji;

    // Add tags as field if present
    if (alert.tags && alert.tags.length > 0) {
      payload.attachments[0].fields.push({
        title: 'Tags',
        value: alert.tags.join(', '),
        short: true,
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook error: ${response.status}`);
    }

    return {
      channel: NotificationChannel.SLACK,
      success: true,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      channel: NotificationChannel.SLACK,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

async function sendDiscordAlert(
  alert: Alert,
  config: DiscordConfig['config']
): Promise<NotificationResult> {
  try {
    const { webhookUrl, username, avatarUrl } = config;

    const payload: DiscordPayload = {
      content: `${getSeverityEmoji(alert.severity)} **${alert.title}**`,
      embeds: [
        {
          title: alert.title,
          description: alert.message,
          color: parseInt(getSeverityColor(alert.severity).replace('#', ''), 16),
          fields: [
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Source',
              value: alert.source,
              inline: true,
            },
          ],
          footer: {
            text: 'SYNTHEX Monitoring',
          },
          timestamp: (alert.timestamp || new Date()).toISOString(),
        },
      ],
    };

    if (username) payload.username = username;
    if (avatarUrl) payload.avatar_url = avatarUrl;

    // Add tags if present
    if (alert.tags && alert.tags.length > 0) {
      payload.embeds[0].fields.push({
        name: 'Tags',
        value: alert.tags.join(', '),
        inline: true,
      });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook error: ${response.status}`);
    }

    return {
      channel: NotificationChannel.DISCORD,
      success: true,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      channel: NotificationChannel.DISCORD,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

async function sendWebhookAlert(
  alert: Alert,
  config: WebhookConfig['config']
): Promise<NotificationResult> {
  try {
    const { url, method = 'POST', headers: headersJson, authHeader } = config;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Parse custom headers
    if (headersJson) {
      try {
        const customHeaders = JSON.parse(headersJson);
        Object.assign(headers, customHeaders);
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Add auth header if provided
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const payload = {
      alert: {
        id: alert.id || generateAlertId(),
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        source: alert.source,
        timestamp: (alert.timestamp || new Date()).toISOString(),
        tags: alert.tags,
        metadata: alert.metadata,
      },
      platform: 'SYNTHEX',
      version: '2.0.1',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`);
    }

    return {
      channel: NotificationChannel.WEBHOOK,
      success: true,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      channel: NotificationChannel.WEBHOOK,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// FORMATTERS
// ============================================================================

function formatEmailHtml(alert: Alert): string {
  const color = getSeverityColor(alert.severity);
  const emoji = getSeverityEmoji(alert.severity);

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: ${color}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-top: 8px; }
    .body { padding: 20px; }
    .field { margin-bottom: 16px; }
    .field-label { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
    .field-value { color: #333; }
    .footer { background: #f9f9f9; padding: 16px 20px; font-size: 12px; color: #666; }
    .tags { display: flex; gap: 8px; flex-wrap: wrap; }
    .tag { background: #e0e0e0; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} ${alert.title}</h1>
      <span class="badge">${alert.severity.toUpperCase()}</span>
    </div>
    <div class="body">
      <div class="field">
        <div class="field-label">Message</div>
        <div class="field-value">${alert.message}</div>
      </div>
      <div class="field">
        <div class="field-label">Source</div>
        <div class="field-value">${alert.source}</div>
      </div>
      <div class="field">
        <div class="field-label">Time</div>
        <div class="field-value">${(alert.timestamp || new Date()).toISOString()}</div>
      </div>
      ${alert.tags && alert.tags.length > 0 ? `
      <div class="field">
        <div class="field-label">Tags</div>
        <div class="tags">${alert.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      SYNTHEX Monitoring System
    </div>
  </div>
</body>
</html>`;
}

function formatEmailText(alert: Alert): string {
  let text = `
[${alert.severity.toUpperCase()}] ${alert.title}

Message: ${alert.message}
Source: ${alert.source}
Time: ${(alert.timestamp || new Date()).toISOString()}
`;

  if (alert.tags && alert.tags.length > 0) {
    text += `Tags: ${alert.tags.join(', ')}\n`;
  }

  text += '\n---\nSYNTHEX Monitoring System';

  return text;
}

function generateAlertId(): string {
  return `alert_${crypto.randomUUID()}`;
}

// ============================================================================
// ALERT MANAGER CLASS
// ============================================================================

export class AlertManager {
  private static instance: AlertManager;
  private channels: ChannelConfig[] = [];
  private alertHistory: Alert[] = [];
  private readonly MAX_HISTORY = 100;

  private constructor() {
    this.loadChannelsFromEnv();
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Load channel configurations from environment variables
   */
  private loadChannelsFromEnv(): void {
    // Console channel is always enabled
    this.channels.push({
      type: NotificationChannel.CONSOLE,
      enabled: true,
      minSeverity: AlertSeverity.INFO,
      config: {},
    });

    // Email channel
    if (process.env.ALERT_EMAIL_API_KEY && process.env.ALERT_EMAIL_FROM && process.env.ALERT_EMAIL_TO) {
      this.channels.push({
        type: NotificationChannel.EMAIL,
        enabled: true,
        minSeverity: (process.env.ALERT_EMAIL_MIN_SEVERITY as AlertSeverity) || AlertSeverity.ERROR,
        config: {
          apiKey: process.env.ALERT_EMAIL_API_KEY,
          fromEmail: process.env.ALERT_EMAIL_FROM,
          toEmails: process.env.ALERT_EMAIL_TO,
          fromName: process.env.ALERT_EMAIL_FROM_NAME || 'SYNTHEX Alerts',
        },
      });
    }

    // Slack channel
    if (process.env.ALERT_SLACK_WEBHOOK_URL) {
      this.channels.push({
        type: NotificationChannel.SLACK,
        enabled: true,
        minSeverity: (process.env.ALERT_SLACK_MIN_SEVERITY as AlertSeverity) || AlertSeverity.WARNING,
        config: {
          webhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL,
          channel: process.env.ALERT_SLACK_CHANNEL || '#alerts',
          username: process.env.ALERT_SLACK_USERNAME || 'SYNTHEX Bot',
          iconEmoji: process.env.ALERT_SLACK_ICON_EMOJI || ':robot_face:',
        },
      });
    }

    // Discord channel
    if (process.env.ALERT_DISCORD_WEBHOOK_URL) {
      const discordConfig: DiscordConfig = {
        type: NotificationChannel.DISCORD,
        enabled: true,
        minSeverity: (process.env.ALERT_DISCORD_MIN_SEVERITY as AlertSeverity) || AlertSeverity.WARNING,
        config: {
          webhookUrl: process.env.ALERT_DISCORD_WEBHOOK_URL,
          username: process.env.ALERT_DISCORD_USERNAME || 'SYNTHEX Bot',
        },
      };
      if (process.env.ALERT_DISCORD_AVATAR_URL) {
        discordConfig.config.avatarUrl = process.env.ALERT_DISCORD_AVATAR_URL;
      }
      this.channels.push(discordConfig);
    }

    // Generic webhook channel
    if (process.env.ALERT_WEBHOOK_URL) {
      const webhookConfig: WebhookConfig = {
        type: NotificationChannel.WEBHOOK,
        enabled: true,
        minSeverity: (process.env.ALERT_WEBHOOK_MIN_SEVERITY as AlertSeverity) || AlertSeverity.WARNING,
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          method: process.env.ALERT_WEBHOOK_METHOD || 'POST',
        },
      };
      if (process.env.ALERT_WEBHOOK_HEADERS) {
        webhookConfig.config.headers = process.env.ALERT_WEBHOOK_HEADERS;
      }
      if (process.env.ALERT_WEBHOOK_AUTH) {
        webhookConfig.config.authHeader = process.env.ALERT_WEBHOOK_AUTH;
      }
      this.channels.push(webhookConfig);
    }

    logger.info('Alert channels loaded', {
      channels: this.channels.map(c => ({
        type: c.type,
        enabled: c.enabled,
        minSeverity: c.minSeverity,
      })),
    });
  }

  /**
   * Add a notification channel
   */
  addChannel(config: ChannelConfig): void {
    // Remove existing channel of same type
    this.channels = this.channels.filter(c => c.type !== config.type);
    this.channels.push(config);
  }

  /**
   * Remove a notification channel
   */
  removeChannel(type: NotificationChannel): void {
    this.channels = this.channels.filter(c => c.type !== type);
  }

  /**
   * Enable or disable a channel
   */
  setChannelEnabled(type: NotificationChannel, enabled: boolean): void {
    const channel = this.channels.find(c => c.type === type);
    if (channel) {
      channel.enabled = enabled;
    }
  }

  /**
   * Get configured channels
   */
  getChannels(): ChannelConfig[] {
    return [...this.channels];
  }

  /**
   * Send alert to all configured channels
   */
  async sendAlert(alert: Alert): Promise<NotificationResult[]> {
    const fullAlert: Alert = {
      ...alert,
      id: alert.id || generateAlertId(),
      timestamp: alert.timestamp || new Date(),
    };

    // Add to history
    this.alertHistory.unshift(fullAlert);
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(0, this.MAX_HISTORY);
    }

    const results: NotificationResult[] = [];

    for (const channel of this.channels) {
      if (!channel.enabled) continue;
      if (!severityMeetsMinimum(fullAlert.severity, channel.minSeverity)) continue;

      try {
        let result: NotificationResult;

        switch (channel.type) {
          case NotificationChannel.CONSOLE:
            result = await sendConsoleAlert(fullAlert);
            break;
          case NotificationChannel.EMAIL:
            result = await sendEmailAlert(fullAlert, channel.config as EmailConfig['config']);
            break;
          case NotificationChannel.SLACK:
            result = await sendSlackAlert(fullAlert, channel.config as SlackConfig['config']);
            break;
          case NotificationChannel.DISCORD:
            result = await sendDiscordAlert(fullAlert, channel.config as DiscordConfig['config']);
            break;
          case NotificationChannel.WEBHOOK:
            result = await sendWebhookAlert(fullAlert, channel.config as WebhookConfig['config']);
            break;
          default:
            continue;
        }

        results.push(result);

        if (!result.success) {
          logger.error('Alert channel failed', {
            channel: channel.type,
            error: result.error,
            alertId: fullAlert.id,
          });
        }
      } catch (error) {
        results.push({
          channel: channel.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Send info alert
   */
  async info(title: string, message: string, source: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: AlertSeverity.INFO,
      source,
      metadata,
    });
  }

  /**
   * Send warning alert
   */
  async warning(title: string, message: string, source: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: AlertSeverity.WARNING,
      source,
      metadata,
    });
  }

  /**
   * Send error alert
   */
  async error(title: string, message: string, source: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: AlertSeverity.ERROR,
      source,
      metadata,
    });
  }

  /**
   * Send critical alert
   */
  async critical(title: string, message: string, source: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert({
      title,
      message,
      severity: AlertSeverity.CRITICAL,
      source,
      metadata,
    });
  }

  /**
   * Get recent alert history
   */
  getHistory(count: number = 20): Alert[] {
    return this.alertHistory.slice(0, count);
  }

  /**
   * Test a specific channel with a test alert
   */
  async testChannel(type: NotificationChannel): Promise<NotificationResult> {
    const testAlert: Alert = {
      id: generateAlertId(),
      title: 'Test Alert',
      message: 'This is a test alert to verify the notification channel is working correctly.',
      severity: AlertSeverity.INFO,
      source: 'alert-manager-test',
      timestamp: new Date(),
      tags: ['test', 'verification'],
    };

    const channel = this.channels.find(c => c.type === type);
    if (!channel) {
      return {
        channel: type,
        success: false,
        error: 'Channel not configured',
        timestamp: new Date(),
      };
    }

    switch (type) {
      case NotificationChannel.CONSOLE:
        return sendConsoleAlert(testAlert);
      case NotificationChannel.EMAIL:
        return sendEmailAlert(testAlert, channel.config as EmailConfig['config']);
      case NotificationChannel.SLACK:
        return sendSlackAlert(testAlert, channel.config as SlackConfig['config']);
      case NotificationChannel.DISCORD:
        return sendDiscordAlert(testAlert, channel.config as DiscordConfig['config']);
      case NotificationChannel.WEBHOOK:
        return sendWebhookAlert(testAlert, channel.config as WebhookConfig['config']);
      default:
        return {
          channel: type,
          success: false,
          error: 'Unknown channel type',
          timestamp: new Date(),
        };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const alertManager = AlertManager.getInstance();

export default alertManager;
