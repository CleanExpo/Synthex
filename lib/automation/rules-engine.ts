/**
 * Automation Rules Engine
 *
 * @description Visual workflow automation with triggers, conditions, and actions
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Logs error and continues, notifies on critical failures
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/** Action configuration types */
interface NotificationConfig {
  type: string;
  includeMetrics?: boolean;
  [key: string]: unknown;
}

interface EmailConfig {
  to?: string;
  subject?: string;
  template?: string;
  [key: string]: unknown;
}

interface SchedulePostConfig {
  postId?: string;
  useOptimalTime?: boolean;
  scheduledTime?: string;
  [key: string]: unknown;
}

interface ArchivePostConfig {
  postId?: string;
  [key: string]: unknown;
}

interface OptimizeContentConfig {
  createVariation?: boolean;
  [key: string]: unknown;
}

interface WebhookConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Database record for automation rules */
interface AutomationRuleDbRecord {
  id: string;
  user_id: string;
  client_id?: string;
  name: string;
  description?: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  is_active: boolean;
  run_count: number;
  last_run_at?: string;
  last_run_status?: 'success' | 'partial' | 'failed';
  error_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** Action result type */
interface ActionResult {
  sent?: boolean;
  type?: string;
  to?: string;
  scheduled?: boolean;
  archived?: boolean;
  optimized?: boolean;
  postId?: string;
  skipped?: boolean;
  reason?: string;
  status?: number;
  success?: boolean;
}

// Trigger types
export type TriggerType =
  | 'schedule' // Time-based (cron, interval)
  | 'event' // Event-based (post published, comment received, etc.)
  | 'threshold' // Metric threshold (engagement drops below X)
  | 'webhook' // External webhook
  | 'manual'; // Manual trigger

// Condition operators
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

// Action types
export type ActionType =
  | 'publish_post'
  | 'schedule_post'
  | 'archive_post'
  | 'send_notification'
  | 'send_email'
  | 'send_slack'
  | 'optimize_content'
  | 'generate_image'
  | 'generate_caption'
  | 'add_hashtags'
  | 'translate_content'
  | 'approve_content'
  | 'request_review'
  | 'create_report'
  | 'pause_campaign'
  | 'resume_campaign'
  | 'webhook'
  | 'custom_function';

// Automation rule
export interface AutomationRule {
  id: string;
  userId: string;
  clientId?: string;
  name: string;
  description: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  runCount: number;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'partial' | 'failed';
  errorCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Rule trigger
export interface RuleTrigger {
  type: TriggerType;
  config: {
    // Schedule trigger
    cron?: string;
    timezone?: string;
    interval?: number;
    intervalUnit?: 'minutes' | 'hours' | 'days';

    // Event trigger
    event?: string;
    eventSource?: string;

    // Threshold trigger
    metric?: string;
    threshold?: number;
    direction?: 'above' | 'below' | 'change';
    checkInterval?: number;

    // Webhook trigger
    webhookSecret?: string;
    method?: string;
  };
}

// Condition value can be various types
export type ConditionValue = string | number | boolean | null | string[] | number[];

// Rule condition
export interface RuleCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: ConditionValue;
  logicalOperator?: 'AND' | 'OR';
}

// Rule action
export interface RuleAction {
  id: string;
  type: ActionType;
  order: number;
  config: Record<string, unknown>;
  onSuccess?: string; // Next action ID
  onFailure?: string; // Fallback action ID
  retryCount?: number;
  retryDelay?: number;
}

// Execution context
export interface ExecutionContext {
  ruleId: string;
  triggerId: string;
  triggerData: Record<string, unknown>;
  variables: Record<string, unknown>;
  outputs: Record<string, unknown>;
  startedAt: Date;
}

// Execution result
export interface ExecutionResult {
  success: boolean;
  ruleId: string;
  executionId: string;
  actionsExecuted: number;
  actionsFailed: number;
  outputs: Record<string, unknown>;
  errors: Array<{ actionId: string; error: string }>;
  duration: number;
}

// Rule templates
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  variables: Array<{ name: string; type: string; description: string }>;
}

// Built-in rule templates
export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'auto-publish-optimal-time',
    name: 'Auto-Publish at Optimal Time',
    description: 'Automatically publish draft posts at the optimal time for engagement',
    category: 'Publishing',
    trigger: {
      type: 'schedule',
      config: { cron: '0 * * * *', timezone: 'UTC' }, // Every hour
    },
    conditions: [
      { id: 'c1', field: 'post.status', operator: 'equals', value: 'draft' },
      { id: 'c2', field: 'post.scheduledTime', operator: 'not_exists', value: null, logicalOperator: 'AND' },
    ],
    actions: [
      { id: 'a1', type: 'schedule_post', order: 0, config: { useOptimalTime: true } },
    ],
    variables: [],
  },
  {
    id: 'low-engagement-alert',
    name: 'Low Engagement Alert',
    description: 'Send alert when post engagement drops below threshold',
    category: 'Monitoring',
    trigger: {
      type: 'threshold',
      config: { metric: 'engagement_rate', threshold: 2, direction: 'below', checkInterval: 60 },
    },
    conditions: [
      { id: 'c1', field: 'post.status', operator: 'equals', value: 'published' },
      { id: 'c2', field: 'post.publishedAt', operator: 'greater_than', value: 'now-24h', logicalOperator: 'AND' },
    ],
    actions: [
      { id: 'a1', type: 'send_notification', order: 0, config: { type: 'low_engagement', includeMetrics: true } },
      { id: 'a2', type: 'optimize_content', order: 1, config: { createVariation: true } },
    ],
    variables: [{ name: 'threshold', type: 'number', description: 'Engagement rate threshold (%)' }],
  },
  {
    id: 'auto-respond-comments',
    name: 'Auto-Respond to Comments',
    description: 'Automatically generate and queue responses to comments',
    category: 'Engagement',
    trigger: {
      type: 'event',
      config: { event: 'comment.received', eventSource: 'any' },
    },
    conditions: [
      { id: 'c1', field: 'comment.isQuestion', operator: 'equals', value: true },
      { id: 'c2', field: 'comment.sentiment', operator: 'not_equals', value: 'negative', logicalOperator: 'AND' },
    ],
    actions: [
      { id: 'a1', type: 'generate_caption', order: 0, config: { type: 'reply', tone: 'friendly' } },
      { id: 'a2', type: 'request_review', order: 1, config: { priority: 'high' } },
    ],
    variables: [],
  },
  {
    id: 'content-expiry-archive',
    name: 'Archive Expired Content',
    description: 'Automatically archive content after expiry date',
    category: 'Maintenance',
    trigger: {
      type: 'schedule',
      config: { cron: '0 0 * * *', timezone: 'UTC' }, // Daily at midnight
    },
    conditions: [
      { id: 'c1', field: 'post.expiryDate', operator: 'less_than', value: 'now' },
      { id: 'c2', field: 'post.status', operator: 'equals', value: 'published', logicalOperator: 'AND' },
    ],
    actions: [
      { id: 'a1', type: 'archive_post', order: 0, config: {} },
      { id: 'a2', type: 'send_notification', order: 1, config: { type: 'content_archived' } },
    ],
    variables: [],
  },
];

class RulesEngine {
  private supabase: SupabaseClient;
  private runningExecutions: Map<string, ExecutionContext> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ==================== Rule Management ====================

  /**
   * Create a new automation rule
   */
  async createRule(
    userId: string,
    data: {
      name: string;
      description?: string;
      clientId?: string;
      trigger: RuleTrigger;
      conditions?: RuleCondition[];
      actions: RuleAction[];
      isActive?: boolean;
      tags?: string[];
    }
  ): Promise<AutomationRule> {
    try {
      const ruleId = `rule_${Date.now()}`;

      const { data: rule, error } = await this.supabase
        .from('automation_rules')
        .insert({
          id: ruleId,
          user_id: userId,
          client_id: data.clientId,
          name: data.name,
          description: data.description || '',
          trigger: data.trigger,
          conditions: data.conditions || [],
          actions: data.actions,
          is_active: data.isActive ?? true,
          run_count: 0,
          error_count: 0,
          tags: data.tags || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Register trigger if active
      if (rule.is_active) {
        await this.registerTrigger(this.mapDbToRule(rule));
      }

      return this.mapDbToRule(rule);
    } catch (error: unknown) {
      logger.error('Failed to create rule:', { error, userId });
      throw error;
    }
  }

  /**
   * Get automation rules
   */
  async getRules(
    userId: string,
    options: {
      clientId?: string;
      isActive?: boolean;
      tags?: string[];
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ rules: AutomationRule[]; total: number }> {
    try {
      let query = this.supabase
        .from('automation_rules')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (options.clientId) {
        query = query.eq('client_id', options.clientId);
      }

      if (options.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      }

      if (options.tags && options.tags.length > 0) {
        query = query.overlaps('tags', options.tags);
      }

      if (options.search) {
        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
      }

      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        rules: (data || []).map(this.mapDbToRule),
        total: count || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to get rules:', { error, userId });
      throw error;
    }
  }

  /**
   * Get a specific rule
   */
  async getRule(ruleId: string, userId: string): Promise<AutomationRule | null> {
    try {
      const { data, error } = await this.supabase
        .from('automation_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

      return this.mapDbToRule(data);
    } catch (error: unknown) {
      logger.error('Failed to get rule:', { error, ruleId });
      throw error;
    }
  }

  /**
   * Update a rule
   */
  async updateRule(
    ruleId: string,
    userId: string,
    updates: Partial<{
      name: string;
      description: string;
      trigger: RuleTrigger;
      conditions: RuleCondition[];
      actions: RuleAction[];
      isActive: boolean;
      tags: string[];
    }>
  ): Promise<AutomationRule | null> {
    try {
      const existingRule = await this.getRule(ruleId, userId);
      if (!existingRule) return null;

      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.trigger !== undefined) dbUpdates.trigger = updates.trigger;
      if (updates.conditions !== undefined) dbUpdates.conditions = updates.conditions;
      if (updates.actions !== undefined) dbUpdates.actions = updates.actions;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

      const { data, error } = await this.supabase
        .from('automation_rules')
        .update(dbUpdates)
        .eq('id', ruleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      const rule = this.mapDbToRule(data);

      // Update trigger registration
      if (updates.isActive !== undefined || updates.trigger !== undefined) {
        if (rule.isActive) {
          await this.registerTrigger(rule);
        } else {
          await this.unregisterTrigger(ruleId);
        }
      }

      return rule;
    } catch (error: unknown) {
      logger.error('Failed to update rule:', { error, ruleId });
      throw error;
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string, userId: string): Promise<boolean> {
    try {
      await this.unregisterTrigger(ruleId);

      const { error } = await this.supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error: unknown) {
      logger.error('Failed to delete rule:', { error, ruleId });
      throw error;
    }
  }

  /**
   * Toggle rule active status
   */
  async toggleRule(ruleId: string, userId: string): Promise<AutomationRule | null> {
    const rule = await this.getRule(ruleId, userId);
    if (!rule) return null;

    return this.updateRule(ruleId, userId, { isActive: !rule.isActive });
  }

  // ==================== Rule Execution ====================

  /**
   * Execute a rule manually
   */
  async executeRule(
    ruleId: string,
    userId: string,
    triggerData: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}`;

    try {
      const rule = await this.getRule(ruleId, userId);
      if (!rule) {
        throw new Error('Rule not found');
      }

      const context: ExecutionContext = {
        ruleId,
        triggerId: executionId,
        triggerData,
        variables: {},
        outputs: {},
        startedAt: new Date(),
      };

      this.runningExecutions.set(executionId, context);

      // Check conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions, context);
      if (!conditionsMet) {
        return {
          success: true,
          ruleId,
          executionId,
          actionsExecuted: 0,
          actionsFailed: 0,
          outputs: { skipped: 'Conditions not met' },
          errors: [],
          duration: Date.now() - startTime,
        };
      }

      // Execute actions
      const { executed, failed, outputs, errors } = await this.executeActions(rule.actions, context);

      // Update rule stats
      await this.supabase
        .from('automation_rules')
        .update({
          run_count: rule.runCount + 1,
          last_run_at: new Date().toISOString(),
          last_run_status: failed > 0 ? (executed > 0 ? 'partial' : 'failed') : 'success',
          error_count: failed > 0 ? rule.errorCount + failed : rule.errorCount,
        })
        .eq('id', ruleId);

      // Log execution
      await this.logExecution(ruleId, executionId, {
        success: failed === 0,
        actionsExecuted: executed,
        actionsFailed: failed,
        outputs,
        errors,
        duration: Date.now() - startTime,
      });

      this.runningExecutions.delete(executionId);

      return {
        success: failed === 0,
        ruleId,
        executionId,
        actionsExecuted: executed,
        actionsFailed: failed,
        outputs,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error: unknown) {
      this.runningExecutions.delete(executionId);
      logger.error('Rule execution failed:', { error, ruleId });

      return {
        success: false,
        ruleId,
        executionId,
        actionsExecuted: 0,
        actionsFailed: 1,
        outputs: {},
        errors: [{ actionId: 'rule', error: error instanceof Error ? error.message : String(error) }],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    ruleId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Array<{
    id: string;
    ruleId: string;
    result: ExecutionResult;
    createdAt: string;
  }>> {
    try {
      let query = this.supabase
        .from('automation_executions')
        .select('*')
        .eq('rule_id', ruleId)
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        result: row.result,
        createdAt: row.created_at,
      }));
    } catch (error: unknown) {
      logger.error('Failed to get execution history:', { error, ruleId });
      throw error;
    }
  }

  /**
   * Get rule templates
   */
  getRuleTemplates(category?: string): RuleTemplate[] {
    if (category) {
      return RULE_TEMPLATES.filter(t => t.category === category);
    }
    return RULE_TEMPLATES;
  }

  /**
   * Create rule from template
   */
  async createFromTemplate(
    userId: string,
    templateId: string,
    options: {
      name?: string;
      clientId?: string;
      variables?: Record<string, unknown>;
    } = {}
  ): Promise<AutomationRule> {
    const template = RULE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Apply variable substitutions
    let trigger = JSON.parse(JSON.stringify(template.trigger));
    let conditions = JSON.parse(JSON.stringify(template.conditions));
    let actions = JSON.parse(JSON.stringify(template.actions));

    if (options.variables) {
      const vars = options.variables;
      const substituteVars = (obj: unknown): unknown => {
        if (typeof obj === 'string') {
          let result = obj;
          for (const [key, value] of Object.entries(vars)) {
            result = result.replace(`{{${key}}}`, String(value));
          }
          return result;
        }
        if (Array.isArray(obj)) {
          return obj.map(substituteVars);
        }
        if (typeof obj === 'object' && obj !== null) {
          const result: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = substituteVars(value);
          }
          return result;
        }
        return obj;
      };

      trigger = substituteVars(trigger);
      conditions = substituteVars(conditions);
      actions = substituteVars(actions);
    }

    return this.createRule(userId, {
      name: options.name || template.name,
      description: template.description,
      clientId: options.clientId,
      trigger,
      conditions,
      actions,
      isActive: false, // Start inactive so user can review
      tags: [template.category.toLowerCase()],
    });
  }

  // ==================== Private Methods ====================

  private async evaluateConditions(
    conditions: RuleCondition[],
    context: ExecutionContext
  ): Promise<boolean> {
    if (conditions.length === 0) return true;

    let result = true;
    let currentOperator: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(condition, context);

      if (currentOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      currentOperator = condition.logicalOperator || 'AND';
    }

    return result;
  }

  private evaluateCondition(condition: RuleCondition, context: ExecutionContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);
    const targetValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === targetValue;
      case 'not_equals':
        return fieldValue !== targetValue;
      case 'contains':
        return String(fieldValue).includes(String(targetValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(targetValue));
      case 'greater_than':
        return Number(fieldValue) > Number(targetValue);
      case 'less_than':
        return Number(fieldValue) < Number(targetValue);
      case 'greater_than_or_equals':
        return Number(fieldValue) >= Number(targetValue);
      case 'less_than_or_equals':
        return Number(fieldValue) <= Number(targetValue);
      case 'in':
        return Array.isArray(targetValue) && (targetValue as unknown[]).includes(fieldValue);
      case 'not_in':
        return Array.isArray(targetValue) && !(targetValue as unknown[]).includes(fieldValue);
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;
      case 'not_exists':
        return fieldValue === null || fieldValue === undefined;
      default:
        return false;
    }
  }

  private getFieldValue(field: string, context: ExecutionContext): unknown {
    const parts = field.split('.');
    let value: unknown = { ...context.triggerData, ...context.variables };

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private async executeActions(
    actions: RuleAction[],
    context: ExecutionContext
  ): Promise<{
    executed: number;
    failed: number;
    outputs: Record<string, unknown>;
    errors: Array<{ actionId: string; error: string }>;
  }> {
    const sortedActions = [...actions].sort((a, b) => a.order - b.order);
    let executed = 0;
    let failed = 0;
    const outputs: Record<string, unknown> = {};
    const errors: Array<{ actionId: string; error: string }> = [];

    for (const action of sortedActions) {
      try {
        const result = await this.executeAction(action, context);
        outputs[action.id] = result;
        context.outputs[action.id] = result;
        executed++;
      } catch (error: unknown) {
        failed++;
        errors.push({ actionId: action.id, error: error instanceof Error ? error.message : String(error) });

        // Handle retry
        if (action.retryCount && action.retryCount > 0) {
          for (let i = 0; i < action.retryCount; i++) {
            await new Promise(resolve => setTimeout(resolve, action.retryDelay || 1000));
            try {
              const result = await this.executeAction(action, context);
              outputs[action.id] = result;
              context.outputs[action.id] = result;
              executed++;
              failed--;
              errors.pop();
              break;
            } catch {
              // Continue retry
            }
          }
        }

        // Handle failure path
        if (action.onFailure) {
          const fallbackAction = actions.find(a => a.id === action.onFailure);
          if (fallbackAction) {
            try {
              const result = await this.executeAction(fallbackAction, context);
              outputs[fallbackAction.id] = result;
              executed++;
            } catch {
              // Fallback also failed
            }
          }
        }
      }
    }

    return { executed, failed, outputs, errors };
  }

  private async executeAction(action: RuleAction, context: ExecutionContext): Promise<ActionResult> {
    switch (action.type) {
      case 'send_notification':
        return this.actionSendNotification(action.config as NotificationConfig, context);

      case 'send_email':
        return this.actionSendEmail(action.config as EmailConfig, context);

      case 'schedule_post':
        return this.actionSchedulePost(action.config as SchedulePostConfig, context);

      case 'archive_post':
        return this.actionArchivePost(action.config as ArchivePostConfig, context);

      case 'optimize_content':
        return this.actionOptimizeContent(action.config as OptimizeContentConfig, context);

      case 'webhook':
        return this.actionWebhook(action.config as WebhookConfig, context);

      default:
        logger.warn(`Unknown action type: ${action.type}`);
        return { skipped: true, reason: 'Unknown action type' };
    }
  }

  // Action implementations (simplified)
  private async actionSendNotification(config: NotificationConfig, context: ExecutionContext): Promise<ActionResult> {
    logger.info('Sending notification', { config, ruleId: context.ruleId });
    return { sent: true, type: config.type };
  }

  private async actionSendEmail(config: EmailConfig, context: ExecutionContext): Promise<ActionResult> {
    logger.info('Sending email', { config, ruleId: context.ruleId });
    return { sent: true, to: config.to };
  }

  private async actionSchedulePost(config: SchedulePostConfig, context: ExecutionContext): Promise<ActionResult> {
    const postId = (context.triggerData.postId as string) || config.postId;
    if (!postId) return { skipped: true };

    await this.supabase
      .from('scheduled_posts')
      .update({
        status: 'scheduled',
        scheduled_time: config.useOptimalTime ? new Date().toISOString() : config.scheduledTime,
      })
      .eq('id', postId);

    return { scheduled: true, postId };
  }

  private async actionArchivePost(config: ArchivePostConfig, context: ExecutionContext): Promise<ActionResult> {
    const postId = (context.triggerData.postId as string) || config.postId;
    if (!postId) return { skipped: true };

    await this.supabase
      .from('scheduled_posts')
      .update({ status: 'archived' })
      .eq('id', postId);

    return { archived: true, postId };
  }

  private async actionOptimizeContent(config: OptimizeContentConfig, context: ExecutionContext): Promise<ActionResult> {
    logger.info('Optimizing content', { config, ruleId: context.ruleId });
    return { optimized: true };
  }

  private async actionWebhook(config: WebhookConfig, context: ExecutionContext): Promise<ActionResult> {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify({
        ruleId: context.ruleId,
        triggerData: context.triggerData,
        ...config.body,
      }),
    });

    return { status: response.status, success: response.ok };
  }

  private async registerTrigger(rule: AutomationRule): Promise<void> {
    // Would integrate with scheduler service for cron triggers
    // Would set up event listeners for event triggers
    // Would set up metric monitors for threshold triggers
    logger.info('Registering trigger', { ruleId: rule.id, type: rule.trigger.type });
  }

  private async unregisterTrigger(ruleId: string): Promise<void> {
    logger.info('Unregistering trigger', { ruleId });
  }

  private async logExecution(
    ruleId: string,
    executionId: string,
    result: Omit<ExecutionResult, 'ruleId' | 'executionId'>
  ): Promise<void> {
    await this.supabase.from('automation_executions').insert({
      id: executionId,
      rule_id: ruleId,
      result: { ...result, ruleId, executionId },
      created_at: new Date().toISOString(),
    });
  }

  private mapDbToRule(data: AutomationRuleDbRecord): AutomationRule {
    return {
      id: data.id,
      userId: data.user_id,
      clientId: data.client_id,
      name: data.name,
      description: data.description || '',
      trigger: data.trigger,
      conditions: data.conditions || [],
      actions: data.actions || [],
      isActive: data.is_active,
      runCount: data.run_count || 0,
      lastRunAt: data.last_run_at,
      lastRunStatus: data.last_run_status,
      errorCount: data.error_count || 0,
      tags: data.tags || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Export singleton
export const rulesEngine = new RulesEngine();
