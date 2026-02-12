/**
 * Sandbox Types
 */

import type { LucideIcon } from 'lucide-react';

export interface PlatformConfig {
  icon: LucideIcon;
  name: string;
  maxChars: number;
  features: string[];
  mockupBg: string;
  textColor: string;
}

export interface DevicePreset {
  width: number;
  height: number;
  label: string;
  icon: LucideIcon;
}

export type Platform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok';
export type Device = 'mobile' | 'tablet' | 'desktop';
export type MediaType = 'none' | 'image' | 'video' | 'gif';
export type PreviewMode = 'visual' | 'code';
