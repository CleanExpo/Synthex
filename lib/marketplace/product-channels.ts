/**
 * Product channel registry.
 *
 * Marketplace products can be listed on commerce channels and promoted through
 * social publishing channels. Keep this registry free of credentials and runtime
 * connection state; API routes use it only to expose safe availability metadata.
 */

export const PRODUCT_SOCIAL_CHANNELS = [
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
] as const;

export type ProductSocialChannelId = (typeof PRODUCT_SOCIAL_CHANNELS)[number];

export type ProductChannelKind = 'commerce' | 'social_publishing';

export interface ProductChannel {
  id: string;
  name: string;
  kind: ProductChannelKind;
  oauthPlatform?: ProductSocialChannelId;
  mediaTypes: Array<'text' | 'image' | 'video' | 'link'>;
  productUseCase: string;
}

export const PRODUCT_CHANNELS: readonly ProductChannel[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    kind: 'commerce',
    mediaTypes: ['image', 'link'],
    productUseCase: 'Product catalogue and checkout listing',
  },
  {
    id: 'ebay',
    name: 'eBay',
    kind: 'commerce',
    mediaTypes: ['image', 'link'],
    productUseCase: 'Marketplace listing and order sync',
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    kind: 'social_publishing',
    oauthPlatform: 'twitter',
    mediaTypes: ['text', 'image', 'video', 'link'],
    productUseCase: 'Product announcements, offers, and launch threads',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    kind: 'social_publishing',
    oauthPlatform: 'linkedin',
    mediaTypes: ['text', 'image', 'video', 'link'],
    productUseCase: 'B2B product updates and authority posts',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    kind: 'social_publishing',
    oauthPlatform: 'instagram',
    mediaTypes: ['image', 'video'],
    productUseCase: 'Product reels, carousels, stories, and visual offers',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    kind: 'social_publishing',
    oauthPlatform: 'facebook',
    mediaTypes: ['text', 'image', 'video', 'link'],
    productUseCase: 'Page posts, community updates, and product offers',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    kind: 'social_publishing',
    oauthPlatform: 'tiktok',
    mediaTypes: ['video'],
    productUseCase: 'Short-form product demos and discovery content',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    kind: 'social_publishing',
    oauthPlatform: 'youtube',
    mediaTypes: ['video', 'link'],
    productUseCase: 'Product demos, explainers, shorts, and launch videos',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    kind: 'social_publishing',
    oauthPlatform: 'pinterest',
    mediaTypes: ['image', 'video', 'link'],
    productUseCase: 'Product pins, visual guides, and buying inspiration',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    kind: 'social_publishing',
    oauthPlatform: 'reddit',
    mediaTypes: ['text', 'image', 'video', 'link'],
    productUseCase: 'Community-aware product discussions and launches',
  },
  {
    id: 'threads',
    name: 'Threads',
    kind: 'social_publishing',
    oauthPlatform: 'threads',
    mediaTypes: ['text', 'image', 'link'],
    productUseCase: 'Short-form product updates and conversation starters',
  },
] as const;

export function getProductChannels(): readonly ProductChannel[] {
  return PRODUCT_CHANNELS;
}

export function getProductSocialChannels(): readonly ProductChannel[] {
  return PRODUCT_CHANNELS.filter(
    channel => channel.kind === 'social_publishing'
  );
}
