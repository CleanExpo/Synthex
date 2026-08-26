export const CAMPAIGN_STUDIO_CHANNELS = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'threads',
  'pinterest',
  'email',
] as const;

export type CampaignStudioChannel = (typeof CAMPAIGN_STUDIO_CHANNELS)[number];

export const CAMPAIGN_STUDIO_TONES = [
  'professional',
  'confident',
  'friendly',
  'playful',
  'urgent',
  'luxury',
  'minimal',
] as const;

export type CampaignStudioTone = (typeof CAMPAIGN_STUDIO_TONES)[number];

export interface CampaignStudioRequest {
  campaignBrief: string;
  targetAudience: string;
  productDetails: string;
  tone: CampaignStudioTone;
  channels: CampaignStudioChannel[];
}

export interface CampaignStudioCopyVariant {
  headline: string;
  body: string;
}

export interface CampaignStudioImagePrompt {
  channel: CampaignStudioChannel;
  prompt: string;
  imageUrl?: string;
  status: 'ready' | 'failed';
  error?: string;
  providerImageModel?: string;
}

export interface CampaignStudioConcept {
  concept: string;
  positioning: string;
  valueProposition: string;
}

export interface CampaignStudioResponse {
  concept: CampaignStudioConcept;
  copyVariants: CampaignStudioCopyVariant[];
  launchChecklist: string[];
  imagePrompts: CampaignStudioImagePrompt[];
  model: {
    textModel: string;
    imageModel: string;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}
