import { BasePlatformService, PlatformConfig, SupportedPlatforms, PlatformFactory } from './base-platform';
import TwitterPlatformService, { TwitterConfig } from './twitter-platform';
import LinkedInPlatformService, { LinkedInConfig } from './linkedin-platform';
import InstagramPlatformService, { InstagramConfig } from './instagram-platform';
import FacebookPlatformService, { FacebookConfig } from './facebook-platform';
import TikTokPlatformService, { TikTokConfig } from './tiktok-platform';

export class SocialPlatformFactory implements PlatformFactory {
  createPlatform(platformName: string, config: PlatformConfig): BasePlatformService | null {
    switch (platformName.toLowerCase()) {
      case SupportedPlatforms.TWITTER:
        return new TwitterPlatformService(config as TwitterConfig);

      case SupportedPlatforms.LINKEDIN:
        return new LinkedInPlatformService(config as LinkedInConfig);

      case SupportedPlatforms.INSTAGRAM:
        return new InstagramPlatformService(config as InstagramConfig);

      case SupportedPlatforms.FACEBOOK:
        return new FacebookPlatformService(config as FacebookConfig);

      case SupportedPlatforms.TIKTOK:
        return new TikTokPlatformService(config as TikTokConfig);

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
      SupportedPlatforms.INSTAGRAM,
      SupportedPlatforms.FACEBOOK,
      SupportedPlatforms.TIKTOK,
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
