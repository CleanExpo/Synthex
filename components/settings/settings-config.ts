/**
 * Settings Configuration
 * Constants and configuration for settings components
 */

import type {
  PlatformConnection,
  BillingInfo,
  NotificationSettings,
  PrivacySettings,
  AdvancedSettings,
} from './types';

// Default settings values
export const defaultNotifications: NotificationSettings = {
  email: true,
  push: false,
  sms: false,
  weeklyReport: true,
  viralAlert: true,
  systemUpdates: false,
};

export const defaultPrivacy: PrivacySettings = {
  publicProfile: false,
  showAnalytics: true,
  dataCollection: true,
};

export const defaultAdvanced: AdvancedSettings = {
  theme: 'dark',
  language: 'en',
  timezone: 'America/New_York',
  debugMode: false,
  betaFeatures: false,
};

export const initialPlatforms: PlatformConnection[] = [
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏', connected: false },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', connected: false },
  { id: 'instagram', name: 'Instagram', icon: '📷', connected: false },
  { id: 'facebook', name: 'Facebook', icon: 'f', connected: false },
  { id: 'tiktok', name: 'TikTok', icon: '♪', connected: false },
];

export const platformConnections: PlatformConnection[] = [
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏', connected: true, username: '@synthexai' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', connected: true, username: 'Synthex AI' },
  { id: 'instagram', name: 'Instagram', icon: '📷', connected: false },
  { id: 'facebook', name: 'Facebook', icon: 'f', connected: false },
  { id: 'tiktok', name: 'TikTok', icon: '♪', connected: false },
];

export const defaultBillingInfo: BillingInfo = {
  plan: 'Pro',
  price: '$99',
  billingCycle: 'monthly',
  nextBilling: '2026-03-01',
  paymentMethod: 'Visa',
  cardLast4: '4242',
};

export const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

export const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
];

export const themes = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];
