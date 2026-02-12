/**
 * Settings Types
 * Type definitions for settings management
 */

export interface UserProfile {
  name: string;
  email: string;
  company: string;
  role: string;
  bio: string;
  avatar: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  weeklyReport: boolean;
  viralAlert: boolean;
  systemUpdates: boolean;
}

export interface PrivacySettings {
  publicProfile: boolean;
  showAnalytics: boolean;
  dataCollection: boolean;
}

export interface AdvancedSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  debugMode: boolean;
  betaFeatures: boolean;
}

export interface PlatformConnection {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  username?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
}

export interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
}

export interface BillingInfo {
  plan: string;
  price: string;
  billingCycle: string;
  nextBilling: string;
  paymentMethod: string;
  cardLast4: string;
}

export type SettingsTab = 'profile' | 'notifications' | 'integrations' | 'privacy' | 'billing' | 'advanced';
