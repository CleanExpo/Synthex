/**
 * Scheduled Posts Worker
 *
 * @description Processes scheduled posts and publishes them to social platforms
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL (CRITICAL)
 * - All platform-specific API credentials
 */

import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { QUEUE_NAMES, ScheduledPostJobData } from '../bull-queue';
import { InstagramService } from '@/lib/social/instagram-service';
import { LinkedInService } from '@/lib/social/linkedin-service';
import { twitterService } from '@/lib/social/twitter-service';
import { logger } from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get Redis connection
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { host: 'localhost', port: 6379 };
  }

  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

/**
 * Process a scheduled post job
 */
async function processScheduledPost(job: Job<ScheduledPostJobData>): Promise<void> {
  const { postId, userId, platform, content, mediaUrls, metadata } = job.data;

  logger.info(`Processing scheduled post ${postId} for platform ${platform}`, {
    jobId: job.id,
    userId,
  });

  try {
    // Update status to processing
    await supabase
      .from('scheduled_posts')
      .update({ status: 'processing' })
      .eq('id', postId);

    // Get user's platform connection
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      throw new Error(`No active ${platform} connection found for user`);
    }

    // Check if token is expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      throw new Error(`${platform} token expired. User needs to reconnect.`);
    }

    let result: { success: boolean; postId?: string; url?: string; error?: string };

    // Publish to the appropriate platform
    switch (platform) {
      case 'twitter': {
        result = await twitterService.postTweet({
          text: content,
          mediaIds: [], // Would need to upload media first
        });
        break;
      }

      case 'instagram': {
        const instagramService = new InstagramService();
        instagramService.initialize({
          accessToken: connection.access_token,
          refreshToken: connection.refresh_token,
        });

        if (!mediaUrls || mediaUrls.length === 0) {
          throw new Error('Instagram posts require media');
        }

        result = await instagramService.createPost({
          text: content,
          mediaUrls,
        });
        break;
      }

      case 'linkedin': {
        const linkedInService = new LinkedInService();
        linkedInService.initialize({
          accessToken: connection.access_token,
          refreshToken: connection.refresh_token,
        });

        result = await linkedInService.createPost({
          text: content,
          mediaUrls,
          linkUrl: metadata?.linkUrl as string | undefined,
          visibility: (metadata?.visibility as 'public' | 'connections') || 'public',
        });
        break;
      }

      case 'facebook': {
        // Use Facebook Graph API directly
        const pageAccessToken = connection.page_access_token || connection.access_token;
        const pageId = metadata?.pageId || connection.platform_user_id;

        const response = await fetch(
          `https://graph.facebook.com/v19.0/${pageId}/feed`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: content,
              access_token: pageAccessToken,
            }),
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || 'Facebook API error');
        }

        result = {
          success: true,
          postId: data.id,
          url: `https://www.facebook.com/${data.id}`,
        };
        break;
      }

      case 'tiktok': {
        // TikTok requires video content
        if (!mediaUrls || mediaUrls.length === 0) {
          throw new Error('TikTok posts require video');
        }

        const response = await fetch(
          'https://open.tiktokapis.com/v2/post/publish/video/init/',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              post_info: {
                title: content,
                privacy_level: metadata?.privacy || 'PUBLIC',
              },
              source_info: {
                source: 'PULL_FROM_URL',
                video_url: mediaUrls[0],
              },
            }),
          }
        );

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || 'TikTok API error');
        }

        result = {
          success: true,
          postId: data.data?.publish_id,
        };
        break;
      }

      case 'youtube': {
        // YouTube requires video upload - complex process
        throw new Error('YouTube scheduled posts require special handling');
      }

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    if (!result.success) {
      throw new Error(result.error || 'Failed to publish post');
    }

    // Update scheduled post status
    await supabase
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_post_id: result.postId,
      })
      .eq('id', postId);

    // Create social_posts record
    await supabase.from('social_posts').insert({
      user_id: userId,
      platform,
      content,
      post_id: result.postId,
      media_urls: mediaUrls,
      status: 'published',
      metrics: {},
      created_at: new Date().toISOString(),
    });

    // Track usage
    await supabase.from('usage_tracking').insert({
      user_id: userId,
      feature: `${platform}_scheduled_post`,
      count: 1,
      timestamp: new Date().toISOString(),
    });

    // Send notification to user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Scheduled Post Published',
      message: `Your scheduled ${platform} post has been published successfully.`,
      type: 'success',
      read: false,
      created_at: new Date().toISOString(),
    });

    logger.info(`Successfully published scheduled post ${postId}`, {
      platform,
      publishedPostId: result.postId,
    });
  } catch (error: unknown) {
    logger.error(`Failed to publish scheduled post ${postId}:`, { error });

    // Update status to failed
    await supabase
      .from('scheduled_posts')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq('id', postId);

    // Send failure notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Scheduled Post Failed',
      message: `Your scheduled ${platform} post failed to publish: ${error instanceof Error ? error.message : String(error)}`,
      type: 'error',
      read: false,
      created_at: new Date().toISOString(),
    });

    throw error; // Re-throw for BullMQ retry mechanism
  }
}

/**
 * Create and start the scheduled posts worker
 */
export function createScheduledPostsWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.SCHEDULED_POSTS,
    async (job: Job<ScheduledPostJobData>) => {
      await processScheduledPost(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Job ${job?.id} failed:`, { error: error instanceof Error ? error.message : String(error) });
  });

  worker.on('error', (error) => {
    logger.error('Worker error:', { error });
  });

  logger.info('Scheduled posts worker started');

  return worker;
}

// Export for use in server startup
export { processScheduledPost };
