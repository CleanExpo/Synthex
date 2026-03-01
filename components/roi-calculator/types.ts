/**
 * ROI Calculator Types
 */

export interface ROIMetrics {
  revenue: number;
  costs: number;
  profit: number;
  roi: number;
  paybackPeriod: number;
  breakEvenPoint: number;
  customerLifetimeValue: number;
  customerAcquisitionCost: number;
  conversionRate: number;
  averageOrderValue: number;
}

export interface Campaign {
  id: string;
  name: string;
  platform: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roi: number;
  status: 'active' | 'completed' | 'planned';
}

export interface ChannelPerformance {
  channel: string;
  investment: number;
  revenue: number;
  roi: number;
  conversions: number;
  cpa: number;
}

export interface FunnelStage {
  name: string;
  value: number;
  conversionRate: number;
  dropOff: number;
}

export const COST_BREAKDOWN = [
  { name: 'Advertising', value: 45, fill: '#06b6d4' },
  { name: 'Content Creation', value: 20, fill: '#ec4899' },
  { name: 'Tools & Software', value: 15, fill: '#3b82f6' },
  { name: 'Influencers', value: 12, fill: '#10b981' },
  { name: 'Other', value: 8, fill: '#f59e0b' },
];
