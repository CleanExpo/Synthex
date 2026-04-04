/**
 * Social Scheduler Coordinator
 * Manages scheduling and queue management sub-agents
 */

import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { createPlatformService, SupportedPlatform, isPlatformSupported, PlatformCredentials } from '@/lib/social';

export interface ScheduledPost {
  id: string;
  platform: string;
  content: any;
  scheduledTime: Date;
  status: 'queued' | 'scheduled' | 'publishing' | 'published' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  campaign?: string;
  dependencies?: string[];
  retryCount?: number;
  metadata?: {
    optimalTime?: boolean;
    autoScheduled?: boolean;
    rescheduled?: boolean;
    reason?: string;
    // Publishing metadata
    platformPostId?: string;
    platformPostUrl?: string;
    publishedAt?: string;
    error?: string;
    failedAt?: string;
  };
}

export interface QueueMetrics {
  totalQueued: number;
  byPlatform: Record<string, number>;
  byStatus: Record<string, number>;
  avgWaitTime: number;
  successRate: number;
  failureRate: number;
  nextAvailableSlot: Date;
}

export interface SchedulingStrategy {
  name: string;
  description: string;
  rules: SchedulingRule[];
  priority: number;
}

export interface SchedulingRule {
  type: 'time' | 'frequency' | 'spacing' | 'dependency' | 'condition';
  condition: any;
  action: any;
}

export class SocialSchedulerCoordinator extends EventEmitter {
  private subAgents: Map<string, any> = new Map();
  private postQueue: Map<string, ScheduledPost> = new Map();
  private publishingCalendar: Map<string, Date[]> = new Map();
  private strategies: Map<string, SchedulingStrategy> = new Map();
  private platformLimits: Map<string, any> = new Map();
  private queueMetrics: QueueMetrics;
  private isProcessing: boolean = false;

  constructor() {
    super();
    this.queueMetrics = this.initializeMetrics();
    this.initializeSubAgents();
    this.loadPlatformLimits();
    this.loadSchedulingStrategies();
    this.startScheduler();
  }

  private initializeMetrics(): QueueMetrics {
    return {
      totalQueued: 0,
      byPlatform: {},
      byStatus: {},
      avgWaitTime: 0,
      successRate: 100,
      failureRate: 0,
      nextAvailableSlot: new Date()
    };
  }

  private initializeSubAgents(): void {
    const subAgentTypes = [
      'queue-manager',
      'time-optimizer',
      'frequency-controller',
      'dependency-resolver',
      'conflict-resolver',
      'auto-scheduler',
      'retry-handler',
      'batch-processor'
    ];

    subAgentTypes.forEach(type => {
      this.subAgents.set(type, {
        id: `scheduler-${type}`,
        type,
        status: 'active',
        capabilities: this.getSchedulerCapabilities(type)
      });
    });

    console.log(`📅 Social Scheduler Coordinator initialized with ${this.subAgents.size} sub-agents`);
  }

  private getSchedulerCapabilities(type: string): string[] {
    const capabilities: Record<string, string[]> = {
      'queue-manager': [
        'manage-post-queue',
        'prioritize-posts',
        'handle-queue-overflow',
        'optimize-queue-order'
      ],
      'time-optimizer': [
        'find-optimal-times',
        'avoid-conflicts',
        'maximize-reach',
        'balance-distribution'
      ],
      'frequency-controller': [
        'enforce-posting-limits',
        'prevent-spam',
        'maintain-consistency',
        'balance-frequency'
      ],
      'dependency-resolver': [
        'track-dependencies',
        'resolve-conflicts',
        'manage-sequences',
        'handle-chains'
      ],
      'conflict-resolver': [
        'detect-conflicts',
        'resolve-overlaps',
        'manage-priorities',
        'handle-emergencies'
      ],
      'auto-scheduler': [
        'automatic-scheduling',
        'smart-distribution',
        'adaptive-timing',
        'predictive-scheduling'
      ],
      'retry-handler': [
        'handle-failures',
        'retry-logic',
        'escalation-management',
        'failure-recovery'
      ],
      'batch-processor': [
        'bulk-scheduling',
        'batch-publishing',
        'parallel-processing',
        'efficiency-optimization'
      ]
    };

    return capabilities[type] || [];
  }

  private loadPlatformLimits(): void {
    this.platformLimits = new Map([
      ['instagram', {
        postsPerDay: 25,
        storiesPerDay: 100,
        reelsPerDay: 10,
        minSpacing: 30, // minutes
        optimalSpacing: 180 // minutes
      }],
      ['tiktok', {
        postsPerDay: 30,
        livesPerDay: 5,
        minSpacing: 20,
        optimalSpacing: 120
      }],
      ['youtube', {
        videosPerDay: 10,
        shortsPerDay: 20,
        livesPerDay: 2,
        minSpacing: 60,
        optimalSpacing: 360
      }],
      ['linkedin', {
        postsPerDay: 20,
        articlesPerWeek: 7,
        minSpacing: 60,
        optimalSpacing: 240
      }],
      ['twitter', {
        tweetsPerDay: 100,
        threadsPerDay: 10,
        minSpacing: 5,
        optimalSpacing: 60
      }],
      ['facebook', {
        postsPerDay: 50,
        storiesPerDay: 20,
        minSpacing: 30,
        optimalSpacing: 180
      }],
      ['pinterest', {
        pinsPerDay: 30,
        boardsPerDay: 5,
        minSpacing: 15,
        optimalSpacing: 90
      }],
      ['reddit', {
        postsPerDay: 10,
        commentsPerDay: 50,
        minSpacing: 60,
        optimalSpacing: 360
      }]
    ]);
  }

  private loadSchedulingStrategies(): void {
    this.strategies = new Map([
      ['maximize-reach', {
        name: 'Maximize Reach',
        description: 'Schedule posts at times when audience is most active',
        priority: 1,
        rules: [
          {
            type: 'time',
            condition: { peakHours: true },
            action: { prioritize: true }
          },
          {
            type: 'spacing',
            condition: { minSpacing: 120 },
            action: { enforce: true }
          }
        ]
      }],
      ['consistent-presence', {
        name: 'Consistent Presence',
        description: 'Maintain regular posting schedule',
        priority: 2,
        rules: [
          {
            type: 'frequency',
            condition: { postsPerDay: 3 },
            action: { distribute: 'even' }
          },
          {
            type: 'time',
            condition: { sameTimeDaily: true },
            action: { maintain: true }
          }
        ]
      }],
      ['burst-campaign', {
        name: 'Burst Campaign',
        description: 'Concentrated posting for campaigns',
        priority: 3,
        rules: [
          {
            type: 'frequency',
            condition: { burst: true },
            action: { concentrate: '2hours' }
          },
          {
            type: 'dependency',
            condition: { sequential: true },
            action: { maintain_order: true }
          }
        ]
      }],
      ['off-peak-value', {
        name: 'Off-Peak Value',
        description: 'Post valuable content during off-peak for dedicated audience',
        priority: 4,
        rules: [
          {
            type: 'time',
            condition: { offPeak: true },
            action: { schedule: 'quality_content' }
          }
        ]
      }]
    ]);
  }

  /**
   * Schedule a post
   */
  public async schedulePost(
    platform: string,
    content: any,
    options: {
      preferredTime?: Date;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      campaign?: string;
      dependencies?: string[];
      strategy?: string;
    } = {}
  ): Promise<ScheduledPost> {
    console.log(`📅 Scheduling post for ${platform}`);

    // Check platform limits
    const limits = this.platformLimits.get(platform);
    if (!limits) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    // Find optimal time
    const optimalTime = await this.findOptimalTime(
      platform,
      options.preferredTime || new Date(),
      options.priority || 'medium'
    );

    // Check for conflicts
    const conflicts = await this.checkConflicts(platform, optimalTime);
    if (conflicts.length > 0) {
      const resolved = await this.resolveConflicts(conflicts, optimalTime, options.priority);
      if (!resolved) {
        throw new Error('Unable to resolve scheduling conflicts');
      }
    }

    // Create scheduled post
    const scheduledPost: ScheduledPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      platform,
      content,
      scheduledTime: optimalTime,
      status: 'queued',
      priority: options.priority || 'medium',
      campaign: options.campaign,
      dependencies: options.dependencies,
      metadata: {
        optimalTime: true,
        autoScheduled: !options.preferredTime
      }
    };

    // Add to queue
    this.postQueue.set(scheduledPost.id, scheduledPost);
    await this.updateQueueMetrics();

    // Update calendar
    const calendar = this.publishingCalendar.get(platform) || [];
    calendar.push(optimalTime);
    this.publishingCalendar.set(platform, calendar);

    this.emit('post-scheduled', scheduledPost);
    return scheduledPost;
  }

  /**
   * Bulk schedule multiple posts
   */
  public async bulkSchedule(
    posts: Array<{
      platform: string;
      content: any;
      options?: any;
    }>
  ): Promise<ScheduledPost[]> {
    console.log(`📅 Bulk scheduling ${posts.length} posts`);

    const batchProcessor = this.subAgents.get('batch-processor');
    const scheduled: ScheduledPost[] = [];

    // Sort by priority and platform
    const sorted = posts.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = (a.options?.priority || 'medium') as keyof typeof priorityOrder;
      const bPriority = (b.options?.priority || 'medium') as keyof typeof priorityOrder;
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    });

    // Process in batches
    for (const post of sorted) {
      try {
        const scheduledPost = await this.schedulePost(
          post.platform,
          post.content,
          post.options
        );
        scheduled.push(scheduledPost);
      } catch (error) {
        console.error(`Failed to schedule post for ${post.platform}:`, error);
      }
    }

    return scheduled;
  }

  /**
   * Reschedule a post
   */
  public async reschedulePost(
    postId: string,
    newTime?: Date,
    reason?: string
  ): Promise<ScheduledPost> {
    const post = this.postQueue.get(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    // Find new optimal time
    const optimalTime = newTime || await this.findOptimalTime(
      post.platform,
      new Date(),
      post.priority
    );

    // Update post
    post.scheduledTime = optimalTime;
    post.metadata = {
      ...post.metadata,
      rescheduled: true,
      reason: reason || 'Manual reschedule'
    };

    this.postQueue.set(postId, post);
    await this.updateQueueMetrics();

    this.emit('post-rescheduled', post);
    return post;
  }

  /**
   * Cancel a scheduled post
   */
  public async cancelPost(postId: string): Promise<void> {
    const post = this.postQueue.get(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    this.postQueue.delete(postId);
    await this.updateQueueMetrics();

    // Remove from calendar
    const calendar = this.publishingCalendar.get(post.platform) || [];
    const index = calendar.findIndex(time => time === post.scheduledTime);
    if (index !== -1) {
      calendar.splice(index, 1);
      this.publishingCalendar.set(post.platform, calendar);
    }

    this.emit('post-cancelled', post);
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): {
    metrics: QueueMetrics;
    queue: ScheduledPost[];
    calendar: Record<string, Date[]>;
  } {
    return {
      metrics: this.queueMetrics,
      queue: Array.from(this.postQueue.values()).sort((a, b) => 
        a.scheduledTime.getTime() - b.scheduledTime.getTime()
      ),
      calendar: Object.fromEntries(this.publishingCalendar)
    };
  }

  /**
   * Get optimal posting times for a platform
   */
  public async getOptimalTimes(
    platform: string,
    date: Date = new Date(),
    count: number = 5
  ): Promise<Date[]> {
    const timeOptimizer = this.subAgents.get('time-optimizer');
    const limits = this.platformLimits.get(platform);
    
    if (!limits) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    const optimalTimes: Date[] = [];
    const baseHours = this.getOptimalHours(platform);
    
    for (let i = 0; i < count; i++) {
      const hour = baseHours[i % baseHours.length];
      const time = new Date(date);
      time.setHours(hour, 0, 0, 0);
      
      // Add some variation
      time.setMinutes(Math.floor(Math.random() * 60));
      
      // Check if time is available
      if (await this.isTimeAvailable(platform, time)) {
        optimalTimes.push(time);
      }
    }

    return optimalTimes;
  }

  /**
   * Optimize existing queue
   */
  public async optimizeQueue(): Promise<void> {
    console.log('🔧 Optimizing posting queue');

    const queueManager = this.subAgents.get('queue-manager');
    const posts = Array.from(this.postQueue.values());

    // Group by platform
    const byPlatform = posts.reduce((acc, post) => {
      if (!acc[post.platform]) acc[post.platform] = [];
      acc[post.platform].push(post);
      return acc;
    }, {} as Record<string, ScheduledPost[]>);

    // Optimize each platform's queue
    for (const [platform, platformPosts] of Object.entries(byPlatform)) {
      const optimized = await this.optimizePlatformQueue(platform, platformPosts);
      
      // Update posts with new times
      optimized.forEach(post => {
        this.postQueue.set(post.id, post);
      });
    }

    await this.updateQueueMetrics();
    this.emit('queue-optimized', { posts: posts.length });
  }

  /**
   * Handle failed posts
   */
  public async handleFailure(postId: string, error: any): Promise<void> {
    const retryHandler = this.subAgents.get('retry-handler');
    const post = this.postQueue.get(postId);
    
    if (!post) return;

    post.status = 'failed';
    post.retryCount = (post.retryCount || 0) + 1;

    // Decide if should retry
    if (post.retryCount < 3) {
      // Reschedule for retry
      const retryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes later
      await this.reschedulePost(postId, retryTime, `Retry attempt ${post.retryCount}`);
    } else {
      // Mark as permanently failed
      this.emit('post-failed', { post, error });
    }
  }

  // Private helper methods
  private async findOptimalTime(
    platform: string,
    preferredTime: Date,
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<Date> {
    const timeOptimizer = this.subAgents.get('time-optimizer');
    const limits = this.platformLimits.get(platform);
    
    if (priority === 'urgent') {
      // Find next available slot
      return this.findNextAvailableSlot(platform, new Date());
    }

    // Get optimal hours for platform
    const optimalHours = this.getOptimalHours(platform);
    
    // Find closest optimal time to preferred time
    let bestTime = new Date(preferredTime);
    const preferredHour = bestTime.getHours();
    
    // Find closest optimal hour
    const closestHour = optimalHours.reduce((prev, curr) => 
      Math.abs(curr - preferredHour) < Math.abs(prev - preferredHour) ? curr : prev
    );
    
    bestTime.setHours(closestHour, 0, 0, 0);
    
    // Check if time is available
    if (!await this.isTimeAvailable(platform, bestTime)) {
      bestTime = await this.findNextAvailableSlot(platform, bestTime);
    }

    return bestTime;
  }

  private async checkConflicts(platform: string, time: Date): Promise<ScheduledPost[]> {
    const conflictResolver = this.subAgents.get('conflict-resolver');
    const limits = this.platformLimits.get(platform);
    const conflicts: ScheduledPost[] = [];
    
    if (!limits) return conflicts;

    const minSpacing = limits.minSpacing * 60 * 1000; // Convert to milliseconds
    
    // Check for posts too close in time
    for (const post of this.postQueue.values()) {
      if (post.platform === platform) {
        const timeDiff = Math.abs(post.scheduledTime.getTime() - time.getTime());
        if (timeDiff < minSpacing) {
          conflicts.push(post);
        }
      }
    }

    return conflicts;
  }

  private async resolveConflicts(
    conflicts: ScheduledPost[],
    desiredTime: Date,
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<boolean> {
    const conflictResolver = this.subAgents.get('conflict-resolver');
    
    // If urgent priority, move other posts
    if (priority === 'urgent') {
      for (const conflict of conflicts) {
        if (conflict.priority !== 'urgent') {
          await this.reschedulePost(
            conflict.id,
            undefined,
            'Moved for urgent post'
          );
        }
      }
      return true;
    }

    // Otherwise, find alternative time
    return false;
  }

  private async findNextAvailableSlot(platform: string, afterTime: Date): Promise<Date> {
    const limits = this.platformLimits.get(platform);
    if (!limits) return afterTime;

    const minSpacing = limits.minSpacing * 60 * 1000;
    let candidateTime = new Date(afterTime);

    // Get all scheduled times for platform
    const scheduledTimes = (this.publishingCalendar.get(platform) || [])
      .sort((a, b) => a.getTime() - b.getTime());

    // Find gap
    for (const scheduled of scheduledTimes) {
      if (scheduled.getTime() > candidateTime.getTime()) {
        const gap = scheduled.getTime() - candidateTime.getTime();
        if (gap >= minSpacing) {
          return candidateTime;
        }
        candidateTime = new Date(scheduled.getTime() + minSpacing);
      }
    }

    return candidateTime;
  }

  private async isTimeAvailable(platform: string, time: Date): Promise<boolean> {
    const conflicts = await this.checkConflicts(platform, time);
    return conflicts.length === 0;
  }

  private getOptimalHours(platform: string): number[] {
    const optimalHours: Record<string, number[]> = {
      instagram: [11, 14, 17, 19],
      tiktok: [6, 9, 12, 19, 21],
      youtube: [14, 15, 16, 20],
      linkedin: [8, 12, 17, 18],
      twitter: [9, 12, 15, 17],
      facebook: [13, 15, 16, 19],
      pinterest: [20, 21, 22, 23],
      reddit: [7, 8, 9, 17]
    };

    return optimalHours[platform] || [9, 12, 15, 18];
  }

  private async optimizePlatformQueue(
    platform: string,
    posts: ScheduledPost[]
  ): Promise<ScheduledPost[]> {
    const limits = this.platformLimits.get(platform);
    if (!limits) return posts;

    const optimalSpacing = limits.optimalSpacing * 60 * 1000;
    
    // Sort by priority and time
    posts.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });

    // Redistribute with optimal spacing
    let lastTime = posts[0]?.scheduledTime || new Date();
    
    for (let i = 1; i < posts.length; i++) {
      const minTime = new Date(lastTime.getTime() + optimalSpacing);
      if (posts[i].scheduledTime.getTime() < minTime.getTime()) {
        posts[i].scheduledTime = minTime;
      }
      lastTime = posts[i].scheduledTime;
    }

    return posts;
  }

  private async updateQueueMetrics(): Promise<void> {
    const posts = Array.from(this.postQueue.values());
    
    this.queueMetrics = {
      totalQueued: posts.length,
      byPlatform: posts.reduce((acc, post) => {
        acc[post.platform] = (acc[post.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStatus: posts.reduce((acc, post) => {
        acc[post.status] = (acc[post.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgWaitTime: this.calculateAvgWaitTime(posts),
      successRate: this.calculateSuccessRate(posts),
      failureRate: this.calculateFailureRate(posts),
      nextAvailableSlot: await this.findEarliestAvailableSlot()
    };
  }

  private calculateAvgWaitTime(posts: ScheduledPost[]): number {
    if (posts.length === 0) return 0;
    
    const now = Date.now();
    const totalWait = posts.reduce((sum, post) => {
      return sum + (post.scheduledTime.getTime() - now);
    }, 0);
    
    return totalWait / posts.length / 60000; // Convert to minutes
  }

  private calculateSuccessRate(posts: ScheduledPost[]): number {
    const total = posts.filter(p => p.status === 'published' || p.status === 'failed').length;
    if (total === 0) return 100;
    
    const successful = posts.filter(p => p.status === 'published').length;
    return (successful / total) * 100;
  }

  private calculateFailureRate(posts: ScheduledPost[]): number {
    return 100 - this.calculateSuccessRate(posts);
  }

  private async findEarliestAvailableSlot(): Promise<Date> {
    const now = new Date();
    let earliest = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
    
    // Check each platform for next available slot
    for (const [platform, limits] of this.platformLimits) {
      const nextSlot = await this.findNextAvailableSlot(platform, now);
      if (nextSlot.getTime() < earliest.getTime()) {
        earliest = nextSlot;
      }
    }
    
    return earliest;
  }

  private startScheduler(): void {
    setInterval(() => {
      this.processQueue();
    }, 60000); // Check every minute
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const now = new Date();
    const posts = Array.from(this.postQueue.values());
    
    for (const post of posts) {
      if (post.status === 'queued' && post.scheduledTime.getTime() <= now.getTime()) {
        await this.publishPost(post);
      }
    }

    this.isProcessing = false;
  }

  private async publishPost(post: ScheduledPost): Promise<void> {
    post.status = 'publishing';
    this.postQueue.set(post.id, post);

    this.emit('post-publishing', post);

    try {
      // Get platform credentials from database
      const credentials = await this.getPlatformCredentials(post.platform, post.content?.userId);

      if (!credentials) {
        throw new Error(`No credentials found for platform ${post.platform}`);
      }

      if (!isPlatformSupported(post.platform)) {
        throw new Error(`Platform ${post.platform} is not supported`);
      }

      // Create platform service
      const service = createPlatformService(
        post.platform as SupportedPlatform,
        credentials,
        {
          tokenRefreshCallback: async (platform, newCreds) => {
            // Persist refreshed tokens
            await prisma.platformConnection.updateMany({
              where: {
                platform,
                userId: post.content?.userId,
              },
              data: {
                accessToken: newCreds.accessToken,
                refreshToken: newCreds.refreshToken,
                expiresAt: newCreds.expiresAt,
              },
            });
          },
        }
      );

      if (!service) {
        throw new Error(`Failed to create service for platform ${post.platform}`);
      }

      // Publish to platform
      const result = await service.createPost({
        text: post.content?.text || post.content?.content || '',
        mediaUrls: post.content?.mediaUrls || [],
        visibility: post.content?.visibility || 'public',
        metadata: post.content?.metadata,
      });

      if (result.success) {
        post.status = 'published';
        post.metadata = {
          ...post.metadata,
          platformPostId: result.postId,
          platformPostUrl: result.url,
          publishedAt: new Date().toISOString(),
        };

        // Update CalendarPost in database if linked
        if (post.content?.calendarPostId) {
          await prisma.calendarPost.update({
            where: { id: post.content.calendarPostId },
            data: {
              status: 'published',
              publishedAt: new Date(),
              metadata: {
                ...(post.metadata || {}),
                platformPostId: result.postId,
                platformPostUrl: result.url,
              },
            },
          });
        }

        console.log(`✅ Published post ${post.id} to ${post.platform}: ${result.postId}`);
        this.emit('post-published', post);
      } else {
        throw new Error(result.error || 'Unknown publishing error');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to publish post ${post.id}:`, errorMessage);

      post.status = 'failed';
      post.metadata = {
        ...post.metadata,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      };

      // Determine if we should retry
      const isRetryable = this.isRetryableError(error);

      if (isRetryable) {
        await this.handleFailure(post.id, error);
      } else {
        // Update CalendarPost as failed if linked
        if (post.content?.calendarPostId) {
          await prisma.calendarPost.update({
            where: { id: post.content.calendarPostId },
            data: {
              status: 'failed',
              metadata: {
                error: errorMessage,
                failedAt: new Date().toISOString(),
              },
            },
          });
        }

        this.emit('post-failed', { post, error: errorMessage });
      }
    }

    this.postQueue.set(post.id, post);
  }

  /**
   * Get platform credentials for a user
   */
  private async getPlatformCredentials(platform: string, userId?: string): Promise<PlatformCredentials | null> {
    if (!userId) {
      console.warn('No userId provided for publishing');
      return null;
    }

    try {
      const connection = await prisma.platformConnection.findFirst({
        where: {
          platform,
          userId,
          isActive: true,
        },
      });

      if (!connection) {
        return null;
      }

      return {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken || undefined,
        expiresAt: connection.expiresAt || undefined,
        platformUserId: connection.profileId || undefined,
        platformUsername: connection.profileName || undefined,
      };
    } catch (error) {
      console.error('Error fetching platform credentials:', error);
      return null;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Rate limit errors are retryable
    if (errorMessage.toLowerCase().includes('rate limit')) return true;
    if (errorMessage.includes('429')) return true;

    // Temporary network errors are retryable
    if (errorMessage.toLowerCase().includes('timeout')) return true;
    if (errorMessage.toLowerCase().includes('network')) return true;
    if (errorMessage.includes('ECONNRESET')) return true;
    if (errorMessage.includes('503')) return true;

    // Auth errors are NOT retryable
    if (errorMessage.includes('401') || errorMessage.includes('403')) return false;
    if (errorMessage.toLowerCase().includes('unauthorized')) return false;

    // Content policy errors are NOT retryable
    if (errorMessage.toLowerCase().includes('policy')) return false;
    if (errorMessage.toLowerCase().includes('content not allowed')) return false;

    return false;
  }

  /**
   * Get real queue metrics from database
   */
  public async getRealQueueMetrics(): Promise<QueueMetrics> {
    try {
      // Get counts from CalendarPost table
      const [scheduled, published, failed] = await Promise.all([
        prisma.calendarPost.count({
          where: { status: 'scheduled' },
        }),
        prisma.calendarPost.count({
          where: { status: 'published' },
        }),
        prisma.calendarPost.count({
          where: { status: 'failed' },
        }),
      ]);

      // Get platform breakdown
      const platformBreakdown = await prisma.calendarPost.groupBy({
        by: ['platforms'],
        where: { status: 'scheduled' },
        _count: true,
      });

      const byPlatform: Record<string, number> = {};
      for (const group of platformBreakdown) {
        // platforms is an array, count each platform
        for (const p of group.platforms) {
          byPlatform[p] = (byPlatform[p] || 0) + group._count;
        }
      }

      // Calculate success rate
      const totalCompleted = published + failed;
      const successRate = totalCompleted > 0 ? (published / totalCompleted) * 100 : 100;

      // Find next available slot
      const nextScheduled = await prisma.calendarPost.findFirst({
        where: {
          status: 'scheduled',
          scheduledFor: { gte: new Date() },
        },
        orderBy: { scheduledFor: 'asc' },
        select: { scheduledFor: true },
      });

      return {
        totalQueued: scheduled + this.postQueue.size,
        byPlatform,
        byStatus: {
          scheduled,
          published,
          failed,
          queued: this.postQueue.size,
        },
        avgWaitTime: this.calculateAvgWaitTime(Array.from(this.postQueue.values())),
        successRate: Math.round(successRate * 10) / 10,
        failureRate: Math.round((100 - successRate) * 10) / 10,
        nextAvailableSlot: nextScheduled?.scheduledFor || new Date(Date.now() + 30 * 60000),
      };
    } catch (error) {
      console.error('Error fetching real queue metrics:', error);
      // Fall back to in-memory metrics
      return this.queueMetrics;
    }
  }
}

export const socialSchedulerCoordinator = new SocialSchedulerCoordinator();