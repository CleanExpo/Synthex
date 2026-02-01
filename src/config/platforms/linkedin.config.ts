import { PlatformConfig, BasePlatformService } from './base-platform.config';

export const linkedinConfig: PlatformConfig = {
  name: 'linkedin',
  displayName: 'LinkedIn',
  icon: 'linkedin',
  color: '#0077B5',
  oauth: {
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social',
      'r_organization_social',
      'w_organization_social',
      'rw_organization_admin',
    ],
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/linkedin`,
  },
  api: {
    baseUrl: 'https://api.linkedin.com/v2',
    version: 'v2',
    endpoints: {
      profile: '/me',
      posts: '/ugcPosts',
      publish: '/ugcPosts',
      media: '/assets',
      analytics: '/organizationalEntityShareStatistics',
      comments: '/socialActions',
    },
    rateLimit: {
      requests: 100,
      window: 86400000, // 24 hours
    },
  },
  content: {
    maxLength: 3000, // 1300 for company updates
    maxImages: 20,
    maxVideos: 1,
    imageFormats: ['jpg', 'jpeg', 'png', 'gif'],
    videoFormats: ['mp4', 'avi', 'mov', 'wmv'],
    maxImageSize: 10, // 10MB
    maxVideoSize: 5120, // 5GB
    maxVideoDuration: 600, // 10 minutes
    features: {
      hashtags: true,
      mentions: true,
      links: true,
      stories: false,
      reels: false,
      polls: true,
      threads: false,
    },
  },
  analytics: {
    metrics: [
      'impressionCount',
      'clickCount',
      'engagement',
      'shareCount',
      'likeCount',
      'commentCount',
    ],
    refreshInterval: 86400000, // 24 hours
  },
};

export class LinkedInService extends BasePlatformService {
  constructor() {
    super(linkedinConfig);
  }
  
  async authenticate(code: string): Promise<any> {
    const response = await fetch(this.config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.oauth.redirectUri!,
        client_id: this.config.oauth.clientId!,
        client_secret: this.config.oauth.clientSecret!,
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`LinkedIn OAuth error: ${data.error_description}`);
    }
    
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }
  
  async refreshToken(refreshToken: string): Promise<any> {
    // LinkedIn access tokens are valid for 60 days
    // They don't provide refresh tokens
    return null;
  }
  
  async getProfile(accessToken: string): Promise<any> {
    const profileResponse = await fetch(
      `${this.config.api.baseUrl}/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const profileData = await profileResponse.json();
    
    // Get email separately
    const emailResponse = await fetch(
      `${this.config.api.baseUrl}/emailAddress?q=members&projection=(elements*(handle~))`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const emailData = await emailResponse.json();
    
    return {
      ...profileData,
      email: emailData.elements[0]?.['handle~']?.emailAddress,
    };
  }
  
  async getOrganizations(accessToken: string): Promise<any> {
    const response = await fetch(
      `${this.config.api.baseUrl}/organizationalEntityAcls?q=roleAssignee&projection=(elements*(organizationalTarget~(id,name,vanityName,logoV2)))`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    return response.json();
  }
  
  async publishPost(accessToken: string, content: any): Promise<any> {
    this.validateContent(content);
    
    const authorId = content.organizationId 
      ? `urn:li:organization:${content.organizationId}`
      : `urn:li:person:${content.authorId}`;
    
    const postData: any = {
      author: authorId,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: this.formatContent(content.text),
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': content.visibility || 'PUBLIC',
      },
    };
    
    // Handle media
    if (content.images && content.images.length > 0) {
      const mediaUrns = await this.uploadImages(accessToken, content.images, authorId);
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = mediaUrns.map((urn: string) => ({
        status: 'READY',
        media: urn,
      }));
    } else if (content.video) {
      const videoUrn = await this.uploadVideo(accessToken, content.video, authorId);
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'VIDEO';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        media: videoUrn,
      }];
    } else if (content.link) {
      postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
        status: 'READY',
        originalUrl: content.link,
      }];
    }
    
    const response = await fetch(this.config.api.endpoints.publish, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postData),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn API error: ${error}`);
    }
    
    return response.json();
  }
  
  async uploadImages(accessToken: string, imageUrls: string[], ownerId: string): Promise<string[]> {
    const mediaUrns: string[] = [];

    for (const imageUrl of imageUrls) {
      // Register upload
      const registerResponse = await fetch(
        `${this.config.api.baseUrl}/assets?action=registerUpload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: ownerId,
              serviceRelationships: [{
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              }],
            },
          }),
        }
      );
      
      const registerData = await registerResponse.json();
      const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = registerData.value.asset;
      
      // Upload image
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      
      await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: imageBlob,
      });
      
      mediaUrns.push(asset);
    }
    
    return mediaUrns;
  }
  
  async uploadVideo(accessToken: string, videoUrl: string, ownerId: string): Promise<string> {
    // Similar to image upload but with video recipe
    const registerResponse = await fetch(
      `${this.config.api.baseUrl}/assets?action=registerUpload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
            owner: ownerId,
            serviceRelationships: [{
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            }],
          },
        }),
      }
    );
    
    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerData.value.asset;
    
    // Upload video
    const videoResponse = await fetch(videoUrl);
    const videoBlob = await videoResponse.blob();
    
    await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: videoBlob,
    });
    
    return asset;
  }
  
  formatContent(text: string): string {
    // Format for LinkedIn
    let formattedText = text;
    
    // LinkedIn specific formatting
    // Convert markdown bold to LinkedIn format
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // Ensure proper mention format
    formattedText = formattedText.replace(/@(\w+)/g, '@$1');
    
    // Limit length
    if (formattedText.length > this.config.content.maxLength) {
      formattedText = formattedText.substring(0, this.config.content.maxLength - 3) + '...';
    }
    
    return formattedText;
  }
  
  async getAnalytics(accessToken: string, postId: string): Promise<any> {
    const response = await fetch(
      `${this.config.api.baseUrl}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${postId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    return response.json();
  }
  
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    const response = await fetch(
      `${this.config.api.baseUrl}/ugcPosts/${postId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );
    
    return response.ok;
  }
  
  async schedulePost(accessToken: string, content: any, scheduledTime: Date): Promise<any> {
    // LinkedIn doesn't support native scheduling via API
    // Store in database and use cron job to publish
    throw new Error('LinkedIn scheduling must be handled by the application');
  }
  
  async createPoll(accessToken: string, content: any): Promise<any> {
    const authorId = content.organizationId 
      ? `urn:li:organization:${content.organizationId}`
      : `urn:li:person:${content.authorId}`;
    
    const pollData = {
      author: authorId,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content.question,
          },
          shareMediaCategory: 'NATIVE_DOCUMENT',
          media: [{
            status: 'READY',
            nativeDocument: {
              pollContent: {
                question: content.question,
                options: content.options,
                settings: {
                  duration: content.duration || 'ONE_WEEK',
                },
              },
            },
          }],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };
    
    const response = await fetch(this.config.api.endpoints.publish, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(pollData),
    });
    
    return response.json();
  }
}