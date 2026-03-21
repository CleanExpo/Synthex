import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const redditConfig: PlatformConfig = {
  name: 'reddit',
  displayName: 'Reddit',
  icon: 'reddit',
  color: '#FF4500',
  oauth: {
    authorizationUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scopes: [
      'identity',
      'read',
      'submit',
      'edit',
      'history',
      'mysubreddits',
      'vote',
      'save',
      'modposts',
      'privatemessages',
    ],
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    redirectUri: process.env.REDDIT_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/reddit`,
  },
  api: {
    baseUrl: 'https://oauth.reddit.com',
    version: 'v1',
    endpoints: {
      profile: '/api/v1/me',
      posts: '/user/{username}/submitted',
      publish: '/api/submit',
      media: '/api/media/asset.json',
      analytics: '/api/info',
      comments: '/api/comment',
    },
    rateLimit: {
      requests: 100,
      window: 600000, // 10 minutes
    },
  },
  content: {
    maxLength: 40000, // Reddit post text limit
    maxImages: 1, // One image per post (or gallery with multiple)
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    videoFormats: ['mp4', 'mov', 'gif'],
    maxImageSize: 20, // 20MB
    maxVideoSize: 1024, // 1GB
    maxVideoDuration: 900, // 15 minutes
    features: {
      hashtags: false, // Reddit doesn't use hashtags
      mentions: true, // u/username mentions
      links: true,
      stories: false,
      reels: false,
      polls: true,
      threads: true, // Comment threads
    },
  },
  analytics: {
    metrics: [
      'score',
      'upvote_ratio',
      'num_comments',
      'view_count',
      'num_crossposts',
      'total_awards_received',
      'gilded',
      'clicked',
      'num_reports',
    ],
    refreshInterval: 3600000, // 1 hour
  },
};

export class RedditService extends BasePlatformService {
  constructor() {
    super(redditConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    const body = {
      client_id: this.config.oauth.clientId!,
      client_secret: this.config.oauth.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.oauth.redirectUri!,
    };
    
    const credentials = Buffer.from(
      `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`
    ).toString('base64');
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SYNTHEX/1.0 by YourUsername',
      },
      body: new URLSearchParams(body),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Reddit OAuth error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    const body = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };
    
    const credentials = Buffer.from(
      `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`
    ).toString('base64');
    
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SYNTHEX/1.0 by YourUsername',
      },
      body: new URLSearchParams(body),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Reddit token refresh error: ${data.error_description || data.error}`);
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    };
  }
  
  async getProfile(accessToken: string): Promise<any> {
    return this.makeApiRequest(this.config.api.endpoints.profile, accessToken);
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    if (!content.subreddit) {
      throw new Error('Reddit requires a subreddit to publish a post');
    }
    
    if (!content.title) {
      throw new Error('Reddit requires a title for posts');
    }
    
    const postData: any = {
      sr: content.subreddit,
      title: content.title,
      kind: content.kind || 'self', // self, link, image, video, gallery, poll
      api_type: 'json',
      extension: 'json',
      resubmit: true,
      send_replies: content.sendReplies !== false,
    };
    
    // Handle different post types
    switch (content.kind) {
      case 'self': // Text post
        postData.text = content.text || '';
        break;
        
      case 'link': // Link post
        if (!content.url) {
          throw new Error('Link posts require a URL');
        }
        postData.url = content.url;
        break;
        
      case 'image': // Image post
        if (!content.imageUrl) {
          throw new Error('Image posts require an image URL');
        }
        postData.url = content.imageUrl;
        break;
        
      case 'video': // Video post
        if (!content.videoUrl) {
          throw new Error('Video posts require a video URL');
        }
        postData.url = content.videoUrl;
        break;
        
      case 'gallery': // Gallery post
        if (!content.images || content.images.length === 0) {
          throw new Error('Gallery posts require at least one image');
        }
        // Gallery posts require special handling with media uploads
        return this.publishGallery(accessToken, content);
        
      case 'poll': // Poll post
        if (!content.options || content.options.length < 2) {
          throw new Error('Poll posts require at least 2 options');
        }
        return this.publishPoll(accessToken, content);
    }
    
    // Add flair if specified
    if (content.flairId) {
      postData.flair_id = content.flairId;
    }
    
    if (content.flairText) {
      postData.flair_text = content.flairText;
    }
    
    // NSFW and spoiler flags
    if (content.nsfw) {
      postData.nsfw = true;
    }
    
    if (content.spoiler) {
      postData.spoiler = true;
    }
    
    // OC (Original Content) flag
    if (content.originalContent) {
      postData.original_content = true;
    }
    
    return this.makeApiRequest(
      this.config.api.endpoints.publish,
      accessToken,
      'POST',
      postData
    );
  }
  
  async publishGallery(accessToken: string, content: any): Promise<any> {
    // First, upload all images
    const mediaItems: { media_id: string; caption: string }[] = [];

    for (let i = 0; i < content.images.length; i++) {
      const image = content.images[i];
      const mediaAsset = await this.uploadMedia(accessToken, image);
      mediaItems.push({
        media_id: mediaAsset.media_id,
        caption: content.captions ? content.captions[i] : '',
      });
    }
    
    const galleryData = {
      sr: content.subreddit,
      title: content.title,
      kind: 'gallery',
      items: mediaItems,
      api_type: 'json',
      show_error_list: true,
    };
    
    return this.makeApiRequest('/api/submit_gallery_post.json', accessToken, 'POST', galleryData);
  }
  
  async publishPoll(accessToken: string, content: any): Promise<any> {
    const pollData = {
      sr: content.subreddit,
      title: content.title,
      text: content.text || '',
      kind: 'poll',
      options: content.options,
      duration: content.duration || 3, // Days (1-7)
      api_type: 'json',
    };
    
    return this.makeApiRequest('/api/submit_poll_post', accessToken, 'POST', pollData);
  }
  
  async uploadMedia(accessToken: string, imageUrl: string): Promise<any> {
    // Request upload URL
    const mediaRequest = {
      filepath: 'image.jpg', // This would be dynamic based on actual file
      mimetype: 'image/jpeg', // This would be dynamic based on actual file
    };
    
    const mediaResponse = await this.makeApiRequest(
      this.config.api.endpoints.media!,
      accessToken,
      'POST',
      mediaRequest
    );
    
    // In a real implementation, you would upload the actual file to the provided URL
    // This is a simplified version
    return {
      media_id: mediaResponse.args.media_id,
      websocket_url: mediaResponse.args.websocket_url,
    };
  }
  
  async getSubreddits(accessToken: string, limit: number = 25): Promise<any> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    
    return this.makeApiRequest(`/subreddits/mine/subscriber?${params}`, accessToken);
  }
  
  async getSubredditInfo(accessToken: string, subreddit: string): Promise<any> {
    return this.makeApiRequest(`/r/${subreddit}/about`, accessToken);
  }
  
  async getUserPosts(accessToken: string, username: string, sort: string = 'new', limit: number = 25): Promise<any> {
    const params = new URLSearchParams({
      sort,
      limit: limit.toString(),
    });
    
    return this.makeApiRequest(`/user/${username}/submitted?${params}`, accessToken);
  }
  
  async getPost(accessToken: string, postId: string): Promise<any> {
    return this.makeApiRequest(`/api/info?id=t3_${postId}`, accessToken);
  }
  
  async editPost(accessToken: string, postId: string, newText: string): Promise<any> {
    const editData = {
      thing_id: `t3_${postId}`,
      text: newText,
      api_type: 'json',
    };
    
    return this.makeApiRequest('/api/editusertext', accessToken, 'POST', editData);
  }
  
  async getAnalytics(accessToken: string, postId: string): Promise<any> {
    // Reddit doesn't provide detailed analytics through the API
    // We can get basic post information
    const postInfo = await this.getPost(accessToken, postId);
    
    if (postInfo.data && postInfo.data.children.length > 0) {
      const post = postInfo.data.children[0].data;
      return {
        score: post.score,
        upvote_ratio: post.upvote_ratio,
        num_comments: post.num_comments,
        view_count: post.view_count || 0,
        num_crossposts: post.num_crossposts || 0,
        total_awards_received: post.total_awards_received || 0,
        gilded: post.gilded || 0,
        clicked: post.clicked || false,
        num_reports: post.num_reports || 0,
      };
    }
    
    return null;
  }
  
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    const deleteData = {
      id: `t3_${postId}`,
    };
    
    const response = await this.makeApiRequest('/api/del', accessToken, 'POST', deleteData);
    return response.success || true; // Reddit doesn't return explicit success
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    // Reddit doesn't support scheduled posting natively
    // This would need to be handled by a scheduling service
    throw new Error('Reddit API does not support scheduled posting');
  }
  
  async vote(accessToken: string, postId: string, direction: 1 | 0 | -1): Promise<any> {
    // 1 = upvote, 0 = remove vote, -1 = downvote
    const voteData = {
      id: `t3_${postId}`,
      dir: direction,
    };
    
    return this.makeApiRequest('/api/vote', accessToken, 'POST', voteData);
  }
  
  async comment(accessToken: string, parentId: string, text: string): Promise<any> {
    const commentData = {
      parent: parentId, // t3_postid or t1_commentid
      text,
      api_type: 'json',
    };
    
    return this.makeApiRequest(this.config.api.endpoints.comments!, accessToken, 'POST', commentData);
  }
  
  async getComments(accessToken: string, postId: string, sort: string = 'best', limit: number = 100): Promise<any> {
    const params = new URLSearchParams({
      sort,
      limit: limit.toString(),
    });
    
    // Reddit uses a different endpoint for comments
    const response = await fetch(`https://oauth.reddit.com/comments/${postId}?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SYNTHEX/1.0 by YourUsername',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async searchSubreddits(accessToken: string, query: string, limit: number = 10): Promise<any> {
    const params = new URLSearchParams({
      q: query,
      type: 'sr',
      limit: limit.toString(),
    });
    
    return this.makeApiRequest(`/api/search_subreddits?${params}`, accessToken);
  }
  
  protected makeApiRequest(
    endpoint: string,
    accessToken: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    const url = `${this.config.api.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SYNTHEX/1.0 by YourUsername', // Reddit requires User-Agent
    };
    
    // Reddit API expects form data for POST requests
    let requestBody;
    if (body && method !== 'GET') {
      if (endpoint.includes('/api/') && method === 'POST') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        requestBody = new URLSearchParams(body).toString();
      } else {
        requestBody = JSON.stringify(body);
      }
    }
    
    return fetch(url, {
      method,
      headers,
      body: requestBody,
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${this.config.name} API error: ${response.statusText}`);
      }
      return response.json();
    });
  }
  
  public formatContent(content: any): any {
    // Reddit-specific content formatting
    const formatted = { ...content };
    
    // Convert hashtags to subreddit mentions (r/subreddit)
    if (formatted.text && formatted.text.includes('#')) {
      formatted.text = formatted.text.replace(/#(\w+)/g, 'r/$1');
    }
    
    // Ensure title is within Reddit's limits (300 characters)
    if (formatted.title && formatted.title.length > 300) {
      formatted.title = formatted.title.substring(0, 297) + '...';
    }
    
    // Handle markdown formatting for Reddit
    if (formatted.text) {
      // Convert **bold** and *italic* to Reddit markdown
      formatted.text = formatted.text
        .replace(/\*\*([^*]+)\*\*/g, '**$1**') // Bold
        .replace(/\*([^*]+)\*/g, '*$1*') // Italic
        .replace(/`([^`]+)`/g, '`$1`'); // Code
    }
    
    return formatted;
  }
}
