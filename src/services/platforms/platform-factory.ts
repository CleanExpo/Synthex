import { BasePlatformService, PlatformConfig, SupportedPlatforms, PlatformFactory } from './base-platform';
import TwitterPlatformService, { TwitterConfig } from './twitter-platform';
import LinkedInPlatformService, { LinkedInConfig } from './linkedin-platform';

export class SocialPlatformFactory implements PlatformFactory {
  createPlatform(platformName: string, config: PlatformConfig): BasePlatformService | null {
    switch (platformName.toLowerCase()) {
      case SupportedPlatforms.TWITTER:
        return new TwitterPlatformService(config as TwitterConfig);
      
      case SupportedPlatforms.LINKEDIN:
        return new LinkedInPlatformService(config as LinkedInConfig);
      
      case SupportedPlatforms.INSTAGRAM:
        // TODO: Implement Instagram platform service
        console.warn('Instagram platform service not yet implemented');
        return null;
      
      case SupportedPlatforms.FACEBOOK:
        // TODO: Implement Facebook platform service
        console.warn('Facebook platform service not yet implemented');
        return null;
      
      case SupportedPlatforms.TIKTOK:
        // TODO: Implement TikTok platform service
        console.warn('TikTok platform service not yet implemented');
        return null;
      
      default:
        console.error(`Unsupported platform: ${platformName}`);
        return null;
    }
  }

  getSupportedPlatforms(): string[] {
    return Object.values(SupportedPlatforms);
  }

  getImplementedPlatforms(): string[] {
    return [
      SupportedPlatforms.TWITTER,
      SupportedPlatforms.LINKEDIN,
    ];
  }

  isPlatformSupported(platformName: string): boolean {
    return this.getSupportedPlatforms().includes(platformName.toLowerCase());
  }

  isPlatformImplemented(platformName: string): boolean {
    return this.getImplementedPlatforms().includes(platformName.toLowerCase());
  }
}

// Singleton instance
export const platformFactory = new SocialPlatformFactory();

export default platformFactory;
