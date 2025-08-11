import { PlatformConfig, BasePlatformService } from './base-platform.config';
import crypto from 'crypto';

export const twitterConfig: PlatformConfig = {
  name: 'twitter',
  displayName: 'X (Twitter)',
  icon: 'twitter',
  color: '#000000', // X's new black color
  oauth: {
    authorizationUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: [
      'tweet.read',
      'tweet.write',
      'tweet.moderate.write',
      'users.read',
      'follows.read',
      'follows.write',
      'offline.access',
      'space.read',
      'mute.read',
      'mute.write',
      'like.read',
      'like.write',
      'list.read',
      'list.write',
      'block.read',
      'block.write',
    ],
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    redirectUri: process.env.TWITTER_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/twitter`,
  },
  api: {
    baseUrl: 'https://api.twitter.com/2',
    version: 'v2',
    endpoints: {
      profile: '/users/me',
      posts: '/tweets',
      publish: '/tweets',
      media: 'https://upload.twitter.com/1.1/media/upload.json',
      analytics: '/tweets/:id?tweet.fields=public_metrics',
      comments: '/tweets/:id/replies',
    },
    rateLimit: {
      requests: 300,
      window: 900000, // 15 minutes
    },
  },
  content: {
    maxLength: 280, // 25000 for Twitter Blue subscribers
    maxImages: 4,
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    videoFormats: ['mp4', 'mov'],
    maxImageSize: 5, // 5MB
    maxVideoSize: 512, // 512MB
    maxVideoDuration: 140, // 140 seconds (2:20)
    features: {
      hashtags: true,
      mentions: true,
      links: true,
      stories: false, // Fleets discontinued
      reels: false,
      polls: true,
      threads: true,
    },
  },
  analytics: {
    metrics: [
      'impression_count',
      'like_count',
      'reply_count',
      'retweet_count',
      'quote_count',
      'bookmark_count',
      'url_link_clicks',
      'user_profile_clicks',
    ],
    refreshInterval: 900000, // 15 minutes
  },
};

export class TwitterService extends BasePlatformService {
  constructor() {
    super(twitterConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    const codeVerifier = this.generateCodeVerifier();
    const credentials = Buffer.from(
      `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`
    ).toString('base64');
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.oauth.redirectUri!,
        code_verifier: codeVerifier,
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Twitter OAuth error: ${data.error_description}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    const credentials = Buffer.from(
      `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`
    ).toString('base64');
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }
  
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
  
  async getProfile(accessToken: string): Promise<any> {
    const response = await fetch(
      `${this.config.api.baseUrl}/users/me?user.fields=id,name,username,profile_image_url,verified,created_at,public_metrics`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    return data.data;
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    const tweetData: any = {
      text: this.formatTweet(content.text),
    };
    
    // Handle media uploads
    if (content.images && content.images.length > 0) {
      const mediaIds = await this.uploadMedia(accessToken, content.images, 'image');
      tweetData.media = { media_ids: mediaIds };
    } else if (content.video) {
      const mediaId = await this.uploadVideo(accessToken, content.video);
      tweetData.media = { media_ids: [mediaId] };
    }
    
    // Handle reply
    if (content.replyToId) {
      tweetData.reply = { in_reply_to_tweet_id: content.replyToId };
    }
    
    // Handle quote tweet
    if (content.quoteTweetId) {
      tweetData.quote_tweet_id = content.quoteTweetId;
    }
    
    // Handle poll
    if (content.poll) {
      tweetData.poll = {
        options: content.poll.options,
        duration_minutes: content.poll.duration || 1440, // Default 24 hours
      };
    }
    
    return this.makeApiRequest(
      this.config.api.endpoints.publish,
      accessToken,
      'POST',
      tweetData
    );
  }
  
  async uploadMedia(accessToken: string, mediaUrls: string[], mediaType: string): Promise<string[]> {
    const mediaIds = [];
    
    for (const mediaUrl of mediaUrls) {
      // Download media
      const mediaResponse = await fetch(mediaUrl);
      const mediaBuffer = await mediaResponse.arrayBuffer();
      const mediaBase64 = Buffer.from(mediaBuffer).toString('base64');
      
      // Upload to Twitter
      const uploadResponse = await fetch(this.config.api.endpoints.media!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          media_data: mediaBase64,
          media_category: mediaType === 'image' ? 'tweet_image' : 'tweet_video',
        }),
      });
      
      const uploadData = await uploadResponse.json();
      mediaIds.push(uploadData.media_id_string);
    }
    
    return mediaIds;
  }
  
  async uploadVideo(accessToken: string, videoUrl: string): Promise<string> {
    // Video upload requires chunked upload for large files
    // This is a simplified version
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoSize = videoBuffer.byteLength;
    
    // INIT
    const initResponse = await fetch(this.config.api.endpoints.media!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        command: 'INIT',
        media_type: 'video/mp4',
        media_category: 'tweet_video',
        total_bytes: videoSize.toString(),
      }),
    });
    
    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;
    
    // APPEND (simplified - for production, implement chunking)
    const appendResponse = await fetch(this.config.api.endpoints.media!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        command: 'APPEND',
        media_id: mediaId,
        segment_index: '0',
        media_data: Buffer.from(videoBuffer).toString('base64'),
      }),
    });
    
    // FINALIZE
    const finalizeResponse = await fetch(this.config.api.endpoints.media!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        command: 'FINALIZE',
        media_id: mediaId,
      }),
    });
    
    return mediaId;
  }
  
  formatTweet(text: string): string {
    // Ensure proper formatting
    let formattedText = text;
    
    // Truncate if needed (accounting for t.co link shortening)
    if (formattedText.length > this.config.content.maxLength) {
      formattedText = formattedText.substring(0, this.config.content.maxLength - 3) + '...';
    }
    
    return formattedText;
  }
  
  async createThread(accessToken: string, tweets: string[]): Promise<any> {
    const tweetIds = [];
    let replyToId = null;
    
    for (const tweetText of tweets) {
      const tweetData: any = {
        text: this.formatTweet(tweetText),
      };
      
      if (replyToId) {
        tweetData.reply = { in_reply_to_tweet_id: replyToId };
      }
      
      const response = await this.makeApiRequest(
        this.config.api.endpoints.publish,
        accessToken,
        'POST',
        tweetData
      );
      
      tweetIds.push(response.data.id);
      replyToId = response.data.id;
    }
    
    return { thread_ids: tweetIds };
  }
  
  async getAnalytics(accessToken: string, postId: string): Promise<any> {
    return this.makeApiRequest(
      `/tweets/${postId}?tweet.fields=public_metrics,organic_metrics,promoted_metrics`,
      accessToken
    );
  }
  
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    const response = await this.makeApiRequest(
      `/tweets/${postId}`,
      accessToken,
      'DELETE'
    );
    return response.data.deleted;
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    // Twitter doesn't support native scheduling via API
    // Store in database and use cron job to publish
    throw new Error('Twitter scheduling must be handled by the application');
  }
}