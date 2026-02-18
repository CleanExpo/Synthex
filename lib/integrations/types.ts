/**
 * Third-Party Integration Types
 *
 * @description Shared types for third-party integration services (Canva, Buffer, Zapier)
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type IntegrationProvider = 'canva' | 'buffer' | 'zapier';

export type IntegrationCategory = 'design' | 'scheduling' | 'automation';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ThirdPartyConfig {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  name: string;
  description: string;
  icon: string;
  requiredFields: string[];
  optionalFields: string[];
  webhookSupported: boolean;
  oauthSupported: boolean;
}

// ============================================================================
// CREDENTIALS
// ============================================================================

export interface IntegrationCredentials {
  accessToken?: string;
  apiKey?: string;
  webhookUrl?: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// STATUS
// ============================================================================

export interface IntegrationStatus {
  connected: boolean;
  provider: IntegrationProvider;
  config: ThirdPartyConfig;
  lastSync?: Date | string | null;
  error?: string | null;
}

// ============================================================================
// CANVA TYPES
// ============================================================================

export interface CanvaDesign {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvaImportResult {
  designId: string;
  title: string;
  exportUrl: string;
  format: string;
}

// ============================================================================
// BUFFER TYPES
// ============================================================================

export interface BufferProfile {
  id: string;
  service: string;
  serviceUsername: string;
  avatar: string;
  isDisabled: boolean;
  counts: {
    sent: number;
    pending: number;
    draft: number;
  };
}

export interface BufferPost {
  id: string;
  profileId: string;
  text: string;
  status: 'buffer' | 'sent' | 'error';
  scheduledAt?: string;
  sentAt?: string;
  media?: { link: string; type: string }[];
}

export interface BufferAnalytics {
  profileId: string;
  period: string;
  totalPosts: number;
  totalEngagement: number;
  averageEngagement: number;
  topPost?: BufferPost;
}

// ============================================================================
// ZAPIER TYPES
// ============================================================================

export interface ZapierHook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface ZapierTestResult {
  hookId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

// ============================================================================
// INTEGRATION REGISTRY
// ============================================================================

export const INTEGRATION_REGISTRY: Record<IntegrationProvider, ThirdPartyConfig> = {
  canva: {
    provider: 'canva',
    category: 'design',
    name: 'Canva',
    description: 'Import and manage designs from Canva for your social media posts',
    icon: 'palette',
    requiredFields: ['accessToken'],
    optionalFields: ['refreshToken'],
    webhookSupported: false,
    oauthSupported: true,
  },
  buffer: {
    provider: 'buffer',
    category: 'scheduling',
    name: 'Buffer',
    description: 'Schedule and publish content across social platforms via Buffer',
    icon: 'calendar',
    requiredFields: ['accessToken'],
    optionalFields: ['refreshToken'],
    webhookSupported: false,
    oauthSupported: true,
  },
  zapier: {
    provider: 'zapier',
    category: 'automation',
    name: 'Zapier',
    description: 'Automate workflows by connecting Synthex events to thousands of apps',
    icon: 'zap',
    requiredFields: ['apiKey'],
    optionalFields: ['webhookUrl'],
    webhookSupported: true,
    oauthSupported: false,
  },
};
