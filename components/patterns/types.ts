/**
 * Patterns Page Types
 */

export interface ViralPattern {
  id: number;
  platform: string;
  content: string;
  type: string;
  engagement: number;
  impressions: number;
  shares: number;
  hookType: string;
  timing: string;
  sentiment: number;
  viralityScore: number;
  growthRate: string;
}

export interface HookType {
  name: string;
  value: number;
  color: string;
}

export interface EngagementDataPoint {
  hour: string;
  twitter: number;
  linkedin: number;
  tiktok: number;
  instagram: number;
}

export interface PlatformMetric {
  platform: string;
  metric: string;
  value: number;
}

export interface RadarDataPoint {
  metric: string;
  twitter: number;
  linkedin: number;
  tiktok: number;
  instagram: number;
}
