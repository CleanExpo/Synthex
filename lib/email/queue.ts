/**
 * Email Queue Service
 *
 * @description Async email processing with BullMQ
 * - Queued email delivery
 * - Automatic retries with exponential backoff
 * - Delivery status tracking
 * - Rate limiting
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL (CRITICAL)
 * - SENDGRID_API_KEY: SendGrid API key (SECRET)
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import sgMail from '@sendgrid/mail';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailJob {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
  }>;
  metadata?: {
    userId?: string;
    type: EmailType;
    campaignId?: string;
  };
}

export type EmailType =
  | 'welcome'
  | 'verification'
  | 'password_reset'
  | 'notification'
  | 'report'
  | 'marketing'
  | 'transactional';

export interface EmailDeliveryStatus {
  id: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
  messageId?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const DEFAULT_FROM = process.env.EMAIL_FROM || 'noreply@synthex.com';
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'SYNTHEX';

// Queue configuration
const QUEUE_NAME = 'email-queue';
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 30000, 120000, 600000]; // 1s, 5s, 30s, 2m, 10m

// ============================================================================
// REDIS CONNECTION
// ============================================================================

function getRedisConnection() {
  if (!REDIS_URL) {
    logger.warn('Redis URL not configured, email queue will use in-memory fallback');
    return undefined;
  }

  // Parse Upstash Redis URL format
  const url = new URL(REDIS_URL);

  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

// ============================================================================
// EMAIL QUEUE CLASS
// ============================================================================

class EmailQueueService {
  private queue: Queue<EmailJob> | null = null;
  private worker: Worker<EmailJob> | null = null;
  private queueEvents: QueueEvents | null = null;
  private inMemoryQueue: EmailJob[] = [];
  private isInitialized = false;

  constructor() {
    // Initialize SendGrid
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
    }
  }

  /**
   * Initialize the queue (call on server startup)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const connection = getRedisConnection();

    if (connection) {
      try {
        // Create queue
        this.queue = new Queue<EmailJob>(QUEUE_NAME, {
          connection,
          defaultJobOptions: {
            attempts: MAX_RETRIES,
            backoff: {
              type: 'custom',
            },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 },
          },
        });

        // Create worker
        this.worker = new Worker<EmailJob>(
          QUEUE_NAME,
          async (job) => this.processEmail(job),
          {
            connection,
            concurrency: 10,
            limiter: {
              max: 100,
              duration: 1000, // 100 emails per second
            },
          }
        );

        // Set up event listeners
        this.setupEventListeners();

        // Create queue events for tracking
        this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });

        this.isInitialized = true;
        logger.info('Email queue initialized with Redis');
      } catch (error) {
        logger.error('Failed to initialize email queue with Redis, using in-memory fallback', { error });
        this.isInitialized = true;
      }
    } else {
      this.isInitialized = true;
      logger.info('Email queue initialized with in-memory fallback');
    }
  }

  /**
   * Add email to queue
   */
  async enqueue(email: Omit<EmailJob, 'id'>): Promise<string> {
    await this.initialize();

    const id = `email_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const job: EmailJob = { id, ...email };

    // Track in database
    await this.trackDelivery(id, 'queued', email.metadata);

    if (this.queue) {
      await this.queue.add('send', job, {
        jobId: id,
        backoff: {
          type: 'custom',
        },
      });
      logger.debug('Email queued', { id, to: email.to, type: email.metadata?.type });
    } else {
      // In-memory fallback - process immediately
      this.inMemoryQueue.push(job);
      this.processInMemoryQueue();
    }

    return id;
  }

  /**
   * Send email immediately (bypasses queue)
   */
  async sendImmediate(email: Omit<EmailJob, 'id'>): Promise<string> {
    const id = `email_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const job: EmailJob = { id, ...email };

    await this.trackDelivery(id, 'queued', email.metadata);

    try {
      await this.sendViaSendGrid(job);
      await this.trackDelivery(id, 'sent', email.metadata);
      return id;
    } catch (error) {
      await this.trackDelivery(id, 'failed', email.metadata, error);
      throw error;
    }
  }

  /**
   * Get delivery status
   */
  async getStatus(emailId: string): Promise<EmailDeliveryStatus | null> {
    try {
      const delivery = await prisma.notification.findFirst({
        where: {
          data: {
            path: ['emailId'],
            equals: emailId,
          },
        },
      });

      if (!delivery) return null;

      const data = delivery.data as Record<string, unknown>;
      return {
        id: emailId,
        status: (data.status as EmailDeliveryStatus['status']) || 'queued',
        attempts: (data.attempts as number) || 0,
        lastAttempt: data.lastAttempt ? new Date(data.lastAttempt as string) : undefined,
        error: data.error as string | undefined,
        messageId: data.messageId as string | undefined,
      };
    } catch (error) {
      logger.error('Failed to get email status', { error, emailId });
      return null;
    }
  }

  /**
   * Retry failed email
   */
  async retry(emailId: string): Promise<boolean> {
    if (!this.queue) return false;

    const job = await this.queue.getJob(emailId);
    if (!job) return false;

    await job.retry();
    return true;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setupEventListeners(): void {
    if (!this.worker) return;

    this.worker.on('completed', async (job) => {
      logger.info('Email sent successfully', {
        id: job.id,
        to: job.data.to,
        type: job.data.metadata?.type,
      });
    });

    this.worker.on('failed', async (job, error) => {
      logger.error('Email delivery failed', {
        id: job?.id,
        to: job?.data.to,
        error: error.message,
        attempts: job?.attemptsMade,
      });

      if (job) {
        await this.trackDelivery(
          job.data.id,
          job.attemptsMade >= MAX_RETRIES ? 'failed' : 'queued',
          job.data.metadata,
          error
        );
      }
    });

    this.worker.on('error', (error) => {
      logger.error('Email worker error', { error });
    });
  }

  private async processEmail(job: Job<EmailJob>): Promise<void> {
    const { data } = job;

    logger.debug('Processing email', {
      id: data.id,
      to: data.to,
      attempt: job.attemptsMade + 1,
    });

    await this.sendViaSendGrid(data);
    await this.trackDelivery(data.id, 'sent', data.metadata, undefined, job.attemptsMade + 1);
  }

  private async sendViaSendGrid(email: EmailJob): Promise<string> {
    if (!SENDGRID_API_KEY) {
      // Development fallback - log email
      logger.info('Email (dev mode - not sent)', {
        to: email.to,
        subject: email.subject,
        type: email.metadata?.type,
      });
      return `dev_${email.id}`;
    }

    const msg = {
      to: email.to,
      from: {
        email: email.from || DEFAULT_FROM,
        name: DEFAULT_FROM_NAME,
      },
      subject: email.subject,
      html: email.html,
      text: email.text || this.stripHtml(email.html),
      replyTo: email.replyTo,
      cc: email.cc,
      bcc: email.bcc,
      customArgs: {
        emailId: email.id,
        type: email.metadata?.type,
        userId: email.metadata?.userId,
      },
    };

    const response = await sgMail.send(msg);
    const messageId = response[0]?.headers?.['x-message-id'] || email.id;

    logger.info('Email sent via SendGrid', {
      id: email.id,
      to: email.to,
      messageId,
    });

    return messageId;
  }

  private async processInMemoryQueue(): Promise<void> {
    while (this.inMemoryQueue.length > 0) {
      const email = this.inMemoryQueue.shift();
      if (!email) continue;

      try {
        await this.sendViaSendGrid(email);
        await this.trackDelivery(email.id, 'sent', email.metadata);
      } catch (error) {
        logger.error('In-memory email failed', { id: email.id, error });
        await this.trackDelivery(email.id, 'failed', email.metadata, error);
      }
    }
  }

  private async trackDelivery(
    emailId: string,
    status: EmailDeliveryStatus['status'],
    metadata?: EmailJob['metadata'],
    error?: unknown,
    attempts?: number
  ): Promise<void> {
    try {
      const data = {
        emailId,
        status,
        type: metadata?.type || 'transactional',
        attempts: attempts || 1,
        lastAttempt: new Date().toISOString(),
        error: error instanceof Error ? error.message : undefined,
      };

      // Use notification table for tracking
      await prisma.notification.upsert({
        where: {
          id: emailId,
        },
        create: {
          id: emailId,
          type: 'email_delivery',
          title: `Email: ${metadata?.type || 'transactional'}`,
          message: status,
          userId: metadata?.userId || 'system',
          data,
        },
        update: {
          message: status,
          data,
        },
      });
    } catch (dbError) {
      logger.error('Failed to track email delivery', { emailId, dbError });
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Shutdown queue gracefully
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    logger.info('Email queue shut down');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const emailQueue = new EmailQueueService();
export default emailQueue;
