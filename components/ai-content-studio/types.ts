export interface GeneratedContent {
  id: string;
  content: string;
  platform: string;
  variations: Array<{
    id: string;
    content: string;
    style: string;
    score: number;
  }>;
  hashtags: string[];
  emojis: string[];
  hooks: string[];
  cta?: string;
  estimatedEngagement: number;
  viralScore: number;
  metadata: {
    generatedAt: Date;
    model: string;
    tokens: number;
    processingTime: number;
  };
}

export interface Business {
  organizationId: string;
  organizationName: string;
  displayName: string | null;
}

export interface ConnectionStatus {
  platform: string;
  connected: boolean;
}

export interface ContentFormData {
  type: string;
  platform: string;
  topic: string;
  tone: string;
  keywords: string;
  targetAudience: string;
  length: string;
  includeEmojis: boolean;
  includeHashtags: boolean;
  includeCTA: boolean;
}
